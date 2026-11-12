import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { CertificateCategory } from '@prisma/client';
import { QRService } from '../services/qr.service.js';

export class CertificateController {
  static async getTemplates(_req: Request, res: Response) {
    try {
      const templates = await prisma.certificateTemplate.findMany({
        orderBy: { category: 'asc' },
      });

      return res.json({ templates });
    } catch (error: any) {
      console.error('[CertificateController.getTemplates]', error);
      return res.status(500).json({ error: 'Error al obtener plantillas de certificados' });
    }
  }

  static async updateTemplate(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const { title, description } = req.body;

      if (!Object.values(CertificateCategory).includes(category as CertificateCategory)) {
        return res.status(400).json({ error: `Categoría inválida: ${category}` });
      }

      let backgroundImageUrl = req.body.backgroundImageUrl;
      if (req.file) {
        backgroundImageUrl = `/uploads/${req.file.filename}`;
      }

      const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
      if (!activeEvent) {
        return res.status(400).json({ error: 'No hay evento activo' });
      }

      const template = await prisma.certificateTemplate.upsert({
        where: { category: category as CertificateCategory },
        create: {
          eventId: activeEvent.id,
          category: category as CertificateCategory,
          title: title || `Certificado de ${category}`,
          description: description || null,
          backgroundImageUrl: backgroundImageUrl || 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1600&q=80',
          isActive: true,
        },
        update: {
          title: title !== undefined ? title : undefined,
          description: description !== undefined ? description : undefined,
          backgroundImageUrl: backgroundImageUrl || undefined,
        },
      });

      return res.json({ message: 'Plantilla de certificado actualizada', template });
    } catch (error: any) {
      console.error('[CertificateController.updateTemplate]', error);
      return res.status(500).json({ error: 'Error al actualizar plantilla de certificado' });
    }
  }

  static async lookup(req: Request, res: Response) {
    try {
      const query = ((req.query.query as string) || '').trim();
      if (!query) {
        return res.status(400).json({ error: 'Ingresa tu Carnet (CI) o Nombre para consultar' });
      }

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

      // 1. Buscar en Certificados manuales (Speakers, Voluntarios, VIPs)
      const existingCert = await prisma.certificate.findFirst({
        where: {
          OR: [
            { recipientDocumentId: { equals: query, mode: 'insensitive' } },
            { recipientName: { contains: query, mode: 'insensitive' } },
            { certificateCode: { equals: query, mode: 'insensitive' } },
          ],
        },
        include: {
          event: true,
          ticket: { include: { ticketType: true } },
        },
      });

      if (existingCert) {
        const template = await prisma.certificateTemplate.findUnique({
          where: { category: existingCert.category },
        });

        const qrDataUrl = await QRService.generateQRCodeDataUrl(
          `${clientUrl}/?verifyCert=${existingCert.certificateCode}`
        );

        return res.json({
          status: 'SUCCESS',
          certificate: {
            ...existingCert,
            qrDataUrl,
            template,
          },
        });
      }

      // 2. Buscar en Boletos de Asistentes
      const ticket = await prisma.ticket.findFirst({
        where: {
          OR: [
            { attendeeDocumentId: { equals: query, mode: 'insensitive' } },
            { attendeeName: { contains: query, mode: 'insensitive' } },
            { ticketCode: { equals: query, mode: 'insensitive' } },
          ],
        },
        include: {
          order: { include: { event: true } },
          ticketType: true,
          certificate: true,
        },
      });

      if (!ticket) {
        return res.json({
          status: 'NOT_FOUND',
          message: `No se encontró ningún participante registrado con el dato "${query}". Verifica tu número de carnet o consulta con el equipo organizador.`,
        });
      }

      // Validar si la orden está aprobada
      if (ticket.order.status !== 'APPROVED') {
        return res.json({
          status: 'ORDER_NOT_APPROVED',
          message: `Tu inscripción (#${ticket.order.orderNumber}) se encuentra en estado ${ticket.order.status}. El comprobante debe estar validado para emitir certificados.`,
        });
      }

      // Validar si hizo check-in en puerta
      if (!ticket.isCheckedIn) {
        return res.json({
          status: 'NOT_CHECKED_IN',
          message: `Hola ${ticket.attendeeName}. Tu entrada está confirmada, pero los certificados oficiales solo se emiten a los participantes acreditados en puerta el día del evento.`,
          ticket: {
            attendeeName: ticket.attendeeName,
            attendeeDocumentId: ticket.attendeeDocumentId,
            ticketType: ticket.ticketType.name,
            ticketCode: ticket.ticketCode,
          },
        });
      }

      // Si ya tiene certificado emitido o lo creamos
      const category = ticket.ticketType.name.toLowerCase().includes('vip')
        ? CertificateCategory.VIP
        : CertificateCategory.ATTENDEE;

      let cert = ticket.certificate;
      if (!cert) {
        const certCode = `CERT-TEDX-${Date.now().toString(36).toUpperCase()}-${ticket.ticketCode.slice(-4)}`;
        const verificationUrl = `${clientUrl}/?verifyCert=${certCode}`;

        cert = await prisma.certificate.create({
          data: {
            certificateCode: certCode,
            eventId: ticket.order.eventId,
            category,
            recipientName: ticket.attendeeName,
            recipientDocumentId: ticket.attendeeDocumentId,
            ticketId: ticket.id,
            qrCodeData: verificationUrl,
          },
        });
      }

      const template = await prisma.certificateTemplate.findUnique({
        where: { category },
      });

      const qrDataUrl = await QRService.generateQRCodeDataUrl(
        `${clientUrl}/?verifyCert=${cert.certificateCode}`
      );

      return res.json({
        status: 'SUCCESS',
        certificate: {
          ...cert,
          event: ticket.order.event,
          ticket,
          qrDataUrl,
          template,
        },
      });
    } catch (error: any) {
      console.error('[CertificateController.lookup]', error);
      return res.status(500).json({ error: 'Error al consultar certificado' });
    }
  }

  static async verify(req: Request, res: Response) {
    try {
      const { code } = req.params;

      const cert = await prisma.certificate.findUnique({
        where: { certificateCode: code.trim().toUpperCase() },
        include: {
          event: true,
          ticket: { include: { ticketType: true } },
        },
      });

      if (!cert) {
        return res.status(404).json({
          valid: false,
          error: 'Certificado no encontrado o código de verificación inválido',
        });
      }

      const template = await prisma.certificateTemplate.findUnique({
        where: { category: cert.category },
      });

      return res.json({
        valid: true,
        certificate: {
          code: cert.certificateCode,
          recipientName: cert.recipientName,
          recipientDocumentId: cert.recipientDocumentId,
          category: cert.category,
          eventName: cert.event.title,
          eventDate: cert.event.date,
          issuedAt: cert.issuedAt,
          templateTitle: template?.title,
          verifiedAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error('[CertificateController.verify]', error);
      return res.status(500).json({ error: 'Error al verificar el certificado' });
    }
  }

  static async issueManual(req: Request, res: Response) {
    try {
      const { recipientName, recipientDocumentId, category = 'VOLUNTEER', eventId } = req.body;

      if (!recipientName || !recipientDocumentId) {
        return res.status(400).json({ error: 'Nombre y carnet del beneficiario son obligatorios' });
      }

      let targetEventId = eventId;
      if (!targetEventId) {
        const active = await prisma.event.findFirst({ where: { isActive: true } });
        targetEventId = active?.id;
      }

      if (!targetEventId) {
        return res.status(400).json({ error: 'No se encontró un evento activo' });
      }

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const certCode = `CERT-TEDX-${category.slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;
      const verificationUrl = `${clientUrl}/?verifyCert=${certCode}`;

      const cert = await prisma.certificate.create({
        data: {
          certificateCode: certCode,
          eventId: targetEventId,
          category: category as CertificateCategory,
          recipientName: recipientName.trim(),
          recipientDocumentId: recipientDocumentId.trim(),
          qrCodeData: verificationUrl,
        },
        include: { event: true },
      });

      return res.status(201).json({ message: 'Certificado emitido exitosamente', certificate: cert });
    } catch (error: any) {
      console.error('[CertificateController.issueManual]', error);
      return res.status(500).json({ error: 'Error al emitir certificado' });
    }
  }

  static async getAllCertificates(_req: Request, res: Response) {
    try {
      const certificates = await prisma.certificate.findMany({
        orderBy: { issuedAt: 'desc' },
        include: {
          event: true,
          ticket: { include: { ticketType: true } },
        },
      });

      return res.json({ certificates });
    } catch (error: any) {
      console.error('[CertificateController.getAllCertificates]', error);
      return res.status(500).json({ error: 'Error al listar certificados emitidos' });
    }
  }
}

