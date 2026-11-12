import { QRService } from './qr.service.js';

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
}

export interface WhatsAppSendResult {
  success: boolean;
  message: string;
  waMeUrl: string;
  formattedPhone: string;
  apiResponse?: any;
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

    return `🎟️ *¡Hola, ${ticket.attendeeName}!*

Tu entrada para *${event.title}* ha sido validada y confirmada exitosamente.

🗓️ *Fecha:* ${eventDate}
📍 *Lugar:* ${event.venue}, ${event.location}
🏷️ *Categoría:* ${ticket.ticketType.name}
🪪 *Documento:* ${ticket.attendeeDocumentId}
🔑 *Código de Boleto:* ${ticket.ticketCode}

📲 *Ver tu Credencial Digital con Código QR:*
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
}

