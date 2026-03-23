import { PrismaClient, Role, DeviceType, DeviceStatus, DeviceCondition, KeyboardLayout, AuditAction } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seed...');

  // Créer les utilisateurs de test
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const manager = await prisma.user.upsert({
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

  const technician = await prisma.user.upsert({
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

  const viewer = await prisma.user.upsert({
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

  // Créer des appareils de test
  const devices = [
    {
      assetTag: 'ELKEM-LT-001',
      serialNumber: 'SN-DELL-001',
      type: DeviceType.LAPTOP,
      brand: 'Dell',
      model: 'Latitude 5540',
      processor: 'Intel Core i7-1365U',
      ram: '16GB',
      storage: '512GB SSD',
      screenSize: '15.6"',
      keyboardLayout: KeyboardLayout.AZERTY_FR,
      keyboardLanguage: 'FR',
      status: DeviceStatus.ASSIGNED,
      condition: DeviceCondition.GOOD,
      location: 'Paris',
      site: 'Bureau',
      assignedUserId: viewer.id,
      assignedAt: new Date('2024-01-15'),
      purchaseDate: new Date('2023-09-01'),
      warrantyExpiry: new Date('2026-09-01'),
      purchasePrice: 1299.99,
      supplier: 'Dell France',
      intuneOsName: 'Windows',
      intuneOsVersion: '11 23H2',
      intuneCompliant: true,
      intuneLastSeen: new Date(),
    },
    {
      assetTag: 'ELKEM-LT-002',
      serialNumber: 'SN-APPLE-001',
      type: DeviceType.LAPTOP,
      brand: 'Apple',
      model: 'MacBook Pro 14"',
      processor: 'Apple M3 Pro',
      ram: '18GB',
      storage: '512GB SSD',
      screenSize: '14"',
      keyboardLayout: KeyboardLayout.QWERTY_US,
      keyboardLanguage: 'EN',
      status: DeviceStatus.IN_STOCK,
      condition: DeviceCondition.EXCELLENT,
      location: 'Paris',
      site: 'Bureau',
      purchaseDate: new Date('2024-01-10'),
      warrantyExpiry: new Date('2027-01-10'),
      purchasePrice: 2499.99,
      supplier: 'Apple Store',
      intuneOsName: 'macOS',
      intuneOsVersion: '14.5',
      intuneCompliant: true,
    },
    {
      assetTag: 'ELKEM-LT-003',
      serialNumber: 'SN-DELL-002',
      type: DeviceType.LAPTOP,
      brand: 'Dell',
      model: 'XPS 13',
      processor: 'Intel Core i5-1340P',
      ram: '8GB',
      storage: '256GB SSD',
      screenSize: '13"',
      keyboardLayout: KeyboardLayout.QWERTY_NO,
      keyboardLanguage: 'NO',
      status: DeviceStatus.IN_STOCK,
      condition: DeviceCondition.GOOD,
      location: 'Oslo',
      site: 'Bureau',
      purchaseDate: new Date('2023-06-15'),
      warrantyExpiry: new Date('2024-06-15'),
      purchasePrice: 999.99,
      supplier: 'Dell Norway',
    },
    {
      assetTag: 'ELKEM-SP-001',
      serialNumber: 'SN-APPLE-002',
      type: DeviceType.SMARTPHONE,
      brand: 'Apple',
      model: 'iPhone 15 Pro',
      storage: '256GB',
      color: 'Titane naturel',
      keyboardLayout: KeyboardLayout.QWERTY_US,
      status: DeviceStatus.ASSIGNED,
      condition: DeviceCondition.EXCELLENT,
      location: 'Paris',
      site: 'Bureau',
      assignedUserId: manager.id,
      assignedAt: new Date('2024-02-01'),
      purchaseDate: new Date('2024-01-20'),
      warrantyExpiry: new Date('2025-01-20'),
      purchasePrice: 1329.00,
      supplier: 'Apple Store',
      intuneOsName: 'iOS',
      intuneOsVersion: '17.5',
      intuneCompliant: true,
      intuneLastSeen: new Date(),
    },
    {
      assetTag: 'ELKEM-DT-001',
      serialNumber: 'SN-HP-001',
      type: DeviceType.DESKTOP,
      brand: 'HP',
      model: 'EliteDesk 800 G6',
      processor: 'Intel Core i7-10700',
      ram: '32GB',
      storage: '1TB SSD',
      keyboardLayout: KeyboardLayout.AZERTY_FR,
      status: DeviceStatus.IN_MAINTENANCE,
      condition: DeviceCondition.FAIR,
      location: 'Lyon',
      site: 'Bureau',
      purchaseDate: new Date('2021-03-01'),
      warrantyExpiry: new Date('2024-03-01'),
      lastMaintenanceDate: new Date('2024-08-01'),
      purchasePrice: 899.00,
      supplier: 'HP France',
    },
    {
      assetTag: 'ELKEM-TB-001',
      serialNumber: 'SN-SAMSUNG-001',
      type: DeviceType.TABLET,
      brand: 'Samsung',
      model: 'Galaxy Tab S9',
      storage: '128GB',
      color: 'Graphite',
      keyboardLayout: KeyboardLayout.QWERTY_US,
      status: DeviceStatus.IN_STOCK,
      condition: DeviceCondition.NEW,
      location: 'Bergen',
      site: 'Entrepôt',
      purchaseDate: new Date('2024-07-01'),
      warrantyExpiry: new Date('2026-07-01'),
      purchasePrice: 799.00,
      supplier: 'Samsung Norway',
    },
    {
      assetTag: 'ELKEM-LT-004',
      serialNumber: 'SN-LENOVO-001',
      type: DeviceType.LAPTOP,
      brand: 'Lenovo',
      model: 'ThinkPad X1 Carbon',
      processor: 'Intel Core i7-1260P',
      ram: '16GB',
      storage: '512GB SSD',
      screenSize: '14"',
      keyboardLayout: KeyboardLayout.QWERTY_UK,
      keyboardLanguage: 'EN',
      status: DeviceStatus.ORDERED,
      condition: DeviceCondition.NEW,
      location: 'Londres',
      site: 'Bureau',
      purchaseDate: new Date('2024-09-01'),
      warrantyExpiry: new Date('2027-09-01'),
      purchasePrice: 1599.00,
      supplier: 'Lenovo UK',
    },
    {
      assetTag: 'ELKEM-LT-005',
      serialNumber: 'SN-DELL-003',
      type: DeviceType.LAPTOP,
      brand: 'Dell',
      model: 'Latitude 7440',
      processor: 'Intel Core i5-1345U',
      ram: '16GB',
      storage: '256GB SSD',
      screenSize: '14"',
      keyboardLayout: KeyboardLayout.AZERTY_FR,
      status: DeviceStatus.LOST,
      condition: DeviceCondition.GOOD,
      location: 'Paris',
      notes: 'Signalé perdu le 15/08/2024 lors d un déplacement professionnel',
      purchaseDate: new Date('2022-05-01'),
      warrantyExpiry: new Date('2025-05-01'),
      purchasePrice: 1150.00,
    },
  ];

  for (const device of devices) {
    await prisma.device.upsert({
      where: { assetTag: device.assetTag },
      update: {},
      create: device,
    });
  }

  console.log('✅ Appareils créés');

  // Créer des logs de maintenance
  const dt001 = await prisma.device.findUnique({ where: { assetTag: 'ELKEM-DT-001' } });
  if (dt001) {
    await prisma.maintenanceLog.create({
      data: {
        deviceId: dt001.id,
        type: 'Remplacement disque dur',
        description: 'Le disque dur d\'origine présentait des secteurs défectueux. Remplacement par un SSD 1TB.',
        cost: 150.00,
        provider: 'Technicien interne',
        startDate: new Date('2024-08-01'),
        resolved: false,
      },
    });
  }

  console.log('✅ Logs de maintenance créés');

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

  // Créer des audit logs de base
  const lt001 = await prisma.device.findUnique({ where: { assetTag: 'ELKEM-LT-001' } });
  if (lt001) {
    await prisma.auditLog.create({
      data: {
        deviceId: lt001.id,
        userId: technician.id,
        action: AuditAction.CREATED,
        comment: 'Appareil créé lors de l\'inventaire initial',
      },
    });
    await prisma.auditLog.create({
      data: {
        deviceId: lt001.id,
        userId: technician.id,
        action: AuditAction.ASSIGNED,
        newValue: viewer.email,
        comment: 'Attribution initiale',
      },
    });
  }

  console.log('✅ Audit logs créés');
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
