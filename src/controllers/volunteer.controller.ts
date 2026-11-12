import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { prisma } from '../config/prisma.js';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { OrderService } from '../services/order.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';

export class VolunteerController {
  static async register(req: AuthRequest, res: Response) {
    try {
      const volunteerUserId = req.user?.id;
      if (!volunteerUserId) {
        return res.status(401).json({ error: 'No autenticado' });
      }

      const {
        eventId,
        buyerName,
        buyerEmail,
        buyerPhone,
        buyerDocumentId,
        paymentMethod = 'CASH',
        referenceNumber,
      } = req.body;

      let attendees = req.body.attendees;
      if (typeof attendees === 'string') {
        try {
          attendees = JSON.parse(attendees);
        } catch (e) {
          return res.status(400).json({ error: 'El formato de los asistentes no es válido' });
        }
      }

      if (!eventId || !buyerName || !buyerDocumentId || !buyerPhone || !attendees || attendees.length === 0) {
        return res.status(400).json({
          error: 'Faltan campos obligatorios (evento, comprador, carnet, teléfono y lista de asistentes)',
        });
      }

      let receiptUrl: string | undefined = undefined;
      if (req.file) {
        receiptUrl = `/uploads/${req.file.filename}`;
      }

      const method = paymentMethod === 'TRANSFER' ? PaymentMethod.TRANSFER : PaymentMethod.CASH;

      const order = await OrderService.createVolunteerOrder({
        input: {
          eventId,
          buyerName: buyerName.trim(),
          buyerEmail: (buyerEmail || 'sin-correo@tedx.local').trim(),
          buyerPhone: buyerPhone.trim(),
          buyerDocumentId: buyerDocumentId.trim(),
          attendees,
        },
        paymentMethod: method,
        volunteerUserId,
        receiptUrl,
        referenceNumber: referenceNumber?.trim(),
      });

      return res.status(201).json({
        message: method === PaymentMethod.CASH
          ? 'Inscripción en efectivo registrada y aprobada de inmediato'
          : 'Inscripción registrada. Comprobante enviado a la cola de validación',
        order,
      });
    } catch (error: any) {
      console.error('[VolunteerController.register]', error);
      return res.status(400).json({ error: error.message || 'Error al procesar la inscripción' });
    }
  }

  static async lookupCarnet(req: AuthRequest, res: Response) {
    try {
      const carnet = (req.query.carnet as string) || '';
      if (!carnet || !carnet.trim()) {
        return res.status(400).json({ error: 'Debes proporcionar un número de Carnet (CI) para la búsqueda' });
      }

      const orders = await OrderService.lookupByCarnet(carnet);

      return res.json({
        query: carnet.trim(),
        totalFound: orders.length,
        orders,
      });
    } catch (error: any) {
      console.error('[VolunteerController.lookupCarnet]', error);
      return res.status(500).json({ error: 'Error al buscar el carnet' });
    }
  }

  static async dispatchWhatsApp(req: AuthRequest, res: Response) {
    try {
      const { ticketId, orderId, targetPhone } = req.body;

      if (!ticketId && !orderId) {
        return res.status(400).json({ error: 'Debes especificar ticketId o orderId para el envío' });
      }

      // Envío de un ticket individual
      if (ticketId) {
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          include: {
            ticketType: true,
            order: {
              include: { event: true },
            },
          },
        });

        if (!ticket) {
          return res.status(404).json({ error: 'Boleto no encontrado' });
        }

        if (ticket.order.status !== OrderStatus.APPROVED) {
          return res.status(400).json({
            error: `No se puede despachar la entrada porque la orden está en estado ${ticket.order.status}. Debe estar APROBADA.`,
          });
        }

        const phoneToSend = targetPhone || ticket.order.buyerPhone;
        const result = await WhatsAppService.sendTicket({
          phone: phoneToSend,
          ticket: {
            id: ticket.id,
            ticketCode: ticket.ticketCode,
            attendeeName: ticket.attendeeName,
            attendeeDocumentId: ticket.attendeeDocumentId,
            qrCodeData: ticket.qrCodeData,
            ticketType: { name: ticket.ticketType.name },
          },
          event: ticket.order.event,
          orderNumber: ticket.order.orderNumber,
        });

        // Registrar auditoría de envío
        await prisma.$transaction([
          prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              whatsappSentAt: new Date(),
              whatsappSentCount: { increment: 1 },
            },
          }),
          prisma.order.update({
            where: { id: ticket.order.id },
            data: {
              whatsappSentAt: new Date(),
              whatsappSentCount: { increment: 1 },
            },
          }),
        ]);

        return res.json({
          message: result.message,
          success: result.success,
          waMeUrl: result.waMeUrl,
          formattedPhone: result.formattedPhone,
          ticketId: ticket.id,
          ticketCode: ticket.ticketCode,
        });
      }

      // Envío de toda la orden (todos los boletos al comprador)
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          tickets: { include: { ticketType: true } },
          event: true,
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      if (order.status !== OrderStatus.APPROVED) {
        return res.status(400).json({
          error: `No se puede despachar la orden porque su estado es ${order.status}. Debe estar APROBADA.`,
        });
      }

      const phoneToSend = targetPhone || order.buyerPhone;
      const results = [];
      let lastWaMeUrl = '';

      for (const ticket of order.tickets) {
        const sendRes = await WhatsAppService.sendTicket({
          phone: phoneToSend,
          ticket: {
            id: ticket.id,
            ticketCode: ticket.ticketCode,
            attendeeName: ticket.attendeeName,
            attendeeDocumentId: ticket.attendeeDocumentId,
            qrCodeData: ticket.qrCodeData,
            ticketType: { name: ticket.ticketType.name },
          },
          event: order.event,
          orderNumber: order.orderNumber,
        });

        lastWaMeUrl = sendRes.waMeUrl;
        results.push({
          ticketCode: ticket.ticketCode,
          attendeeName: ticket.attendeeName,
          success: sendRes.success,
          message: sendRes.message,
          waMeUrl: sendRes.waMeUrl,
        });

        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            whatsappSentAt: new Date(),
            whatsappSentCount: { increment: 1 },
          },
        });
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          whatsappSentAt: new Date(),
          whatsappSentCount: { increment: order.tickets.length },
        },
      });

      return res.json({
        message: `Procesado el envío de ${order.tickets.length} entradas por WhatsApp`,
        results,
        waMeUrl: lastWaMeUrl,
        formattedPhone: WhatsAppService.formatPhoneNumber(phoneToSend),
      });
    } catch (error: any) {
      console.error('[VolunteerController.dispatchWhatsApp]', error);
      return res.status(500).json({ error: error.message || 'Error al despachar por WhatsApp' });
    }
  }

  static async getCashSummary(req: AuthRequest, res: Response) {
    try {
      const volunteerUserId = req.user?.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const cashOrders = await prisma.order.findMany({
        where: {
          collectedById: volunteerUserId,
          paymentMethod: PaymentMethod.CASH,
          createdAt: { gte: today },
        },
        include: {
          tickets: true,
        },
      });

      const totalCashAmount = cashOrders.reduce((sum, ord) => sum + ord.totalAmount, 0);
      const totalTicketsSold = cashOrders.reduce((sum, ord) => sum + ord.tickets.length, 0);

      return res.json({
        volunteerId: volunteerUserId,
        todayCashOrdersCount: cashOrders.length,
        todayCashTicketsCount: totalTicketsSold,
        todayCashTotalAmount: totalCashAmount,
        orders: cashOrders,
      });
    } catch (error: any) {
      console.error('[VolunteerController.getCashSummary]', error);
      return res.status(500).json({ error: 'Error al obtener el resumen de caja del voluntario' });
    }
  }
}

