import { PrismaClient, Role, CertificateCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de base de datos...');

  await prisma.certificate.deleteMany();
  await prisma.certificateTemplate.deleteMany();
  await prisma.speaker.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.paymentSetting.deleteMany();
  await prisma.user.deleteMany();

  const adminPasswordHash = await bcrypt.hash('AdminTedx2026!', 10);
  const validatorPasswordHash = await bcrypt.hash('ValidatorTedx2026!', 10);
  const volunteerPasswordHash = await bcrypt.hash('VoluntarioTedx2026!', 10);
  const checkinPasswordHash = await bcrypt.hash('CheckinTedx2026!', 10);
  const staffPasswordHash = await bcrypt.hash('StaffTedx2026!', 10);

  // Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@tedx.local',
      name: 'Director TEDx',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  // 5 Validadores de comprobantes bancarios
  await Promise.all([
    prisma.user.create({
      data: {
        email: 'validador1@tedx.local',
        name: 'Validador 1 - Finanzas',
        passwordHash: validatorPasswordHash,
        role: Role.VALIDATOR,
      },
    }),
    prisma.user.create({
      data: {
        email: 'validador2@tedx.local',
        name: 'Validador 2 - Finanzas',
        passwordHash: validatorPasswordHash,
        role: Role.VALIDATOR,
      },
    }),
    prisma.user.create({
      data: {
        email: 'validador3@tedx.local',
        name: 'Validador 3 - Finanzas',
        passwordHash: validatorPasswordHash,
        role: Role.VALIDATOR,
      },
    }),
    prisma.user.create({
      data: {
        email: 'validador4@tedx.local',
        name: 'Validador 4 - Finanzas',
        passwordHash: validatorPasswordHash,
        role: Role.VALIDATOR,
      },
    }),
    prisma.user.create({
      data: {
        email: 'validador5@tedx.local',
        name: 'Validador 5 - Finanzas',
        passwordHash: validatorPasswordHash,
        role: Role.VALIDATOR,
      },
    }),
  ]);

  // 2 Voluntarios para mesa de inscripción y despacho por WhatsApp
  await Promise.all([
    prisma.user.create({
      data: {
        email: 'voluntario1@tedx.local',
        name: 'Voluntario Mesa A',
        passwordHash: volunteerPasswordHash,
        role: Role.VOLUNTEER,
      },
    }),
    prisma.user.create({
      data: {
        email: 'voluntario2@tedx.local',
        name: 'Voluntario Mesa B',
        passwordHash: volunteerPasswordHash,
        role: Role.VOLUNTEER,
      },
    }),
  ]);

  // Checkin en Puerta
  const checkinUser = await prisma.user.create({
    data: {
      email: 'checkin@tedx.local',
      name: 'Staff Puerta 1',
      passwordHash: checkinPasswordHash,
      role: Role.CHECKIN,
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      email: 'staff@tedx.local',
      name: 'Staff General',
      passwordHash: staffPasswordHash,
      role: Role.STAFF,
    },
  });

  console.log(`Usuarios creados exitosamente:`);
  console.log(`- Admin: ${admin.email}`);
  console.log(`- 5 Validadores: validador1@tedx.local .. validador5@tedx.local`);
  console.log(`- 2 Voluntarios: voluntario1@tedx.local, voluntario2@tedx.local`);
  console.log(`- Check-in: ${checkinUser.email}`);
  console.log(`- Staff: ${staffUser.email}`);

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

  // 4 Speakers Oficiales con fotos de alta resolución
  const speakers = await Promise.all([
    prisma.speaker.create({
      data: {
        eventId: event.id,
        name: 'Dra. Elena Vega',
        role: 'Investigadora en Neurotecnología & IA',
        topic: 'La interfaz mente-máquina: El futuro de la cognición humana',
        bio: 'Pionera en neurociencia computacional e interfaces cerebro-computadora aplicadas a la medicina regenerativa.',
        imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
        order: 1,
        isActive: true,
      },
    }),
    prisma.speaker.create({
      data: {
        eventId: event.id,
        name: 'Carlos Mendoza',
        role: 'Astrofísico & Divulgador Científico',
        topic: 'De la Tierra al Cosmos: Nuevos horizontes en la exploración interplanetaria',
        bio: 'Consultor de misiones espaciales y conferencista internacional en astronomía moderna y el origen de galaxias.',
        imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
        order: 2,
        isActive: true,
      },
    }),
    prisma.speaker.create({
      data: {
        eventId: event.id,
        name: 'Ing. Sofía Alarcón',
        role: 'Fundadora de EcoSolutions',
        topic: 'Biomateriales y economía circular contra la crisis climática',
        bio: 'Emprendedora tecnológica galardonada por el desarrollo de polímeros biodegradables a partir de residuos agrícolas.',
        imageUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=800&q=80',
        order: 3,
        isActive: true,
      },
    }),
    prisma.speaker.create({
      data: {
        eventId: event.id,
        name: 'Mateo Rivas',
        role: 'Compositor & Diseñador Sonoro Inmersivo',
        topic: 'El sonido como catalizador de la empatía colectiva',
        bio: 'Explorador sonoro que fusiona acústica binaural y música tradicional andina en experiencias inmersivas.',
        imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
        order: 4,
        isActive: true,
      },
    }),
  ]);
  console.log(`Speakers creados: ${speakers.length}`);

  // 4 Modelos de Plantillas de Certificados
  const certTemplates = await Promise.all([
    prisma.certificateTemplate.create({
      data: {
        eventId: event.id,
        category: CertificateCategory.ATTENDEE,
        title: 'Certificado de Asistencia y Participación',
        description: 'Otorgado por haber formado parte activa de las conferencias y espacios de debate de TEDx Innova.',
        backgroundImageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1600&q=80',
        isActive: true,
      },
    }),
    prisma.certificateTemplate.create({
      data: {
        eventId: event.id,
        category: CertificateCategory.SPEAKER,
        title: 'Certificado de Honor como Orador Oficial',
        description: 'Reconocimiento de distinción por compartir ideas que vale la pena difundir en el escenario oficial de TEDx Innova.',
        backgroundImageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1600&q=80',
        isActive: true,
      },
    }),
    prisma.certificateTemplate.create({
      data: {
        eventId: event.id,
        category: CertificateCategory.VOLUNTEER,
        title: 'Certificado de Reconocimiento al Equipo de Voluntarios',
        description: 'Por su dedicación, liderazgo y trabajo incansable en la organización y realización de TEDx Innova.',
        backgroundImageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80',
        isActive: true,
      },
    }),
    prisma.certificateTemplate.create({
      data: {
        eventId: event.id,
        category: CertificateCategory.VIP,
        title: 'Certificado Especial de Distinción y Alianza Estratégica',
        description: 'Otorgado en reconocimiento a su invaluable apoyo, auspicio y contribución al ecosistema de innovación.',
        backgroundImageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80',
        isActive: true,
      },
    }),
  ]);
  console.log(`Plantillas de certificados creadas: ${certTemplates.length}`);

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
        'Realiza la transferencia en Bolivianos (Bs) por el monto exacto a la cuenta indicada. Conserva tu comprobante bancario (captura o PDF) y anota el número de confirmación/referencia para subirlo en el siguiente formulario.',
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
