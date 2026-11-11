import QRCode from 'qrcode';

export interface TicketQRPayload {
  ticketCode: string;
  orderNumber: string;
  attendeeName: string;
  attendeeDocumentId: string;
  eventName: string;
}

export class QRService {
  static createPayload(payload: TicketQRPayload): string {
    return JSON.stringify({
      code: payload.ticketCode,
      order: payload.orderNumber,
      doc: payload.attendeeDocumentId,
      name: payload.attendeeName,
      event: payload.eventName,
    });
  }

  static async generateQRCodeDataUrl(payloadString: string): Promise<string> {
    try {
      return await QRCode.toDataURL(payloadString, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 320,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
    } catch (error) {
      console.error('Error generando QR code:', error);
      throw new Error('No se pudo generar el código QR del boleto');
    }
  }
}
