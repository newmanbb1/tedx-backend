import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { OrderService } from '../services/order.service.js';
import { QRService } from '../services/qr.service.js';

const createOrderSchema = z.object({
  eventId: z.string().min(1, 'El ID del evento es requerido'),
  buyerName: z.string().min(2, 'El nombre del comprador es requerido'),
  buyerEmail: z.string().email('Email del comprador inválido').optional().or(z.literal('')).nullable(),
  buyerPhone: z.string().min(6, 'Teléfono del comprador requerido'),
  buyerDocumentId: z.string().min(4, 'Identificación/Cédula requerida'),
  items: z
    .array(
      z.object({
        ticketTypeId: z.string().min(1, 'ID de tipo de ticket requerido'),
        quantity: z.number().min(1),
      })
    )
    .optional(),
  attendees: z
    .array(
      z.object({
        ticketTypeId: z.string().min(1, 'ID de tipo de ticket requerido'),
        attendeeName: z.string().optional(),
        attendeeEmail: z.string().optional().nullable(),
        attendeeDocumentId: z.string().optional(),
      })
    )
    .optional(),
});

export class OrderController {
  static async create(req: Request, res: Response) {
    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const { eventId, buyerName, buyerEmail, buyerPhone, buyerDocumentId, items, attendees } = parsed.data;
      const cleanBuyerEmail = buyerEmail && buyerEmail.trim() ? buyerEmail.trim() : null;

      // Generar lista final de asistentes (modo híbrido)
      let finalAttendees: Array<{
        ticketTypeId: string;
        attendeeName: string;
        attendeeEmail?: string | null;
        attendeeDocumentId: string;
      }> = [];

      if (attendees && attendees.length > 0) {
        finalAttendees = attendees.map((a, idx) => {
          const isPrimary = idx === 0;
          return {
            ticketTypeId: a.ticketTypeId,
            attendeeName: a.attendeeName?.trim() || (isPrimary ? buyerName : ''),
            attendeeEmail: a.attendeeEmail?.trim() || (isPrimary ? cleanBuyerEmail : null),
            attendeeDocumentId: a.attendeeDocumentId?.trim() || (isPrimary ? buyerDocumentId : ''),
          };
        });
      } else if (items && items.length > 0) {
        // Si se enviaron items sin detalle de acompañantes, solo es válido si es 1 sola entrada
        const totalItemsQty = items.reduce((sum, item) => sum + item.quantity, 0);
        if (totalItemsQty > 1) {
          return res.status(400).json({
            error: 'Para compras de 2 o más entradas debes ingresar obligatoriamente el nombre y carnet de cada acompañante.',
          });
        }
        finalAttendees = [{
          ticketTypeId: items[0].ticketTypeId,
          attendeeName: buyerName,
          attendeeEmail: cleanBuyerEmail,
          attendeeDocumentId: buyerDocumentId,
        }];
      } else {
        return res.status(400).json({ error: 'Debes seleccionar al menos una entrada para comprar' });
      }

      // Validación estricta: todos los asistentes deben tener Nombre y CI
      // Validación antiduplicados: no se permiten carnets ni nombres repetidos en la orden
      const seenDocs = new Set<string>();
      const seenNames = new Set<string>();

      for (let i = 0; i < finalAttendees.length; i++) {
        const a = finalAttendees[i];
        if (!a.attendeeName || a.attendeeName.trim().length < 2) {
          return res.status(400).json({
            error: `Debes ingresar el nombre completo del ${i === 0 ? 'comprador titular' : `Acompañante #${i + 1}`}.`,
          });
        }
        if (!a.attendeeDocumentId || a.attendeeDocumentId.trim().length < 3) {
          return res.status(400).json({
            error: `Debes ingresar la cédula de identidad / CI del ${i === 0 ? 'comprador titular' : `Acompañante #${i + 1}`}.`,
          });
        }

        const normalizedDoc = a.attendeeDocumentId.trim().toLowerCase().replace(/\s+/g, '');
        const normalizedName = a.attendeeName.trim().toLowerCase().replace(/\s+/g, ' ');

        if (seenDocs.has(normalizedDoc)) {
          return res.status(400).json({
            error: `El carnet de identidad "${a.attendeeDocumentId}" está repetido en esta orden. Cada entrada debe pertenecer a una persona distinta.`,
          });
        }
        seenDocs.add(normalizedDoc);

        if (seenNames.has(normalizedName)) {
          return res.status(400).json({
            error: `El nombre "${a.attendeeName}" está repetido en esta orden. Cada entrada debe pertenecer a una persona distinta.`,
          });
        }
        seenNames.add(normalizedName);
      }

      const order = await OrderService.createOrder({
        eventId,
        buyerName,
        buyerEmail: cleanBuyerEmail,
        buyerPhone,
        buyerDocumentId,
        attendees: finalAttendees,
      });

      return res.status(201).json({
        message: 'Orden creada exitosamente. Procede a realizar el pago QR.',
        order,
      });
    } catch (error: any) {
      console.error('Error al crear orden:', error);
      return res.status(400).json({ error: error.message || 'No se pudo crear la orden' });
    }
  }

  static async updateAttendees(req: Request, res: Response) {
    try {
      const { idOrNumber } = req.params;
      const { attendees } = req.body;

      if (!Array.isArray(attendees) || attendees.length === 0) {
        return res.status(400).json({ error: 'Debes proporcionar la lista de asistentes a actualizar' });
      }

      const order = await prisma.order.findFirst({
        where: {
          OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }],
        },
        include: { tickets: true, event: true },
      });

      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      // 1. Validar que ninguno de los boletos a modificar haya sido ya acreditado en puerta
      for (const item of attendees) {
        const ticketToUpdate = order.tickets.find(
          (t) => (item.id && t.id === item.id) || (item.ticketCode && t.ticketCode === item.ticketCode)
        );
        if (ticketToUpdate && ticketToUpdate.isCheckedIn) {
          return res.status(400).json({
            error: `El boleto ${ticketToUpdate.ticketCode} (${ticketToUpdate.attendeeName}) ya fue acreditado en puerta y no puede ser modificado.`,
          });
        }
      }

      // 2. Validar antiduplicados proyectados dentro de la orden completa
      const projectedTickets = order.tickets.map((t) => {
        const updateItem = attendees.find(
          (a: any) => (a.id && a.id === t.id) || (a.ticketCode && a.ticketCode === t.ticketCode)
        );
        return {
          id: t.id,
          name: (updateItem?.attendeeName?.trim() || t.attendeeName).trim(),
          doc: (updateItem?.attendeeDocumentId?.trim() || t.attendeeDocumentId).trim(),
        };
      });

      const seenDocs = new Set<string>();
      const seenNames = new Set<string>();

      for (const pt of projectedTickets) {
        if (!pt.name || pt.name.length < 2) {
          return res.status(400).json({ error: 'El nombre del asistente no puede estar vacío.' });
        }
        if (!pt.doc || pt.doc.length < 3) {
          return res.status(400).json({ error: 'La cédula de identidad / CI no puede estar vacía.' });
        }

        const normDoc = pt.doc.toLowerCase().replace(/\s+/g, '');
        const normName = pt.name.toLowerCase().replace(/\s+/g, ' ');

        if (seenDocs.has(normDoc)) {
          return res.status(400).json({
            error: `El carnet de identidad "${pt.doc}" está repetido en esta orden. Cada entrada debe tener un titular único.`,
          });
        }
        seenDocs.add(normDoc);

        if (seenNames.has(normName)) {
          return res.status(400).json({
            error: `El nombre "${pt.name}" está repetido en esta orden. Cada entrada debe tener un titular único.`,
          });
        }
        seenNames.add(normName);
      }

      const updatedTickets = [];
      for (const item of attendees) {
        const ticketToUpdate = order.tickets.find(
          (t) => (item.id && t.id === item.id) || (item.ticketCode && t.ticketCode === item.ticketCode)
        );
        if (ticketToUpdate) {
          const newName = item.attendeeName?.trim() || ticketToUpdate.attendeeName;
          const newDoc = item.attendeeDocumentId?.trim() || ticketToUpdate.attendeeDocumentId;

          let qrCodeData = ticketToUpdate.qrCodeData;
          if (order.status === 'APPROVED') {
            qrCodeData = QRService.createPayload({
              ticketCode: ticketToUpdate.ticketCode,
              orderNumber: order.orderNumber,
              attendeeName: newName,
              attendeeDocumentId: newDoc,
              eventName: order.event.title,
            });
          }

          const updated = await prisma.ticket.update({
            where: { id: ticketToUpdate.id },
            data: {
              attendeeName: newName,
              attendeeDocumentId: newDoc,
              qrCodeData,
              ...(item.attendeeEmail ? { attendeeEmail: item.attendeeEmail.trim() } : {}),
            },
          });
          updatedTickets.push(updated);
        }
      }

      return res.json({
        message: 'Asistentes actualizados con éxito',
        tickets: updatedTickets,
      });
    } catch (error: any) {
      console.error('Error al actualizar asistentes:', error);
      return res.status(500).json({ error: error.message || 'Error al actualizar asistentes' });
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

  static async reportWhatsAppReceipt(req: Request, res: Response) {
    try {
      const { orderIdOrNumber, referenceNumber } = req.body;

      if (!orderIdOrNumber) {
        return res.status(400).json({ error: 'El ID o código de la orden es requerido' });
      }

      const order = await prisma.order.findFirst({
        where: {
          OR: [{ id: orderIdOrNumber }, { orderNumber: orderIdOrNumber }],
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      if (order.status !== 'APPROVED') {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'PAYMENT_SUBMITTED',
            proofReferenceNumber: referenceNumber || 'Reportado vía WhatsApp',
            adminNotes: order.adminNotes
              ? `${order.adminNotes} | Comprobante enviado por WhatsApp`
              : 'Comprobante enviado por WhatsApp directamente al número de verificación.',
          },
        });
      }

      return res.json({
        message: 'Comprobante reportado por WhatsApp exitosamente.',
      });
    } catch (error: any) {
      console.error('Error al reportar comprobante por WhatsApp:', error);
      return res.status(500).json({ error: error.message || 'Error al reportar pago por WhatsApp' });
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

