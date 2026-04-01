import { PrismaClient, Role, DeviceType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seed...');

  // Créer les utilisateurs de test
  const passwordHash = await bcrypt.hash('Password123!', 10);

  await prisma.user.upsert({
    where: { email: 'manager@elkem.com' },
    update: {},
    create: {
      email: 'manager@elkem.com',
      displayName: 'Jean Dupont',
      passwordHash,
      role: Role.MANAGER,
      department: 'IT',
      jobTitle: 'IT Manager',
    },
  });

  await prisma.user.upsert({
    where: { email: 'tech@elkem.com' },
    update: {},
    create: {
      email: 'tech@elkem.com',
      displayName: 'Marie Martin',
      passwordHash,
      role: Role.TECHNICIAN,
      department: 'IT',
      jobTitle: 'IT Technician',
    },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@elkem.com' },
    update: {},
    create: {
      email: 'viewer@elkem.com',
      displayName: 'Pierre Bernard',
      passwordHash,
      role: Role.VIEWER,
      department: 'Finance',
      jobTitle: 'Comptable',
    },
  });

  console.log('✅ Utilisateurs créés');

  // Créer des alertes stock
  await prisma.stockAlert.createMany({
    data: [
      { deviceType: DeviceType.LAPTOP, threshold: 5 },
      { deviceType: DeviceType.SMARTPHONE, threshold: 3 },
      { deviceType: DeviceType.TABLET, threshold: 2 },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Alertes stock créées');

  // Créer les modèles Dell par défaut
  const dellModels = [
    { name: 'Latitude 5450', type: DeviceType.LAPTOP, processor: 'Intel Core Ultra 5 125U', ram: '32 Go DDR5', storage: '512 Go SSD NVMe', screenSize: '14"', order: 1 },
    { name: 'Latitude 5440', type: DeviceType.LAPTOP, processor: 'Intel Core Ultra 5 125U', ram: '32 Go DDR5', storage: '512 Go SSD NVMe', screenSize: '14"', order: 2 },
    { name: 'Latitude 5430', type: DeviceType.LAPTOP, processor: 'Intel Core i7-1265U',    ram: '16 Go DDR4', storage: '512 Go SSD NVMe', screenSize: '14"', order: 3 },
    { name: 'Latitude 5420', type: DeviceType.LAPTOP, processor: 'Intel Core i7-1165G7',   ram: '16 Go DDR4', storage: '512 Go SSD NVMe', screenSize: '14"', order: 4 },
    { name: 'Latitude 5410', type: DeviceType.LAPTOP, processor: 'Intel Core i7-10610U',   ram: '16 Go DDR4', storage: '256 Go SSD NVMe', screenSize: '14"', order: 5 },
    { name: 'Latitude 5400', type: DeviceType.LAPTOP, processor: 'Intel Core i7-8665U',    ram: '16 Go DDR4', storage: '256 Go SSD NVMe', screenSize: '14"', order: 6 },
    { name: 'Précision 3490', type: DeviceType.LAPTOP, processor: 'Intel Core Ultra 7 165H', ram: '32 Go DDR5', storage: '512 Go SSD NVMe', screenSize: '14"', order: 7 },
    { name: 'Pro 14',          type: DeviceType.LAPTOP, processor: 'Intel Core Ultra 5 125U', ram: '32 Go DDR5', storage: '512 Go SSD NVMe', screenSize: '14"', order: 8 },
  ];

  for (const m of dellModels) {
    await prisma.deviceModel.upsert({
      where: { name_type: { name: m.name, type: m.type } },
      update: { processor: m.processor, ram: m.ram, storage: m.storage, screenSize: m.screenSize, order: m.order },
      create: { ...m, brand: 'Dell' },
    });
  }

  console.log('✅ Modèles Dell créés');

  console.log('');
  console.log('🎉 Seed terminé avec succès !');
  console.log('');
  console.log('Comptes de test :');
  console.log('  Manager    : manager@elkem.com / Password123!');
  console.log('  Technician : tech@elkem.com / Password123!');
  console.log('  Viewer     : viewer@elkem.com / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
