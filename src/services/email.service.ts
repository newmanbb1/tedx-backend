import nodemailer from 'nodemailer';

export interface SendTicketsEmailParams {
  to: string;
  buyerName: string;
  orderNumber: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  tickets: Array<{
    ticketCode: string;
    ticketType: string;
    attendeeName: string;
    attendeeDocumentId: string;
    qrDataUrl: string;
  }>;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  private static getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
        port: Number(process.env.SMTP_PORT) || 2525,
        auth: {
          user: process.env.SMTP_USER || 'dummy_user',
          pass: process.env.SMTP_PASS || 'dummy_pass',
        },
      });
    }
    return this.transporter;
  }

  static async sendApprovedTickets(params: SendTicketsEmailParams): Promise<boolean> {
    const from = process.env.SMTP_FROM || 'TEDx Events <tickets@tedx.local>';
    const subject = `¡Tus entradas para ${params.eventTitle} están listas! - Orden #${params.orderNumber}`;

    const ticketsHtml = params.tickets
      .map(
        (t, idx) => `
        <div style="border: 2px solid #EB0028; border-radius: 12px; padding: 20px; margin-bottom: 24px; background: #fafafa; font-family: sans-serif;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
            <span style="font-weight: bold; color: #EB0028; font-size: 16px;">Boleto #${idx + 1} - ${t.ticketType}</span>
            <span style="font-family: monospace; font-size: 14px; background: #eee; padding: 2px 8px; border-radius: 4px;">Código: ${t.ticketCode}</span>
          </div>
          <div style="margin-top: 14px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <p style="margin: 4px 0;"><strong>Asistente:</strong> ${t.attendeeName}</p>
              <p style="margin: 4px 0;"><strong>Identificación:</strong> ${t.attendeeDocumentId}</p>
              <p style="margin: 4px 0;"><strong>Evento:</strong> ${params.eventTitle}</p>
              <p style="margin: 4px 0;"><strong>Fecha y Lugar:</strong> ${params.eventDate} | ${params.eventVenue}</p>
            </div>
            <div style="text-align: center; margin-left: 20px;">
              <img src="${t.qrDataUrl}" alt="QR Boleto" width="160" height="160" style="border: 1px solid #ccc; border-radius: 8px; display: block;" />
              <small style="color: #666; font-size: 11px;">Muestra este QR en puerta</small>
            </div>
          </div>
        </div>
      `
      )
      .join('');

    const htmlContent = `
      <div style="max-width: 680px; margin: 0 auto; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
        <div style="background-color: #111; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 24px; letter-spacing: 1px;">
            <span style="color: #EB0028;">TEDx</span> Innova
          </h1>
          <p style="color: #aaa; margin: 6px 0 0; font-size: 14px;">Ideas que vale la pena difundir</p>
        </div>
        <div style="padding: 30px; background: #ffffff; border: 1px solid #eee; border-radius: 0 0 12px 12px;">
          <h2 style="color: #111; margin-top: 0;">¡Hola, ${params.buyerName}!</h2>
          <p style="color: #444; line-height: 1.6;">
            Tu pago por transferencia bancaria ha sido verificado y aprobado con éxito por nuestro equipo organizador. 
            A continuación encontrarás tus boletos de acceso para <strong>${params.eventTitle}</strong>.
          </p>
          
          <div style="margin: 25px 0;">
            ${ticketsHtml}
          </div>

          <div style="background: #fff8f8; border-left: 4px solid #EB0028; padding: 12px 16px; margin: 24px 0;">
            <p style="margin: 0; font-size: 13px; color: #666;">
              <strong>Importante para el día del evento:</strong> Presenta tu código QR en tu teléfono móvil o impreso en el módulo de registro/check-in junto con tu documento de identidad para recibir tu gafete de acceso.
            </p>
          </div>

          <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
            Orden #${params.orderNumber} &bull; Equipo Organizador TEDx
          </p>
        </div>
      </div>
    `;

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from,
        to: params.to,
        subject,
        html: htmlContent,
      });
      console.log(`Email de boletos enviado exitosamente a: ${params.to}`);
      return true;
    } catch (error) {
      console.warn(
        `[EmailService] No se pudo enviar el correo a ${params.to} (posiblemente SMTP en desarrollo no conectado).`,
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }
}

