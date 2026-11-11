import { OrderStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { QRService } from './qr.service.js';
import { EmailService } from './email.service.js';

export interface CreateOrderItemInput {
  ticketTypeId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeeDocumentId: string;
}

export interface CreateOrderInput {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerDocumentId: string;
  attendees: CreateOrderItemInput[];
}

export class OrderService {
  static generateOrderNumber(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `TEDX-${code}`;
  }

  static generateTicketCode(orderNumber: string, index: number): string {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${orderNumber}-T${index + 1}-${randomSuffix}`;
  }

  static async checkAndReleaseExpiredOrders(): Promise<number> {
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        expiresAt: { lt: new Date() },
      },
      include: {
        orderItems: true,
      },
    });

    if (expiredOrders.length === 0) return 0;

    for (const order of expiredOrders) {
      await prisma.$transaction(async (tx) => {
        for (const item of order.orderItems) {
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: {
              remainingQuota: { increment: item.quantity },
            },
          });
        }
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELLED,
            adminNotes: 'Orden cancelada automáticamente por expiración del tiempo límite de pago.',
          },
        });
      });
    }

    return expiredOrders.length;
  }

  static async createOrder(input: CreateOrderInput) {
    if (!input.attendees || input.attendees.length === 0) {
      throw new Error('Debes incluir al menos un asistente/boleto en la orden');
    }

    const countsByType: Record<string, number> = {};
    for (const a of input.attendees) {
      countsByType[a.ticketTypeId] = (countsByType[a.ticketTypeId] || 0) + 1;
    }

    return await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const orderItemsData = [];

      for (const [ticketTypeId, qty] of Object.entries(countsByType)) {
        const ticketType = await tx.ticketType.findUnique({
          where: { id: ticketTypeId },
        });

        if (!ticketType || !ticketType.isActive) {
          throw new Error(`La categoría de boleto seleccionada no está disponible`);
        }

        if (ticketType.remainingQuota < qty) {
          throw new Error(
            `No hay suficientes cupos disponibles para ${ticketType.name} (Disponibles: ${ticketType.remainingQuota}, solicitados: ${qty})`
          );
        }

        await tx.ticketType.update({
          where: { id: ticketTypeId },
          data: {
            remainingQuota: { decrement: qty },
          },
        });

        const subtotal = ticketType.price * qty;
        totalAmount += subtotal;

        orderItemsData.push({
          ticketTypeId,
          quantity: qty,
          unitPrice: ticketType.price,
          subtotal,
        });
      }

      let orderNumber = this.generateOrderNumber();
      let exists = await tx.order.findUnique({ where: { orderNumber } });
      while (exists) {
        orderNumber = this.generateOrderNumber();
        exists = await tx.order.findUnique({ where: { orderNumber } });
      }

      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

      const order = await tx.order.create({
        data: {
          orderNumber,
          eventId: input.eventId,
          buyerName: input.buyerName,
          buyerEmail: input.buyerEmail,
          buyerPhone: input.buyerPhone,
          buyerDocumentId: input.buyerDocumentId,
          totalAmount,
          status: OrderStatus.PENDING_PAYMENT,
          expiresAt,
          orderItems: {
            create: orderItemsData,
          },
        },
        include: {
          orderItems: {
            include: { ticketType: true },
          },
          event: true,
        },
      });

      const tickets = [];
      for (let i = 0; i < input.attendees.length; i++) {
        const attendee = input.attendees[i];
        const ticketCode = this.generateTicketCode(orderNumber, i);

        const ticket = await tx.ticket.create({
          data: {
            ticketCode,
            orderId: order.id,
            ticketTypeId: attendee.ticketTypeId,
            attendeeName: attendee.attendeeName,
            attendeeEmail: attendee.attendeeEmail,
            attendeeDocumentId: attendee.attendeeDocumentId,
            qrCodeData: '',
          },
        });
        tickets.push(ticket);
      }

      return {
        ...order,
        tickets,
      };
    });
  }

  static async submitReceipt(orderIdOrNumber: string, receiptUrl: string, referenceNumber?: string) {
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: orderIdOrNumber }, { orderNumber: orderIdOrNumber }],
      },
    });

    if (!order) {
      throw new Error('Orden no encontrada');
    }

    if (order.status === OrderStatus.APPROVED) {
      throw new Error('Esta orden ya fue aprobada');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new Error('Esta orden está cancelada o expiró el tiempo de reserva');
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        proofReceiptUrl: receiptUrl,
        proofReferenceNumber: referenceNumber || null,
        status: OrderStatus.PAYMENT_SUBMITTED,
      },
      include: {
        tickets: {
          include: { ticketType: true },
        },
        event: true,
      },
    });

    return updated;
  }

  static async approveOrder(orderId: string, adminNotes?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: {
          include: { ticketType: true },
        },
        event: true,
      },
    });

    if (!order) {
      throw new Error('Orden no encontrada');
    }

    if (order.status === OrderStatus.APPROVED) {
      throw new Error('La orden ya fue aprobada previamente');
    }

    const emailTicketsData = [];

    for (const ticket of order.tickets) {
      const qrPayload = QRService.createPayload({
        ticketCode: ticket.ticketCode,
        orderNumber: order.orderNumber,
        attendeeName: ticket.attendeeName,
        attendeeDocumentId: ticket.attendeeDocumentId,
        eventName: order.event.title,
      });

      const qrDataUrl = await QRService.generateQRCodeDataUrl(qrPayload);

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          qrCodeData: qrPayload,
        },
      });

      emailTicketsData.push({
        ticketCode: ticket.ticketCode,
        ticketType: ticket.ticketType.name,
        attendeeName: ticket.attendeeName,
        attendeeDocumentId: ticket.attendeeDocumentId,
        qrDataUrl,
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.APPROVED,
        adminNotes: adminNotes || order.adminNotes,
      },
      include: {
        tickets: {
          include: { ticketType: true },
        },
        event: true,
      },
    });

    const eventDateFormatted = new Date(order.event.date).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    await EmailService.sendApprovedTickets({
      to: order.buyerEmail,
      buyerName: order.buyerName,
      orderNumber: order.orderNumber,
      eventTitle: order.event.title,
      eventDate: eventDateFormatted,
      eventVenue: `${order.event.venue}, ${order.event.location}`,
      tickets: emailTicketsData,
    });

    return updatedOrder;
  }

  static async rejectOrder(orderId: string, reason: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
      },
    });

    if (!order) {
      throw new Error('Orden no encontrada');
    }

    if (order.status === OrderStatus.APPROVED) {
      throw new Error('No se puede rechazar una orden que ya fue aprobada');
    }

    return await prisma.$transaction(async (tx) => {
      if (order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.REJECTED) {
        for (const item of order.orderItems) {
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: {
              remainingQuota: { increment: item.quantity },
            },
          });
        }
      }

      return await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.REJECTED,
          adminNotes: reason || 'Comprobante no válido o pago no identificado en la cuenta bancaria.',
        },
      });
    });
  }
}
