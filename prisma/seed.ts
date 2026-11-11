import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de base de datos...');

  await prisma.ticket.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.paymentSetting.deleteMany();
  await prisma.user.deleteMany();

  const adminPasswordHash = await bcrypt.hash('AdminTedx2026!', 10);
  const staffPasswordHash = await bcrypt.hash('StaffTedx2026!', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@tedx.local',
      name: 'Director TEDx',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const staff = await prisma.user.create({
    data: {
      email: 'staff@tedx.local',
      name: 'Staff Puerta / Check-in',
      passwordHash: staffPasswordHash,
      role: Role.STAFF,
    },
  });

  console.log(`Usuarios creados: ${admin.email} (ADMIN), ${staff.email} (STAFF)`);

  const event = await prisma.event.create({
    data: {
      title: 'TEDx Innova: Fronteras del Pensamiento',
      slug: 'tedx-innova-2026',
      subtitle: 'Ideas revolucionarias, ciencia, tecnología y el futuro de nuestra comunidad',
      description:
        'Un espacio de encuentro multidisciplinario para compartir ideas que transforman el mundo. 8 conferencias de alto impacto con líderes globales y locales, espacios de networking interactivos y experiencias inmersivas.',
      date: new Date('2026-11-28T09:00:00.000Z'),
      location: 'Auditorio Mayor de la Ciudad',
      venue: 'Av. Innovación 1024, Pabellón Central',
      bannerUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
      maxCapacity: 500,
      isActive: true,
    },
  });

  console.log(`Evento creado: ${event.title}`);

  const ticketTypes = await Promise.all([
    prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: 'Early Bird',
        description: 'Pase con descuento especial para los primeros inscritos. Incluye acceso general, libreta TEDx y coffee break.',
        price: 25.0,
        totalQuota: 80,
        remainingQuota: 80,
      },
    }),
    prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: 'Entrada General',
        description: 'Acceso completo a todas las conferencias magistrales, zona de networking y certificado digital de asistencia.',
        price: 40.0,
        totalQuota: 320,
        remainingQuota: 320,
      },
    }),
    prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: 'Pase VIP & Speaker Lounge',
        description: 'Ubicación preferencial en primeras filas, acceso al cóctel exclusivo con los oradores, kit TEDx conmemorativo y credencial personalizada.',
        price: 85.0,
        totalQuota: 100,
        remainingQuota: 100,
      },
    }),
  ]);

  console.log(`Categorías de tickets creadas: ${ticketTypes.length}`);

  const paymentSetting = await prisma.paymentSetting.create({
    data: {
      bankName: 'Banco Metropolitano',
      accountType: 'Cuenta Corriente',
      accountNumber: '0102-0456-7890-12345678',
      accountHolder: 'Fundación TEDx Innova A.C.',
      holderId: 'J-40998877-1',
      instructions:
        'Realiza la transferencia por el monto exacto a la cuenta indicada. Conserva tu comprobante bancario (captura o PDF) y anota el número de confirmación/referencia para subirlo en el siguiente formulario.',
      isActive: true,
    },
  });

  console.log(`Datos bancarios configurados para: ${paymentSetting.bankName}`);
  console.log('Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
