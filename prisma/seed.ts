import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "Event", "Sponsor", "Speaker", "Certificate", "CertificateTemplate", "Ticket", "TicketType", "OrderItem", "Order", "PaymentSetting" RESTART IDENTITY CASCADE;');

  const adminPasswordHash = await bcrypt.hash('AdminTedx#129939994', 10);
  await prisma.user.create({
    data: { email: 'admin.tedx@gmail.com', name: 'Director TEDx USFX', passwordHash: adminPasswordHash, role: Role.ADMIN },
  });

  const event = await prisma.event.create({
    data: {
      title: 'TEDx USFX: Fronteras del Pensamiento',
      slug: 'tedx-usfx-2026',
      subtitle: 'Ideas que transforman: Liderazgo, Ciencia y Compromiso Social',
      description: 'Conferencia oficial.',
      date: new Date('2026-11-21T09:30:00.000Z'),
      location: 'Sucre, Bolivia',
      venue: 'Teatro Gran Mariscal',
      bannerUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
      maxCapacity: 500,
      isActive: true,
    },
  });

  await prisma.ticketType.createMany({
    data: [
      {
        eventId: event.id,
        name: 'Entrada General',
        description: 'Acceso a todas las charlas, kit oficial y coffee break.',
        price: 100,
        totalQuota: 300,
        remainingQuota: 300,
        isActive: true,
      },
      {
        eventId: event.id,
        name: 'Estudiante USFX',
        description: 'Tarifa preferencial para estudiantes con credencial universitaria vigente.',
        price: 50,
        totalQuota: 150,
        remainingQuota: 150,
        isActive: true,
      },
      {
        eventId: event.id,
        name: 'Pase VIP / Networking',
        description: 'Acceso preferencial en primeras filas, kit VIP y encuentro exclusivo con speakers.',
        price: 200,
        totalQuota: 50,
        remainingQuota: 50,
        isActive: true,
      },
    ],
  });

  await prisma.sponsor.createMany({
    data: [
      { eventId: event.id, name: 'Innova Projects', logoUrl: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&w=300&q=80', tier: 'Aliado Tecnológico', order: 1 },
      { eventId: event.id, name: 'Universidad San Francisco Xavier', logoUrl: 'https://images.unsplash.com/photo-1562774053-70193988ce58?auto=format&fit=crop&w=300&q=80', tier: 'Patrocinador Oficial', order: 2 },
    ],
  });

  await prisma.speaker.createMany({
    data: [
      { eventId: event.id, name: 'ERICK MITA', role: 'Vicerrector USFX', topic: 'Liderazgo y Transformación', bio: 'Docente, investigador.', imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80', order: 1, isActive: true },
    ],
  });

  await prisma.paymentSetting.create({
    data: { instructions: 'Escanea el QR oficial.', isActive: true },
  });

  console.log('Seed completado exitosamente.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
