import { Request, Response } from 'express';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { OrderService } from '../services/order.service.js';

export class AdminController {
  static async getDashboardStats(_req: Request, res: Response) {
    try {
      await OrderService.checkAndReleaseExpiredOrders();

      const [totalOrders, approvedOrders, pendingOrders, totalTickets, checkedInTickets, ticketTypes] =
        await Promise.all([
          prisma.order.count(),
          prisma.order.findMany({
            where: { status: OrderStatus.APPROVED },
            select: { totalAmount: true },
          }),
          prisma.order.count({
            where: { status: OrderStatus.PAYMENT_SUBMITTED },
          }),
          prisma.ticket.count({
            where: { order: { status: OrderStatus.APPROVED } },
          }),
          prisma.ticket.count({
            where: { isCheckedIn: true },
          }),
          prisma.ticketType.findMany({
            include: {
              _count: {
                select: { tickets: true },
              },
            },
          }),
        ]);

      const totalRevenue = approvedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

      return res.json({
        totalOrders,
        pendingApprovals: pendingOrders,
        approvedOrdersCount: approvedOrders.length,
        totalRevenue,
        totalTickets,
        checkedInTickets,
        checkInPercentage: totalTickets > 0 ? Math.round((checkedInTickets / totalTickets) * 100) : 0,
        ticketTypes,
      });
    } catch (error) {
      console.error('Error al obtener estadísticas del dashboard:', error);
      return res.status(500).json({ error: 'Error al consultar estadísticas' });
    }
  }

  static async getOrders(req: Request, res: Response) {
    try {
      const { status, search } = req.query;

      const whereClause: any = {};

      if (status && typeof status === 'string' && status !== 'ALL') {
        whereClause.status = status as OrderStatus;
      }

      if (search && typeof search === 'string') {
        whereClause.OR = [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { buyerName: { contains: search, mode: 'insensitive' } },
          { buyerEmail: { contains: search, mode: 'insensitive' } },
          { buyerDocumentId: { contains: search, mode: 'insensitive' } },
          { proofReferenceNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      const orders = await prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          orderItems: {
            include: { ticketType: true },
          },
          tickets: {
            include: { ticketType: true },
          },
        },
      });

      return res.json({ orders });
    } catch (error) {
      console.error('Error al listar órdenes:', error);
      return res.status(500).json({ error: 'Error al listar las órdenes' });
    }
  }

  static async approveOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { adminNotes } = req.body;

      const updatedOrder = await OrderService.approveOrder(id, adminNotes);

      return res.json({
        message: 'Orden aprobada con éxito. Boletos generados y correo enviado.',
        order: updatedOrder,
      });
    } catch (error: any) {
      console.error('Error al aprobar orden:', error);
      return res.status(400).json({ error: error.message || 'No se pudo aprobar la orden' });
    }
  }

  static async rejectOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'Debes proporcionar una razón para el rechazo' });
      }

      const updatedOrder = await OrderService.rejectOrder(id, reason);

      return res.json({
        message: 'Orden rechazada y cupos devueltos exitosamente.',
        order: updatedOrder,
      });
    } catch (error: any) {
      console.error('Error al rechazar orden:', error);
      return res.status(400).json({ error: error.message || 'No se pudo rechazar la orden' });
    }
  }

  static async updatePaymentSettings(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { bankName, accountType, accountNumber, accountHolder, holderId, instructions, isActive } =
        req.body;

      const updated = await prisma.paymentSetting.update({
        where: { id },
        data: {
          bankName,
          accountType,
          accountNumber,
          accountHolder,
          holderId,
          instructions,
          isActive,
        },
      });

      return res.json({
        message: 'Configuración bancaria actualizada',
        paymentSetting: updated,
      });
    } catch (error: any) {
      console.error('Error al actualizar datos bancarios:', error);
      return res.status(400).json({ error: 'No se pudo actualizar la configuración bancaria' });
    }
  }

  static async updateTicketType(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, price, totalQuota, remainingQuota, isActive } = req.body;

      const updated = await prisma.ticketType.update({
        where: { id },
        data: {
          name,
          description,
          price: price !== undefined ? Number(price) : undefined,
          totalQuota: totalQuota !== undefined ? Number(totalQuota) : undefined,
          remainingQuota: remainingQuota !== undefined ? Number(remainingQuota) : undefined,
          isActive,
        },
      });

      return res.json({
        message: 'Categoría de entrada actualizada exitosamente',
        ticketType: updated,
      });
    } catch (error: any) {
      console.error('Error al actualizar categoría de entrada:', error);
      return res.status(400).json({ error: 'No se pudo actualizar la categoría de entrada' });
    }
  }
}

