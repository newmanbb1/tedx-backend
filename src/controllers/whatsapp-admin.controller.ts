import { Request, Response } from 'express';
import { z } from 'zod';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { WhatsAppQueueService } from '../services/whatsapp-queue.service.js';
import { prisma } from '../config/prisma.js';

const sendTestSchema = z.object({
  phone: z.string().min(8, 'El número de teléfono debe tener al menos 8 dígitos'),
  message: z.string().optional(),
});

const pairingCodeSchema = z.object({
  phone: z.string().min(8, 'El número de teléfono debe tener al menos 8 dígitos'),
});

const queueConfigSchema = z.object({
  minDelaySeconds: z.number().min(3).max(60).optional(),
  maxDelaySeconds: z.number().min(5).max(120).optional(),
  simulateTyping: z.boolean().optional(),
  typingDurationSeconds: z.number().min(1).max(15).optional(),
  maxDailyThreshold: z.number().min(50).max(1000).optional(),
  isPaused: z.boolean().optional(),
});

export class WhatsAppAdminController {
  /**
   * Obtiene el estado actual de la instancia de WhatsApp y métricas de despacho
   */
  static async getStatus(_req: Request, res: Response) {
    try {
      const status = await WhatsAppService.getInstanceStatus();

      // Métricas desde la base de datos
      const [totalTicketsDispatched, totalOrdersDispatched] = await Promise.all([
        prisma.ticket.count({
          where: { whatsappSentCount: { gt: 0 } },
        }),
        prisma.order.count({
          where: { whatsappSentCount: { gt: 0 } },
        }),
      ]);

      const queueStats = WhatsAppQueueService.getStats();

      return res.json({
        ...status,
        totalTicketsDispatched,
        totalOrdersDispatched,
        queueStats,
      });
    } catch (error: any) {
      console.error('[WhatsAppAdminController] Error al obtener estado:', error);
      return res.status(500).json({ error: error.message || 'Error interno al consultar WhatsApp API' });
    }
  }

  /**
   * Obtiene el código QR en base64 para vincular WhatsApp en el panel
   */
  static async getQR(_req: Request, res: Response) {
    try {
      const qrData = await WhatsAppService.getConnectQR();
      return res.json(qrData);
    } catch (error: any) {
      console.error('[WhatsAppAdminController] Error al obtener QR:', error);
      return res.status(500).json({ error: error.message || 'Error al obtener código QR de WhatsApp' });
    }
  }

  /**
   * Genera un Código de Emparejamiento por número telefónico (8 dígitos)
   */
  static async getPairingCode(req: Request, res: Response) {
    try {
      const parsed = pairingCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const result = await WhatsAppService.getPairingCode(parsed.data.phone);
      return res.json(result);
    } catch (error: any) {
      console.error('[WhatsAppAdminController] Error al generar pairing code:', error);
      return res.status(500).json({ error: error.message || 'Error al generar código de emparejamiento' });
    }
  }

  /**
   * Reinicia la instancia en Evolution API
   */
  static async restart(_req: Request, res: Response) {
    try {
      const result = await WhatsAppService.restartInstance();
      return res.json({
        message: 'Instancia de WhatsApp reiniciada correctamente',
        data: result,
      });
    } catch (error: any) {
      console.error('[WhatsAppAdminController] Error al reiniciar instancia:', error);
      return res.status(500).json({ error: error.message || 'Error al reiniciar instancia' });
    }
  }

  /**
   * Desvincula / cierra la sesión de WhatsApp
   */
  static async logout(_req: Request, res: Response) {
    try {
      await WhatsAppService.logoutInstance();
      return res.json({
        message: 'Sesión de WhatsApp cerrada y dispositivo desvinculado exitosamente.',
      });
    } catch (error: any) {
      console.error('[WhatsAppAdminController] Error al desvincular:', error);
      return res.status(500).json({ error: error.message || 'Error al desvincular dispositivo' });
    }
  }

  /**
   * Envía un mensaje de prueba
   */
  static async sendTest(req: Request, res: Response) {
    try {
      const parsed = sendTestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const { phone, message } = parsed.data;
      const result = await WhatsAppService.sendTestMessage(phone, message);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.json(result);
    } catch (error: any) {
      console.error('[WhatsAppAdminController] Error al enviar prueba:', error);
      return res.status(500).json({ error: error.message || 'Error al procesar mensaje de prueba' });
    }
  }

  /**
   * Métricas y estado de la cola anti-baneo
   */
  static async getQueueStats(_req: Request, res: Response) {
    return res.json(WhatsAppQueueService.getStats());
  }

  /**
   * Actualiza la configuración de la cola anti-baneo
   */
  static async updateQueueConfig(req: Request, res: Response) {
    try {
      const parsed = queueConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const updated = WhatsAppQueueService.updateConfig(parsed.data);
      return res.json({ message: 'Configuración de seguridad anti-bloqueo actualizada', config: updated });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Error al actualizar configuración' });
    }
  }

  /**
   * Limpia elementos procesados de la cola
   */
  static async clearQueue(_req: Request, res: Response) {
    const stats = WhatsAppQueueService.clearCompleted();
    return res.json({ message: 'Cola de mensajes limpiada', stats });
  }
}

