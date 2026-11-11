import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { OrderService } from '../services/order.service.js';
import { QRService } from '../services/qr.service.js';

const createOrderSchema = z.object({
  eventId: z.string().min(1, 'El ID del evento es requerido'),
  buyerName: z.string().min(2, 'El nombre del comprador es requerido'),
  buyerEmail: z.string().email('Email del comprador inválido'),
  buyerPhone: z.string().min(6, 'Teléfono del comprador requerido'),
  buyerDocumentId: z.string().min(4, 'Identificación/Cédula requerida'),
  attendees: z
    .array(
      z.object({
        ticketTypeId: z.string().min(1, 'ID de tipo de ticket requerido'),
        attendeeName: z.string().min(2, 'Nombre de asistente requerido'),
        attendeeEmail: z.string().email('Email de asistente inválido'),
        attendeeDocumentId: z.string().min(4, 'Documento de asistente requerido'),
      })
    )
    .min(1, 'Debes agregar al menos un boleto'),
});

export class OrderController {
  static async create(req: Request, res: Response) {
    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const order = await OrderService.createOrder(parsed.data);
      return res.status(201).json({
        message: 'Orden creada exitosamente. Procede a realizar la transferencia bancaria.',
        order,
      });
    } catch (error: any) {
      console.error('Error al crear orden:', error);
      return res.status(400).json({ error: error.message || 'No se pudo crear la orden' });
    }
  }

  static async uploadReceipt(req: Request, res: Response) {
    try {
      const { orderIdOrNumber, referenceNumber } = req.body;

      if (!orderIdOrNumber) {
        return res.status(400).json({ error: 'El ID o código de la orden es requerido' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Debes adjuntar un archivo de comprobante (JPG, PNG o PDF)' });
      }

      const receiptUrl = `/uploads/${req.file.filename}`;
      const updatedOrder = await OrderService.submitReceipt(
        orderIdOrNumber,
        receiptUrl,
        referenceNumber
      );

      return res.json({
        message: 'Comprobante subido exitosamente. Nuestro equipo validará el pago en breve.',
        order: updatedOrder,
      });
    } catch (error: any) {
      console.error('Error al subir comprobante:', error);
      return res.status(400).json({ error: error.message || 'Error al procesar el comprobante' });
    }
  }

  static async getStatus(req: Request, res: Response) {
    try {
      const { idOrNumber } = req.params;

      const order = await prisma.order.findFirst({
        where: {
          OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }],
        },
        include: {
          orderItems: {
            include: { ticketType: true },
          },
          tickets: {
            include: { ticketType: true },
          },
          event: true,
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      let enrichedTickets = order.tickets;
      if (order.status === 'APPROVED') {
        enrichedTickets = await Promise.all(
          order.tickets.map(async (t) => {
            let qrDataUrl = '';
            if (t.qrCodeData) {
              qrDataUrl = await QRService.generateQRCodeDataUrl(t.qrCodeData);
            }
            return {
              ...t,
              qrDataUrl,
            };
          })
        );
      }

      return res.json({
        order: {
          ...order,
          tickets: enrichedTickets,
        },
      });
    } catch (error) {
      console.error('Error al consultar orden:', error);
      return res.status(500).json({ error: 'Error al consultar la orden' });
    }
  }

  static async getTicket(req: Request, res: Response) {
    try {
      const { code } = req.params;

      const ticket = await prisma.ticket.findUnique({
        where: { ticketCode: code },
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

      let qrDataUrl = '';
      if (ticket.qrCodeData) {
        qrDataUrl = await QRService.generateQRCodeDataUrl(ticket.qrCodeData);
      }

      return res.json({
        ticket: {
          ...ticket,
          qrDataUrl,
        },
      });
    } catch (error) {
      console.error('Error al consultar boleto:', error);
      return res.status(500).json({ error: 'Error al consultar el boleto' });
    }
  }
}
