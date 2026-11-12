import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { prisma } from '../config/prisma.js';
import { OrderStatus } from '@prisma/client';
import { OrderService } from '../services/order.service.js';

const LOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutos de bloqueo

export class ValidatorController {
  static async getQueue(req: AuthRequest, res: Response) {
    try {
      const now = new Date();
      const lockThreshold = new Date(now.getTime() - LOCK_DURATION_MS);

      // Limpiar automáticamente bloqueos expirados
      await prisma.order.updateMany({
        where: {
          lockedAt: { lt: lockThreshold },
          status: OrderStatus.PAYMENT_SUBMITTED,
        },
        data: {
          lockedById: null,
          lockedAt: null,
        },
      });

      const orders = await prisma.order.findMany({
        where: {
          status: OrderStatus.PAYMENT_SUBMITTED,
        },
        include: {
          orderItems: {
            include: { ticketType: true },
          },
          tickets: {
            include: { ticketType: true },
          },
          lockedBy: {
            select: { id: true, name: true, email: true },
          },
          collectedBy: {
            select: { id: true, name: true, email: true },
          },
          event: true,
        },
        orderBy: { createdAt: 'asc' }, // FIFO: atender primero los más antiguos
      });

      const formattedOrders = orders.map((order) => {
        const isLocked = Boolean(order.lockedById && order.lockedAt && order.lockedAt > lockThreshold);
        const isLockedByMe = isLocked && order.lockedById === req.user?.id;
        const lockRemainingSeconds = isLocked && order.lockedAt
          ? Math.max(0, Math.floor((order.lockedAt.getTime() + LOCK_DURATION_MS - now.getTime()) / 1000))
          : 0;

        return {
          ...order,
          isLocked,
          isLockedByMe,
          lockRemainingSeconds,
        };
      });

      return res.json({ orders: formattedOrders });
    } catch (error: any) {
      console.error('[ValidatorController.getQueue]', error);
      return res.status(500).json({ error: 'Error al obtener la cola de validación' });
    }
  }

  static async claimOrder(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          lockedBy: { select: { id: true, name: true, email: true } },
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      if (order.status !== OrderStatus.PAYMENT_SUBMITTED) {
        return res.status(400).json({ error: `La orden ya no está pendiente de validación (Estado: ${order.status})` });
      }

      const now = new Date();
      const lockThreshold = new Date(now.getTime() - LOCK_DURATION_MS);
      const isLockedByOther =
        order.lockedById &&
        order.lockedById !== userId &&
        order.lockedAt &&
        order.lockedAt > lockThreshold;

      if (isLockedByOther) {
        const lockRemaining = Math.ceil((order.lockedAt!.getTime() + LOCK_DURATION_MS - now.getTime()) / 1000);
        return res.status(409).json({
          error: `Esta orden está siendo revisada por ${order.lockedBy?.name || 'otro validador'}. El bloqueo expira en ${lockRemaining} segundos.`,
          lockedBy: order.lockedBy,
        });
      }

      const updated = await prisma.order.update({
        where: { id },
        data: {
          lockedById: userId,
          lockedAt: now,
        },
        include: {
          lockedBy: { select: { id: true, name: true, email: true } },
          tickets: { include: { ticketType: true } },
          event: true,
        },
      });

      return res.json({
        message: 'Orden tomada para revisión exitosamente',
        order: {
          ...updated,
          isLocked: true,
          isLockedByMe: true,
          lockRemainingSeconds: Math.floor(LOCK_DURATION_MS / 1000),
        },
      });
    } catch (error: any) {
      console.error('[ValidatorController.claimOrder]', error);
      return res.status(500).json({ error: 'Error al tomar la orden para revisión' });
    }
  }

  static async releaseOrder(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'ADMIN';

      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      if (order.lockedById && order.lockedById !== userId && !isAdmin) {
        return res.status(403).json({ error: 'No puedes liberar una orden tomada por otro validador' });
      }

      const updated = await prisma.order.update({
        where: { id },
        data: {
          lockedById: null,
          lockedAt: null,
        },
      });

      return res.json({ message: 'Orden liberada para el equipo', order: updated });
    } catch (error: any) {
      console.error('[ValidatorController.releaseOrder]', error);
      return res.status(500).json({ error: 'Error al liberar la orden' });
    }
  }

  static async approveOrder(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { adminNotes } = req.body;
      const userId = req.user?.id;

      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      const now = new Date();
      const lockThreshold = new Date(now.getTime() - LOCK_DURATION_MS);
      const isLockedByOther =
        order.lockedById &&
        order.lockedById !== userId &&
        order.lockedAt &&
        order.lockedAt > lockThreshold &&
        req.user?.role !== 'ADMIN';

      if (isLockedByOther) {
        return res.status(409).json({ error: 'Esta orden está tomada por otro validador' });
      }

      const updated = await OrderService.approveOrder(id, adminNotes, userId);
      return res.json({ message: 'Comprobante aprobado y orden confirmada exitosamente', order: updated });
    } catch (error: any) {
      console.error('[ValidatorController.approveOrder]', error);
      return res.status(400).json({ error: error.message || 'Error al aprobar la orden' });
    }
  }

  static async rejectOrder(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Debes indicar el motivo de rechazo del comprobante' });
      }

      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      const updated = await OrderService.rejectOrder(id, reason.trim(), userId);
      return res.json({ message: 'Comprobante rechazado y cupo restaurado', order: updated });
    } catch (error: any) {
      console.error('[ValidatorController.rejectOrder]', error);
      return res.status(400).json({ error: error.message || 'Error al rechazar la orden' });
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [pendingCount, myApprovedToday, myRejectedToday, totalApprovedToday] = await Promise.all([
        prisma.order.count({ where: { status: OrderStatus.PAYMENT_SUBMITTED } }),
        prisma.order.count({
          where: {
            status: OrderStatus.APPROVED,
            reviewedById: userId,
            reviewedAt: { gte: today },
          },
        }),
        prisma.order.count({
          where: {
            status: OrderStatus.REJECTED,
            reviewedById: userId,
            reviewedAt: { gte: today },
          },
        }),
        prisma.order.count({
          where: {
            status: OrderStatus.APPROVED,
            reviewedAt: { gte: today },
          },
        }),
      ]);

      return res.json({
        pendingQueueCount: pendingCount,
        myApprovedToday,
        myRejectedToday,
        myTotalToday: myApprovedToday + myRejectedToday,
        teamTotalApprovedToday: totalApprovedToday,
      });
    } catch (error: any) {
      console.error('[ValidatorController.getStats]', error);
      return res.status(500).json({ error: 'Error al obtener estadísticas del validador' });
    }
  }
}

