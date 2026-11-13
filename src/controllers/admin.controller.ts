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

  static async getPaymentSettings(_req: Request, res: Response) {
    try {
      let setting = await prisma.paymentSetting.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!setting) {
        setting = await prisma.paymentSetting.create({
          data: {
            instructions: 'Escanea el código QR desde tu app bancaria móvil, transfiere el monto exacto y adjunta tu comprobante.',
            isActive: true,
          },
        });
      }
      return res.json({ paymentSetting: setting });
    } catch (error: any) {
      console.error('Error al obtener configuración de pago:', error);
      return res.status(500).json({ error: 'Error al obtener la configuración de pago' });
    }
  }

  static async updatePaymentSettings(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        bankName,
        accountType,
        accountNumber,
        accountHolder,
        holderId,
        instructions,
        isActive,
        qrImageUrl,
        whatsappContactNumber,
      } = req.body;

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
          ...(qrImageUrl !== undefined ? { qrImageUrl } : {}),
          ...(whatsappContactNumber !== undefined ? { whatsappContactNumber } : {}),
        },
      });

      return res.json({
        message: 'Configuración de pago actualizada',
        paymentSetting: updated,
      });
    } catch (error: any) {
      console.error('Error al actualizar configuración de pago:', error);
      return res.status(400).json({ error: 'No se pudo actualizar la configuración de pago' });
    }
  }

  static async uploadPaymentQr(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: 'Debes proporcionar una imagen válida para el código QR' });
      }

      const qrImageUrl = `/uploads/${req.file.filename}`;
      const updated = await prisma.paymentSetting.update({
        where: { id },
        data: { qrImageUrl },
      });

      return res.json({
        message: 'Código QR de pago subido correctamente',
        paymentSetting: updated,
        qrImageUrl,
      });
    } catch (error: any) {
      console.error('Error al subir QR de pago:', error);
      return res.status(500).json({ error: 'Error al subir el código QR de pago' });
    }
  }

  static async getTicketTypes(_req: Request, res: Response) {
    try {
      const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
      if (!activeEvent) {
        return res.json({ ticketTypes: [] });
      }

      const ticketTypes = await prisma.ticketType.findMany({
        where: { eventId: activeEvent.id },
        orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
      });

      return res.json({ ticketTypes });
    } catch (error: any) {
      console.error('Error al listar tipos de boletos:', error);
      return res.status(500).json({ error: 'Error al listar categorías de entrada' });
    }
  }

  static async createTicketType(req: Request, res: Response) {
    try {
      const { name, description, price, totalQuota, eventId } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'El nombre de la entrada es obligatorio' });
      }

      if (price === undefined || price === null || price === '' || isNaN(Number(price)) || Number(price) < 0) {
        return res.status(400).json({ error: 'El precio debe ser un número mayor o igual a 0' });
      }

      let targetEventId = eventId;
      if (!targetEventId) {
        const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
        if (!activeEvent) {
          return res.status(404).json({ error: 'No se encontró un evento activo al cual asignar la entrada' });
        }
        targetEventId = activeEvent.id;
      }

      // Si no se especifica cupo, se asigna 500 cupos disponibles por defecto
      let quota = 500;
      if (totalQuota !== undefined && totalQuota !== null && !isNaN(Number(totalQuota)) && Number(totalQuota) > 0) {
        quota = Math.floor(Number(totalQuota));
      }

      const ticketPrice = Number(price);

      const created = await prisma.ticketType.create({
        data: {
          eventId: targetEventId,
          name: name.trim(),
          description: description ? description.trim() : null,
          price: ticketPrice,
          totalQuota: quota,
          remainingQuota: quota,
          isActive: true,
        },
      });

      return res.status(201).json({
        message: 'Categoría de entrada creada exitosamente',
        ticketType: created,
      });
    } catch (error: any) {
      console.error('Error al crear categoría de entrada:', error);
      return res.status(500).json({ error: 'Error interno al crear categoría de entrada' });
    }
  }

  static async updateTicketType(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, price, totalQuota, remainingQuota, isActive } = req.body;

      const existing = await prisma.ticketType.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Categoría de entrada no encontrada' });
      }

      const dataToUpdate: any = {};
      if (name !== undefined && typeof name === 'string' && name.trim()) {
        dataToUpdate.name = name.trim();
      }
      if (description !== undefined) {
        dataToUpdate.description = description ? description.trim() : null;
      }
      if (price !== undefined && price !== null && price !== '' && !isNaN(Number(price)) && Number(price) >= 0) {
        dataToUpdate.price = Number(price);
      }
      if (totalQuota !== undefined && !isNaN(Number(totalQuota)) && Number(totalQuota) > 0) {
        const parsedTotal = Math.floor(Number(totalQuota));
        dataToUpdate.totalQuota = parsedTotal;
        const diff = parsedTotal - existing.totalQuota;
        dataToUpdate.remainingQuota = Math.max(0, existing.remainingQuota + diff);
      } else if (remainingQuota !== undefined && !isNaN(Number(remainingQuota))) {
        dataToUpdate.remainingQuota = Math.floor(Number(remainingQuota));
      }
      if (isActive !== undefined) {
        dataToUpdate.isActive = Boolean(isActive);
      }

      const updated = await prisma.ticketType.update({
        where: { id },
        data: dataToUpdate,
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

  static async deleteTicketType(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const existing = await prisma.ticketType.findUnique({
        where: { id },
        include: { _count: { select: { tickets: true, orderItems: true } } },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Categoría de entrada no encontrada' });
      }

      // Si ya tiene boletos vendidos u órdenes asociadas, desactivamos en vez de borrar para preservar integridad contable
      if (existing._count.tickets > 0 || existing._count.orderItems > 0) {
        await prisma.ticketType.update({
          where: { id },
          data: { isActive: false, remainingQuota: 0 },
        });
        return res.json({
          message: 'La categoría tiene boletos u órdenes registradas, por lo que fue desactivada de la venta pública',
          softDeleted: true,
        });
      }

      await prisma.ticketType.delete({ where: { id } });
      return res.json({
        message: 'Categoría de entrada eliminada exitosamente',
        softDeleted: false,
      });
    } catch (error: any) {
      console.error('Error al eliminar categoría de entrada:', error);
      return res.status(500).json({ error: 'No se pudo eliminar la categoría de entrada' });
    }
  }
}

