import { prisma } from '../config/prisma.js';

export interface QueueItem {
  id: string;
  phone: string;
  attendeeName: string;
  ticketCode: string;
  orderNumber: string;
  eventName: string;
  eventDate: Date | string;
  eventVenue: string;
  eventLocation: string;
  ticketTypeName: string;
  attendeeDocumentId: string;
  qrDataUrl?: string;
  addedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  waMeUrl?: string;
  processedAt?: Date;
}

export interface QueueConfig {
  minDelaySeconds: number;
  maxDelaySeconds: number;
  simulateTyping: boolean;
  typingDurationSeconds: number;
  maxDailyThreshold: number;
  isPaused: boolean;
}

export class WhatsAppQueueService {
  private static queue: QueueItem[] = [];
  private static isProcessing = false;
  private static sentTodayCount = 0;
  private static lastSentDate = new Date().toDateString();

  private static config: QueueConfig = {
    minDelaySeconds: 8,
    maxDelaySeconds: 15,
    simulateTyping: true,
    typingDurationSeconds: 3,
    maxDailyThreshold: 250,
    isPaused: false,
  };

  /**
   * Genera texto con spintax dinámico para romper patrones de duplicidad
   */
  static generateVariedText(item: QueueItem): string {
    const greetings = [
      `¡Hola, *${item.attendeeName}*!`,
      `¡Un gusto saludarte, *${item.attendeeName}*!`,
      `¡Estimado/a *${item.attendeeName}*, bienvenido/a!`,
      `¡Hola *${item.attendeeName}*, te saluda el equipo de TEDx!`,
    ];

    const confirmations = [
      `Tu entrada para *${item.eventName}* ha sido validada y confirmada exitosamente.`,
      `Confirmamos oficialmente tu pase de ingreso para *${item.eventName}*.`,
      `Ya se encuentra emitida tu credencial digital para *${item.eventName}*.`,
      `¡Todo listo! Tu registro para *${item.eventName}* está 100% aprobado.`,
    ];

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const ticketUrl = `${clientUrl}/?ticket=${encodeURIComponent(item.ticketCode)}`;
    const eventDate = new Date(item.eventDate).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Selección aleatoria para evitar detección de plantillas masivas
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    const confirmation = confirmations[Math.floor(Math.random() * confirmations.length)];
    const uniqueRef = `REF-${item.ticketCode.slice(-4)}-${Date.now().toString(36).slice(-3).toUpperCase()}`;

    return `${greeting}

${confirmation}

📅 *Fecha:* ${eventDate}
📍 *Lugar:* ${item.eventVenue}, ${item.eventLocation}
🎟️ *Categoría:* ${item.ticketTypeName}
🆔 *Documento:* ${item.attendeeDocumentId}
🔖 *Boleto N°:* ${item.ticketCode}

📲 *Ver tu Credencial Digital Oficial:*
${ticketUrl}

_Presenta el código QR adjunto en la puerta de acreditación para tu ingreso rápido._

#TEDxInnova2026 • _Verif: ${uniqueRef}_`;
  }

  /**
   * Añade un boleto a la cola segura de despacho anti-bloqueo
   */
  static enqueue(params: {
    phone: string;
    attendeeName: string;
    ticketCode: string;
    orderNumber: string;
    eventName: string;
    eventDate: Date | string;
    eventVenue: string;
    eventLocation: string;
    ticketTypeName: string;
    attendeeDocumentId: string;
    qrDataUrl?: string;
  }): QueueItem {
    const item: QueueItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...params,
      addedAt: new Date(),
      status: 'pending',
    };

    this.queue.push(item);
    this.processNext();
    return item;
  }

  /**
   * Bucle de procesamiento secuencial con pausas humanizadas y presencia
   */
  private static async processNext() {
    if (this.isProcessing || this.config.isPaused) return;

    const nextItem = this.queue.find((i) => i.status === 'pending');
    if (!nextItem) return;

    this.isProcessing = true;
    nextItem.status = 'processing';

    try {
      const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const apiKey = process.env.EVOLUTION_API_KEY || 'fixed-api-key-12345';
      const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'senordelastintas';

      // 1. Simulación de presencia "composing" (Escribiendo...)
      if (this.config.simulateTyping) {
        try {
          await fetch(`${apiUrl}/chat/sendPresence/${instanceName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: apiKey,
            },
            body: JSON.stringify({
              number: nextItem.phone,
              presence: 'composing',
              delay: this.config.typingDurationSeconds * 1000,
            }),
          });
          // Esperar el tiempo de tipeo humano simulado
          await new Promise((r) => setTimeout(r, this.config.typingDurationSeconds * 1000));
        } catch (presenceErr) {
          console.warn('[AntiBanQueue] Error enviando presencia:', presenceErr);
        }
      }

      // 2. Generar texto con variación spintax
      const messageText = this.generateVariedText(nextItem);
      nextItem.waMeUrl = `https://wa.me/${nextItem.phone}?text=${encodeURIComponent(messageText)}`;

      // 3. Despachar a través de Evolution API
      let sentSuccess = false;

      if (nextItem.qrDataUrl) {
        // Enviar con imagen QR adjunta
        try {
          const mediaRes = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: apiKey,
            },
            body: JSON.stringify({
              number: nextItem.phone,
              media: nextItem.qrDataUrl,
              mediatype: 'image',
              caption: messageText,
              fileName: `TEDx-Ticket-${nextItem.ticketCode}.png`,
            }),
          });

          if (mediaRes.ok) {
            sentSuccess = true;
          }
        } catch (mediaErr) {
          console.warn('[AntiBanQueue] Falló envío media, reintentando como texto:', mediaErr);
        }
      }

      // Fallback a texto plano si media falla o no hay imagen
      if (!sentSuccess) {
        const textRes = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: apiKey,
          },
          body: JSON.stringify({
            number: nextItem.phone,
            text: messageText,
          }),
        });

        if (textRes.ok) {
          sentSuccess = true;
        } else {
          const errData: any = await textRes.json().catch(() => ({}));
          throw new Error(errData.message || 'Evolution API rechazó el mensaje');
        }
      }

      nextItem.status = 'completed';
      nextItem.processedAt = new Date();
      this.sentTodayCount++;

      // 4. Actualizar contadores en base de datos
      try {
        await prisma.ticket.updateMany({
          where: { ticketCode: nextItem.ticketCode },
          data: {
            whatsappSentCount: { increment: 1 },
            whatsappSentAt: new Date(),
          },
        });
        await prisma.order.updateMany({
          where: { orderNumber: nextItem.orderNumber },
          data: {
            whatsappSentCount: { increment: 1 },
            whatsappSentAt: new Date(),
          },
        });
      } catch (dbErr) {
        console.warn('[AntiBanQueue] Error actualizando BD:', dbErr);
      }
    } catch (err: any) {
      console.error('[AntiBanQueue] Error procesando mensaje:', err.message);
      nextItem.status = 'failed';
      nextItem.error = err.message;
    } finally {
      this.isProcessing = false;

      // 5. Aplicar intervalo aleatorio humanizado (Jitter) antes del siguiente mensaje
      const minMs = this.config.minDelaySeconds * 1000;
      const maxMs = this.config.maxDelaySeconds * 1000;
      const jitterMs = Math.floor(minMs + Math.random() * (maxMs - minMs));

      console.log(`[AntiBanQueue] Pausa de seguridad anti-bloqueo: ${(jitterMs / 1000).toFixed(1)}s antes del próximo envío.`);
      setTimeout(() => {
        this.processNext();
      }, jitterMs);
    }
  }

  /**
   * Obtiene métricas y estado en tiempo real de la cola
   */
  static getStats() {
    const today = new Date().toDateString();
    if (this.lastSentDate !== today) {
      this.sentTodayCount = 0;
      this.lastSentDate = today;
    }

    const pending = this.queue.filter((i) => i.status === 'pending');
    const processing = this.queue.filter((i) => i.status === 'processing');
    const completed = this.queue.filter((i) => i.status === 'completed');
    const failed = this.queue.filter((i) => i.status === 'failed');

    const estimatedRemainingSeconds = pending.length * ((this.config.minDelaySeconds + this.config.maxDelaySeconds) / 2);

    return {
      queueLength: this.queue.length,
      pendingCount: pending.length,
      isProcessing: this.isProcessing,
      processingItem: processing[0] || null,
      completedCount: completed.length,
      failedCount: failed.length,
      sentTodayCount: this.sentTodayCount,
      estimatedRemainingSeconds,
      config: this.config,
      recentItems: this.queue.slice(-10).reverse(),
    };
  }

  /**
   * Actualiza los parámetros de seguridad anti-bloqueo
   */
  static updateConfig(newConfig: Partial<QueueConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (!this.config.isPaused && !this.isProcessing) {
      this.processNext();
    }
    return this.config;
  }

  /**
   * Limpia elementos completados o cancela la cola
   */
  static clearCompleted() {
    this.queue = this.queue.filter((i) => i.status === 'pending' || i.status === 'processing');
    return this.getStats();
  }
}
