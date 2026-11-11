import { Response } from 'express';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

export class CheckInController {
  static async validateTicket(req: AuthRequest, res: Response) {
    try {
      const { codeOrPayload } = req.body;

      if (!codeOrPayload || typeof codeOrPayload !== 'string') {
        return res.status(400).json({ error: 'Código o carga útil del boleto no proporcionada' });
      }

      let ticketCode = codeOrPayload.trim();
      try {
        if (codeOrPayload.startsWith('{') && codeOrPayload.endsWith('}')) {
          const parsed = JSON.parse(codeOrPayload);
          if (parsed.code) {
            ticketCode = parsed.code;
          }
        }
      } catch {
      }

      const ticket = await prisma.ticket.findUnique({
        where: { ticketCode },
        include: {
          ticketType: true,
          order: {
            include: { event: true },
          },
          checkedInBy: {
            select: { name: true, email: true },
          },
        },
      });

      if (!ticket) {
        return res.status(404).json({
          status: 'INVALID',
          error: 'Boleto no encontrado en el sistema. Verifica el código.',
        });
      }

      if (ticket.order.status !== OrderStatus.APPROVED) {
        return res.status(400).json({
          status: 'UNPAID',
          error: `Este boleto pertenece a una orden que no está aprobada (Estado: ${ticket.order.status})`,
          ticket: {
            attendeeName: ticket.attendeeName,
            attendeeDocumentId: ticket.attendeeDocumentId,
            orderNumber: ticket.order.orderNumber,
          },
        });
      }

      if (ticket.isCheckedIn) {
        const timeStr = ticket.checkedInAt
          ? new Date(ticket.checkedInAt).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          : 'previamente';

        return res.status(409).json({
          status: 'ALREADY_USED',
          error: `¡Atención! Este boleto ya fue ingresado a las ${timeStr} por ${
            ticket.checkedInBy?.name || 'Staff'
          }`,
          ticket: {
            ticketCode: ticket.ticketCode,
            attendeeName: ticket.attendeeName,
            attendeeDocumentId: ticket.attendeeDocumentId,
            ticketType: ticket.ticketType.name,
            checkedInAt: ticket.checkedInAt,
          },
        });
      }

      const updatedTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          isCheckedIn: true,
          checkedInAt: new Date(),
          checkedInById: req.user?.id,
        },
        include: {
          ticketType: true,
          checkedInBy: {
            select: { name: true },
          },
        },
      });

      return res.json({
        status: 'SUCCESS',
        message: '¡Acreditación Exitosa! Acceso Autorizado.',
        ticket: {
          ticketCode: updatedTicket.ticketCode,
          attendeeName: updatedTicket.attendeeName,
          attendeeDocumentId: updatedTicket.attendeeDocumentId,
          attendeeEmail: updatedTicket.attendeeEmail,
          ticketType: updatedTicket.ticketType.name,
          checkedInAt: updatedTicket.checkedInAt,
          checkedInBy: updatedTicket.checkedInBy?.name,
        },
      });
    } catch (error) {
      console.error('Error al validar check-in de boleto:', error);
      return res.status(500).json({ error: 'Error interno al procesar el check-in' });
    }
  }

  static async searchAttendees(req: AuthRequest, res: Response) {
    try {
      const { query } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.status(400).json({ error: 'Ingresa al menos 2 caracteres para buscar' });
      }

      const tickets = await prisma.ticket.findMany({
        where: {
          order: { status: OrderStatus.APPROVED },
          OR: [
            { ticketCode: { contains: query, mode: 'insensitive' } },
            { attendeeName: { contains: query, mode: 'insensitive' } },
            { attendeeDocumentId: { contains: query, mode: 'insensitive' } },
            { attendeeEmail: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          ticketType: true,
          checkedInBy: { select: { name: true } },
        },
        take: 20,
      });

      return res.json({ attendees: tickets });
    } catch (error) {
      console.error('Error al buscar asistentes:', error);
      return res.status(500).json({ error: 'Error al buscar asistentes' });
    }
  }
}

