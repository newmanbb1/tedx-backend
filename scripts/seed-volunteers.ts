import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface VolunteerSeed {
  name: string;
  email: string;
  ci?: string;
  area: string;
}

const volunteers: VolunteerSeed[] = [
  // 1. Comunicación (6)
  { name: 'Kazandra Poleth Camacho', email: 'poleth.cp@gmail.com', ci: '13090807', area: 'Comunicación' },
  { name: 'Milton Condori Peñaranda', email: 'miltonx000@gmail.com', ci: '10386393', area: 'Comunicación' },
  { name: 'Camila Asunción Coronado Nava', email: 'navacamila309@gmail.com', ci: '12546653', area: 'Comunicación' },
  { name: 'Luciana Arian Fuentes Cruz', email: 'fuentescruzluciana@gmail.com', ci: '7545530', area: 'Comunicación' },
  { name: 'C. Isabel Jiménez Escalante', email: 'isabeljimenez.esc@gmail.com', ci: '10396214', area: 'Comunicación' },
  { name: 'Jhasmin Antequera Urquizu', email: 'antequerajhasmin@gmail.com', ci: '10410367', area: 'Comunicación' },

  // 2. Logística (17)
  { name: 'Alexander Aldair Arrieta Zárate', email: 'arrietaalexander997@gmail.com', ci: '10711443', area: 'Logística' },
  { name: 'Andrea Fabiana Montesinos Velásquez', email: 'fabivela05@gmail.com', ci: '13905123', area: 'Logística' },
  { name: 'José Andrés Iglesias Flores', email: 'iglesiasfloresjoseandres@gmail.com', ci: '7502301', area: 'Logística' },
  { name: 'Carlos Garabito Rodríguez', email: 'jr3811785@gmail.com', ci: '75729845', area: 'Logística' },
  { name: 'Edwin Vicente López Rivera', email: 'drakenathan2002@gmail.com', ci: '75767659', area: 'Logística' },
  { name: 'Camila Marcela Pérez Durán', email: 'marce.campduran@gmail.com', ci: '13186724', area: 'Logística' },
  { name: 'Marley Fernanda Bernal Schmidt', email: 'ferby6912@gmail.com', ci: '12932108', area: 'Logística' },
  { name: 'Ingrid Jhesenia Balcera Flores', email: 'ingridjheseniabalceraflores13@gmail.com', ci: '12930689', area: 'Logística' },
  { name: 'Christian José Claure', email: 'christianjoseclaure@gmail.com', ci: '12578984', area: 'Logística' },
  { name: 'Joaquín Aramayo Valdez', email: 'joaco.ve15@gmail.com', ci: '7482138', area: 'Logística' },
  { name: 'Marcelo Avendaño Salazar', email: 'marcelo.av1205@gmail.com', ci: '10321418', area: 'Logística' },
  { name: 'Sahira Martínez Burgoa', email: 'sahiramartinezbur@gmail.com', area: 'Logística' },
  { name: 'José Aurelio Flores Aguirre', email: 'josefloresaguirre1@gmail.com', area: 'Logística' },
  { name: 'Cecilia Rivero Zárate', email: 'cecirivero.zarate@gmail.com', area: 'Logística' },
  { name: 'María de los Ángeles Alejandra Patzi Rollano', email: 'patzidelosangeles@gmail.com', area: 'Logística' },
  { name: 'Manuela Rueda Peñaranda', email: 'manueruedapenaranda@gmail.com', area: 'Logística' },
  { name: 'Pablo Antonio Pérez Ramos', email: 'perezramospablish@gmail.com', area: 'Logística' },

  // 3. Dirección General (5)
  { name: 'Melani Dalyn Silguera Rodríguez', email: 'silgueramelani@gmail.com', area: 'Dirección General' },
  { name: 'Natalia Montoya Porcel', email: 'montoyapnatalia@gmail.com', area: 'Dirección General' },
  { name: 'Karen Noemi Choque Palacios', email: 'karennoemichoquepalacios@gmail.com', area: 'Dirección General' },
  { name: 'Paola Valentina Gallardo Flores', email: 'gf.valentina225@gmail.com', area: 'Dirección General' },
  { name: 'Dara Elizabeth Sotomayor Vargas', email: 'daraelizabethsotomayor18@gmail.com', area: 'Dirección General' },

  // 4. Área Producción (10)
  { name: 'Diana Márquez Rojas', email: 'dm9935231@gmail.com', ci: '13124164', area: 'Producción' },
  { name: 'Camila Campos Montero', email: 'camicampos828@gmail.com', ci: '10325048', area: 'Producción' },
  { name: 'Camila Estefany Estrada Torrico', email: 'estradatorricocamila@gmail.com', ci: '12929513', area: 'Producción' },
  { name: 'Lorena Calcina Mamani', email: '12345locama@gmail.com', ci: '12749301', area: 'Producción' },
  { name: 'Naidelyn Vásquez Ajata', email: 'naidelyn.universidad@gmail.com', ci: '10633927', area: 'Producción' },
  { name: 'Nahir Valeria Soria Flores', email: 'nsoriaflores2@gmail.com', ci: '13905165', area: 'Producción' },
  { name: 'Julio Cesar Baldiviezo Peñaranda', email: 'juliocesarbaldiviezo54@gmail.com', ci: '7491094', area: 'Producción' },
  { name: 'Dana Noelia Ledezma Bellido', email: 'danaledezma87@gmail.com', ci: '13091971', area: 'Producción' },
  { name: 'Stefany Daniela Mendez Guzmán', email: 'mendezstefany592@gmail.com', ci: '13187822', area: 'Producción' },
  { name: 'Oscar Fernando Párraga Daza', email: 'parragadazaoscar@gmail.com', ci: '16747882', area: 'Producción' },

  // 5. Sponsors y Ventas (7)
  { name: 'Fernanda Gutiérrez Arias', email: 'fergustierrezarias@gmail.com', ci: '10383568', area: 'Sponsors y Ventas' },
  { name: 'Efraín Fernando Avendaño Loayza', email: 'efraferal338@gmail.com', ci: '7502506', area: 'Sponsors y Ventas' },
  { name: 'Evelyn Shirley Calcina Bautista', email: 'evelynshirleycalcinabautista@gmail.com', ci: '12749453', area: 'Sponsors y Ventas' },
  { name: 'Emily Ana Peñaranda Anagua', email: 'emilypenaranda73@gmail.com', ci: '8615356', area: 'Sponsors y Ventas' },
  { name: 'Lindsey Amira Poma Choque', email: 'lindseyamira123@gmail.com', ci: '12612504', area: 'Sponsors y Ventas' },
  { name: 'Yoselyn Cusicanqui Ticona', email: 'yoselyncusicanqui@gmail.com', ci: '13375957', area: 'Sponsors y Ventas' },
  { name: 'Carla Monserrat Carvallo Salinas', email: 'monserratcarvallo6@gmail.com', ci: '10336936', area: 'Sponsors y Ventas' },

  // 6. Área de Speakers (7)
  { name: 'Diego Alexander Cerezo Rodríguez', email: 'lviyus@gmail.com', ci: '10409129', area: 'Speakers' },
  { name: 'Cristopher Evans Carrasco', email: 'cristopherevanscarrasco@gmail.com', ci: '13758456', area: 'Speakers' },
  { name: 'Britany Daniela Ponce Quiroz', email: 'dani.ponceskz@gmail.com', ci: '8621930', area: 'Speakers' },
  { name: 'Michelle Celia Ramos Luján', email: 'michelleralu2004@gmail.com', ci: '7401670', area: 'Speakers' },
  { name: 'Manuel Gonzalo Cors Rojas', email: 'manuelcors64@gmail.com', ci: '12931642', area: 'Speakers' },
  { name: 'Cristina Belén Andonaigue Martínez', email: 'belenandonaigue04@gmail.com', ci: '13090567', area: 'Speakers' },
  { name: 'Neyza Alejandra Torres Ramos', email: 'alejandratorres060612@gmail.com', ci: '10381911', area: 'Speakers' },

  // 7. Marketing (11)
  { name: 'Nicol', email: 'manicol0906@gmail.com', area: 'Marketing' },
  { name: 'Vladimir Siles Ortega', email: 'siles.vladimir.ortega@gmail.com', area: 'Marketing' },
  { name: 'Allison Andrea POV', email: 'povandrea0@gmail.com', area: 'Marketing' },
  { name: 'Andrés Sito', email: 'sito16andres@gmail.com', area: 'Marketing' },
  { name: 'Dayner Mauricio', email: 'mdaynermauricio7@gmail.com', area: 'Marketing' },
  { name: 'Estefania Silvana Villanueva', email: 'estefaniasilvanavillanueva@gmail.com', area: 'Marketing' },
  { name: 'Lucia Georgina', email: 'georginap832@gmail.com', area: 'Marketing' },
  { name: 'Mayte Condarco', email: 'maytecondarco11@gmail.com', area: 'Marketing' },
  { name: 'Andrea Pereira López (Andi)', email: 'andreapereiralopez2008@gmail.com', area: 'Marketing' },
  { name: 'Tatiana', email: 'tattys282007@gmail.com', area: 'Marketing' },
  { name: 'Camila Estefani Morales Peña', email: 'camiimorales301@gmail.com', area: 'Marketing' },
];

async function main() {
  console.log(`Iniciando registro de ${volunteers.length} voluntarios...`);

  const fallbackPasswordHash = await bcrypt.hash('Tedx2026!Voluntario', 10);
  let createdCount = 0;
  let updatedCount = 0;

  for (const vol of volunteers) {
    const email = vol.email.trim().toLowerCase();
    const rawPassword = vol.ci ? `Tedx.${vol.ci.trim()}` : 'Tedx2026!Voluntario';
    const passwordHash = vol.ci ? await bcrypt.hash(rawPassword, 10) : fallbackPasswordHash;

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: vol.name,
          role: Role.VOLUNTEER,
          // Preservar la contraseña si ya existía para no sobrescribir cambios personales
        },
      });
      updatedCount++;
      console.log(`[Actualizado] ${vol.name} (${email}) -> Rol: VOLUNTEER`);
    } else {
      await prisma.user.create({
        data: {
          email,
          name: vol.name,
          passwordHash,
          role: Role.VOLUNTEER,
        },
      });
      createdCount++;
      console.log(`[Creado] ${vol.name} (${email}) | Pass inicial: ${rawPassword}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`Proceso completado exitosamente:`);
  console.log(`- Creados nuevos: ${createdCount}`);
  console.log(`- Actualizados: ${updatedCount}`);
  console.log(`- Total procesados: ${volunteers.length}`);
  console.log(`========================================\n`);
}

main()
  .catch((err) => {
    console.error('Error al registrar voluntarios:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
