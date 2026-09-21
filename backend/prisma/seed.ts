import { PrismaClient, RoleName, LocationDirection, BeneficiaryStatus, LandStatus, ProjectStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Database Seeding ---');

  // 1. Roles
  const roles = [
    { name: RoleName.ADMIN, description: 'Full administrative access and approval authority' },
    { name: RoleName.FIELD_OFFICER, description: 'Field operations, beneficiary & land onboarding, application submission' },
    { name: RoleName.ACCOUNTS, description: 'Billing management, payment recording, and financial reconciliation' },
    { name: RoleName.VIEWER, description: 'Read-only access for audits and monitoring' },
  ];

  const roleMap: Record<RoleName, string> = {} as any;
  for (const role of roles) {
    const createdRole = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
    roleMap[role.name] = createdRole.role_id;
  }
  console.log('Seeded Roles: ADMIN, FIELD_OFFICER, ACCOUNTS, VIEWER');

  // 2. Demo Users for all roles
  const passwordHash = await bcrypt.hash('Admin@123456', 10);
  const demoUsers = [
    { email: 'admin@water.gov', name: 'Chief Administrator', role: RoleName.ADMIN },
    { email: 'field@water.gov', name: 'R. Kaliappan (Field Officer)', role: RoleName.FIELD_OFFICER },
    { email: 'accounts@water.gov', name: 'S. Muthusamy (Accounts Officer)', role: RoleName.ACCOUNTS },
    { email: 'viewer@water.gov', name: 'Auditor Viewer', role: RoleName.VIEWER },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { full_name: u.name, role_id: roleMap[u.role], is_active: true },
      create: {
        email: u.email,
        password_hash: passwordHash,
        full_name: u.name,
        role_id: roleMap[u.role],
        is_active: true,
      },
    });
  }
  console.log('Seeded Users: admin@water.gov, field@water.gov, accounts@water.gov, viewer@water.gov (password: Admin@123456)');

  // 3. Location Hierarchy: District -> Panchayat -> Village
  const district = await prisma.district.upsert({
    where: { name: 'Coimbatore' },
    update: {},
    create: { name: 'Coimbatore' },
  });

  const panchayatNorth = await prisma.panchayat.upsert({
    where: {
      district_id_name: {
        district_id: district.district_id,
        name: 'Pollachi North',
      },
    },
    update: {},
    create: {
      district_id: district.district_id,
      name: 'Pollachi North',
    },
  });

  const panchayatSouth = await prisma.panchayat.upsert({
    where: {
      district_id_name: {
        district_id: district.district_id,
        name: 'Pollachi South',
      },
    },
    update: {},
    create: {
      district_id: district.district_id,
      name: 'Pollachi South',
    },
  });

  const village1 = await prisma.village.upsert({
    where: {
      panchayat_id_name: {
        panchayat_id: panchayatNorth.panchayat_id,
        name: 'Annamalai',
      },
    },
    update: {},
    create: {
      panchayat_id: panchayatNorth.panchayat_id,
      name: 'Annamalai',
    },
  });

  const village2 = await prisma.village.upsert({
    where: {
      panchayat_id_name: {
        panchayat_id: panchayatSouth.panchayat_id,
        name: 'Kinathukadavu',
      },
    },
    update: {},
    create: {
      panchayat_id: panchayatSouth.panchayat_id,
      name: 'Kinathukadavu',
    },
  });
  console.log('Seeded Locations: Coimbatore -> Pollachi North/South -> Annamalai/Kinathukadavu');

  // 4. Project
  const project = await prisma.project.upsert({
    where: { project_code: 'WMP-2026-01' },
    update: {},
    create: {
      project_code: 'WMP-2026-01',
      project_name: 'Kongu Micro-Irrigation & Sustainable Water Project',
      description: 'First phase water distribution, development billing, and commissioning grid.',
      status: ProjectStatus.ACTIVE,
      start_date: new Date('2026-01-01'),
      end_date: new Date('2028-12-31'),
    },
  });
  console.log(`Seeded Project: ${project.project_code} - ${project.project_name}`);

  // 5. Versioned Rate Configuration
  // Example: Litres/Acre = 10,000, Dev Cost/L = 2.00, Running Cost/L = 0.50
  const existingRate = await prisma.rateConfiguration.findFirst({
    where: { project_id: project.project_id, is_active: true },
  });

  let rateId: string;
  if (!existingRate) {
    const rate = await prisma.rateConfiguration.create({
      data: {
        project_id: project.project_id,
        litres_per_acre: new Decimal(10000),
        development_cost_per_litre: new Decimal(2.00),
        running_cost_per_litre: new Decimal(0.50),
        effective_from: new Date('2026-01-01T00:00:00Z'),
        is_active: true,
        created_by: 'admin@water.gov',
      },
    });
    rateId = rate.rate_id;
    console.log('Seeded Rate Configuration: 10,000 L/Acre, ₹2.00/L dev, ₹0.50/L running');
  } else {
    rateId = existingRate.rate_id;
  }

  // 6. Installment Schedule Template (1=2.5%, 2=20%, 3=25%, 4=25%, 5=27.5%)
  const existingTemplate = await prisma.installmentTemplate.findFirst({
    where: { project_id: project.project_id, is_active: true },
  });

  if (!existingTemplate) {
    await prisma.installmentTemplate.create({
      data: {
        project_id: project.project_id,
        name: 'Standard 5-Stage Schedule (2.5 - 20 - 25 - 25 - 27.5)',
        inst_1_pct: new Decimal(2.50),
        inst_2_pct: new Decimal(20.00),
        inst_3_pct: new Decimal(25.00),
        inst_4_pct: new Decimal(25.00),
        inst_5_pct: new Decimal(27.50),
        is_active: true,
        created_by: 'admin@water.gov',
      },
    });
    console.log('Seeded Installment Template: 2.5% / 20% / 25% / 25% / 27.5% (Total: 100%)');
  }

  // 7. Starter Beneficiary with land holdings & parcels for immediate test drive
  const samplePhone = '9876543210';
  const existingBeneficiary = await prisma.beneficiary.findFirst({
    where: { phone_number: samplePhone },
  });

  if (!existingBeneficiary) {
    const beneficiary = await prisma.beneficiary.create({
      data: {
        name: 'Ramasamy Gounder',
        phone_number: samplePhone,
        address_line_1: 'Survey Field 101, Near North Canal',
        address_line_2: 'Annamalai Village',
        district_id: district.district_id,
        panchayat_id: panchayatNorth.panchayat_id,
        village_id: village1.village_id,
        pincode: '642001',
        location_direction: LocationDirection.NORTH,
        location_description: 'North-facing canal border farm',
        status: BeneficiaryStatus.ACTIVE,
      },
    });

    // Add Land Holding with 2 parcels: 2.5 + 2.5 = 5.0 acres
    const landHolding = await prisma.landHolding.create({
      data: {
        beneficiary_id: beneficiary.beneficiary_id,
        project_id: project.project_id,
        declared_total_area: new Decimal(5.0000),
        area_unit: 'ACRES',
        status: LandStatus.ACTIVE,
      },
    });

    await prisma.landParcel.createMany({
      data: [
        {
          land_id: landHolding.land_id,
          survey_number: '101',
          subdivision_number: '1A',
          area: new Decimal(2.5000),
          area_unit: 'ACRES',
        },
        {
          land_id: landHolding.land_id,
          survey_number: '101',
          subdivision_number: '1B',
          area: new Decimal(2.5000),
          area_unit: 'ACRES',
        },
      ],
    });

    console.log('Seeded Sample Beneficiary: Ramasamy Gounder (9876543210) with 5.0 acres land in 2 parcels');
  }

  console.log('--- Database Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
