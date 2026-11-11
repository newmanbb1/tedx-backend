import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { OrderService } from '../services/order.service.js';

export class EventController {
  static async getPublicEvent(_req: Request, res: Response) {
    try {
      await OrderService.checkAndReleaseExpiredOrders();

      const event = await prisma.event.findFirst({
        where: { isActive: true },
        include: {
          ticketTypes: {
            where: { isActive: true },
            orderBy: { price: 'asc' },
          },
        },
      });

      if (!event) {
        return res.status(404).json({ error: 'No hay eventos activos disponibles' });
      }

      const paymentSettings = await prisma.paymentSetting.findMany({
        where: { isActive: true },
      });

      return res.json({
        event,
        paymentSettings,
      });
    } catch (error) {
      console.error('Error al obtener evento público:', error);
      return res.status(500).json({ error: 'Error al consultar datos del evento' });
    }
  }
}

