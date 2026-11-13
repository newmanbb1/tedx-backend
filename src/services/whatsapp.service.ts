import { QRService } from './qr.service.js';
import { WhatsAppQueueService } from './whatsapp-queue.service.js';

export interface SendTicketWhatsAppParams {
  phone: string;
  ticket: {
    id: string;
    ticketCode: string;
    attendeeName: string;
    attendeeDocumentId: string;
    qrCodeData?: string;
    ticketType: {
      name: string;
    };
  };
  event: {
    title: string;
    date: Date | string;
    venue: string;
    location: string;
  };
  orderNumber: string;
  forceImmediate?: boolean;
}

export interface WhatsAppSendResult {
  success: boolean;
  message: string;
  waMeUrl: string;
  formattedPhone: string;
  apiResponse?: any;
  queued?: boolean;
}

export class WhatsAppService {
  /**
   * Normaliza números telefónicos.
   * Si tiene 8 dígitos (Bolivia), le antepone el prefijo internacional 591.
   */
  static formatPhoneNumber(rawPhone: string): string {
    if (!rawPhone) return '';
    // Eliminar espacios, guiones, paréntesis y signos
    let cleaned = rawPhone.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }

    // Si tiene 8 dígitos (celular típico boliviano), agregar 591
    if (cleaned.length === 8) {
      const defaultPrefix = process.env.DEFAULT_COUNTRY_CODE || '591';
      cleaned = `${defaultPrefix}${cleaned}`;
    }

    return cleaned;
  }

  static getClientUrl(): string {
    return process.env.CLIENT_URL || 'http://localhost:5173';
  }

  static generateMessageText(params: SendTicketWhatsAppParams): string {
    const { ticket, event } = params;
    const clientUrl = this.getClientUrl();
    const eventDate = new Date(event.date).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const ticketUrl = `${clientUrl}/?ticket=${encodeURIComponent(ticket.ticketCode)}`;

    return `*¡Hola, ${ticket.attendeeName}!*

Tu entrada para *${event.title}* ha sido validada y confirmada exitosamente.

*Fecha:* ${eventDate}
*Lugar:* ${event.venue}, ${event.location}
*Categoría:* ${ticket.ticketType.name}
*Documento:* ${ticket.attendeeDocumentId}
*Código de Boleto:* ${ticket.ticketCode}

*Ver tu Credencial Digital con Código QR:*
${ticketUrl}

_Presenta el código QR adjunto en la puerta de ingreso para tu acreditación rápida._ ¡Nos vemos en TEDx!`;
  }

  static generateWaMeLink(phone: string, text: string): string {
    const formattedPhone = this.formatPhoneNumber(phone);
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
  }

  static async sendTicket(params: SendTicketWhatsAppParams): Promise<WhatsAppSendResult> {
    const formattedPhone = this.formatPhoneNumber(params.phone);
    const messageText = this.generateMessageText(params);
    const waMeUrl = this.generateWaMeLink(formattedPhone, messageText);

    const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    const apiKey = process.env.EVOLUTION_API_KEY || 'fixed-api-key-12345';
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'senordelastintas';

    // Generar o asegurar que exista el QR Data URL
    let qrDataUrl = '';
    try {
      const qrPayload =
        params.ticket.qrCodeData ||
        QRService.createPayload({
          ticketCode: params.ticket.ticketCode,
          orderNumber: params.orderNumber,
          attendeeName: params.ticket.attendeeName,
          attendeeDocumentId: params.ticket.attendeeDocumentId,
          eventName: params.event.title,
        });

      qrDataUrl = await QRService.generateQRCodeDataUrl(qrPayload);
    } catch (qrErr) {
      console.warn('[WhatsAppService] No se pudo generar la imagen del QR:', qrErr);
    }

    // Si no se fuerza el envío inmediato, encolar en la cola segura anti-baneo con pausas aleatorias y presencia
    if (!params.forceImmediate) {
      WhatsAppQueueService.enqueue({
        phone: formattedPhone,
        attendeeName: params.ticket.attendeeName,
        ticketCode: params.ticket.ticketCode,
        orderNumber: params.orderNumber,
        eventName: params.event.title,
        eventDate: params.event.date,
        eventVenue: params.event.venue,
        eventLocation: params.event.location,
        ticketTypeName: params.ticket.ticketType.name,
        attendeeDocumentId: params.ticket.attendeeDocumentId,
        qrDataUrl,
      });

      return {
        success: true,
        queued: true,
        message: 'Boleto añadido a la cola segura de despacho anti-bloqueo con simulación de presencia humana.',
        waMeUrl,
        formattedPhone,
      };
    }

    try {
      // Intentar enviar primero como media (imagen QR + caption con texto)
      const endpoint = `${apiUrl}/message/sendMedia/${instanceName}`;
      const payload: any = {
        number: formattedPhone,
        media: qrDataUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80',
        mediatype: 'image',
        caption: messageText,
        fileName: `TEDx-Ticket-${params.ticket.ticketCode}.png`,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        console.warn('[WhatsAppService] Falló el envío de media en Evolution API:', response.status, errJson);

        // Fallback: intentar enviar al menos como texto
        const textEndpoint = `${apiUrl}/message/sendText/${instanceName}`;
        const textResponse = await fetch(textEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: apiKey,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: messageText,
          }),
        });

        if (!textResponse.ok) {
          const textErr = await textResponse.json().catch(() => ({}));
          return {
            success: false,
            message: `Evolution API reportó error. Puedes usar el botón de respaldo WhatsApp Web.`,
            waMeUrl,
            formattedPhone,
            apiResponse: textErr,
          };
        }

        const successData = await textResponse.json().catch(() => ({}));
        return {
          success: true,
          message: 'Entrada enviada por WhatsApp (mensaje de texto con enlace).',
          waMeUrl,
          formattedPhone,
          apiResponse: successData,
        };
      }

      const resData = await response.json().catch(() => ({}));
      return {
        success: true,
        message: 'Entrada enviada exitosamente por WhatsApp con imagen QR adjunta.',
        waMeUrl,
        formattedPhone,
        apiResponse: resData,
      };
    } catch (networkError: any) {
      console.warn('[WhatsAppService] Error conectando con Evolution API:', networkError.message);
      return {
        success: false,
        message: `No se pudo conectar con la API de WhatsApp (${networkError.message}). Usa el botón de respaldo directo.`,
        waMeUrl,
        formattedPhone,
      };
    }
  }

  /**
   * Helper para obtener la configuración de Evolution API
   */
  private static getConfig() {
    return {
      apiUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
      apiKey: process.env.EVOLUTION_API_KEY || 'fixed-api-key-12345',
      instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'senordelastintas',
    };
  }

  /**
   * Consulta el estado de la conexión y datos del perfil vinculado en Evolution API
   */
  static async getInstanceStatus(): Promise<{
    state: 'open' | 'connecting' | 'close' | 'refused';
    instanceName: string;
    serverUrl: string;
    number?: string | null;
    profileName?: string | null;
    profilePicUrl?: string | null;
    ownerJid?: string | null;
  }> {
    const { apiUrl, apiKey, instanceName } = this.getConfig();

    try {
      // 1. Obtener estado de conexión
      const stateRes = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: apiKey },
      });

      let state: 'open' | 'connecting' | 'close' | 'refused' = 'close';
      if (stateRes.ok) {
        const stateJson: any = await stateRes.json().catch(() => ({}));
        state = stateJson?.instance?.state || 'close';
      }

      // 2. Obtener metadatos de las instancias para extraer número y perfil
      let number: string | null = null;
      let profileName: string | null = null;
      let profilePicUrl: string | null = null;
      let ownerJid: string | null = null;

      try {
        const fetchRes = await fetch(`${apiUrl}/instance/fetchInstances`, {
          headers: { apikey: apiKey },
        });
        if (fetchRes.ok) {
          const list = (await fetchRes.json().catch(() => [])) as any[];
          const inst = list.find((i) => i.name === instanceName);
          if (inst) {
            number = inst.number || null;
            profileName = inst.profileName || null;
            profilePicUrl = inst.profilePicUrl || null;
            ownerJid = inst.ownerJid || null;
            if (inst.connectionStatus && state === 'close') {
              state = inst.connectionStatus;
            }
          }
        }
      } catch (fetchErr) {
        console.warn('[WhatsAppService] Error consultando fetchInstances:', fetchErr);
      }

      return {
        state,
        instanceName,
        serverUrl: apiUrl,
        number,
        profileName,
        profilePicUrl,
        ownerJid,
      };
    } catch (err: any) {
      console.error('[WhatsAppService] Error consultando estado de Evolution API:', err.message);
      return {
        state: 'refused',
        instanceName,
        serverUrl: apiUrl,
        number: null,
      };
    }
  }

  /**
   * Obtiene el código QR en base64 para vincular WhatsApp desde el navegador.
   * Si la sesión previa expiró o alcanzó el límite de reintentos, autoreinicia el socket
   * para garantizar que el QR esté 100% fresco y válido.
   */
  static async getConnectQR(): Promise<{
    base64?: string;
    code?: string;
    pairingCode?: string;
    count?: number;
    state?: string;
  }> {
    const { apiUrl, apiKey, instanceName } = this.getConfig();

    let response = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: apiKey },
    });

    // Si falló (ej. socket cerrado tras expiración del QR anterior), forzar autoreinicio limpio
    if (!response.ok) {
      try {
        await this.restartInstance();
        await new Promise((r) => setTimeout(r, 1200));
        response = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
          headers: { apikey: apiKey },
        });
      } catch (restartErr) {
        console.warn('[WhatsAppService] Falló autoreinicio de instancia para QR:', restartErr);
      }
    }

    if (!response.ok) {
      const err: any = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al obtener código QR de Evolution API');
    }

    const data: any = await response.json().catch(() => ({}));

    // Si Baileys ya acumuló más de 6 reintentos de QR, programar reinicio preventivo para el próximo ciclo
    if (typeof data.count === 'number' && data.count >= 7) {
      setTimeout(async () => {
        try {
          await this.restartInstance();
        } catch {}
      }, 500);
    }

    return data;
  }

  /**
   * Genera un Código de Emparejamiento de 8 dígitos para vincular WhatsApp
   * introduciendo el número telefónico, sin requerir lectura óptica de cámara ni sufrir por expiración rápida.
   */
  static async getPairingCode(phone: string): Promise<{
    pairingCode: string;
    code?: string;
    state?: string;
  }> {
    const { apiUrl, apiKey, instanceName } = this.getConfig();
    const formatted = this.formatPhoneNumber(phone);

    const response = await fetch(`${apiUrl}/instance/connect/${instanceName}?number=${formatted}`, {
      headers: { apikey: apiKey },
    });

    if (!response.ok) {
      const err: any = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al generar código de emparejamiento');
    }

    const data: any = await response.json().catch(() => ({}));
    if (!data.pairingCode && data.instance?.state === 'open') {
      return {
        pairingCode: '',
        state: 'open',
      };
    }

    return {
      pairingCode: data.pairingCode || 'CÓDIGO-NO-DISPONIBLE',
      code: data.code,
      state: data.instance?.state || 'connecting',
    };
  }

  /**
   * Reinicia la conexión Baileys de la instancia en Evolution API
   */
  static async restartInstance(): Promise<any> {
    const { apiUrl, apiKey, instanceName } = this.getConfig();

    const response = await fetch(`${apiUrl}/instance/restart/${instanceName}`, {
      method: 'POST',
      headers: { apikey: apiKey },
    });

    if (!response.ok) {
      const err: any = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al reiniciar instancia en Evolution API');
    }

    return await response.json().catch(() => ({}));
  }

  /**
   * Cierra sesión y desvincula el dispositivo de Evolution API
   */
  static async logoutInstance(): Promise<any> {
    const { apiUrl, apiKey, instanceName } = this.getConfig();

    const response = await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: { apikey: apiKey },
    });

    if (!response.ok) {
      const err: any = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al desvincular dispositivo en Evolution API');
    }

    return await response.json().catch(() => ({}));
  }

  /**
   * Envía un mensaje de prueba a un número de teléfono específico
   */
  static async sendTestMessage(phone: string, text?: string): Promise<{
    success: boolean;
    message: string;
    formattedPhone: string;
    apiResponse?: any;
  }> {
    const { apiUrl, apiKey, instanceName } = this.getConfig();
    const formattedPhone = this.formatPhoneNumber(phone);

    const messageContent =
      text ||
      `*TEDx Innova 2026 - Mensaje de Prueba*\n\n` +
      `¡Hola! Este es un mensaje de prueba oficial emitido desde el Panel de Administración de TEDx Innova a través de *Evolution API*.\n\n` +
      `Fecha de prueba: ${new Date().toLocaleString('es-ES')}\n` +
      `Estado del canal: *Operativo y Verificado* ✅`;

    try {
      const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: messageContent,
        }),
      });

      if (!response.ok) {
        const errJson: any = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errJson.message || 'Evolution API reportó error al enviar mensaje de prueba',
          formattedPhone,
          apiResponse: errJson,
        };
      }

      const resData = await response.json().catch(() => ({}));
      return {
        success: true,
        message: `Mensaje de prueba entregado exitosamente al número +${formattedPhone}`,
        formattedPhone,
        apiResponse: resData,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Error de red al conectar con Evolution API: ${err.message}`,
        formattedPhone,
      };
    }
  }
}

