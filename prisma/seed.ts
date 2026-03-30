import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create permissions
  const permissionDefs = [
    { name: 'users_management', description: 'View and manage users (suspend/reactivate)' },
    { name: 'properties_management', description: 'View and manage listings (suspend/unsuspend)' },
    { name: 'bookings_management', description: 'View booking details' },
    { name: 'reviews_management', description: 'View, hide, and delete reviews' },
    { name: 'financials_management', description: 'View financial data, payments, and payouts' },
    { name: 'reports_management', description: 'View and resolve reports' },
    { name: 'moderators_management', description: 'Create, edit, and delete moderator accounts' },
  ];

  const permissions = [];
  for (const def of permissionDefs) {
    const perm = await prisma.permission.upsert({
      where: { name: def.name },
      update: { description: def.description },
      create: def,
    });
    permissions.push(perm);
  }

  console.log('Permissions created:', permissions.map((p) => p.name).join(', '));

  // 2. Create super_admin role
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'super_admin' },
    update: {},
    create: {
      name: 'super_admin',
      description: 'Super administrator with full access',
    },
  });

  console.log('Role created:', superAdminRole.name);

  // 3. Assign all permissions to super_admin role
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: permission.id,
      },
    });
  }

  console.log('All permissions assigned to super_admin role');

  // 4. Create admin moderator
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const adminModerator = await prisma.moderator.upsert({
    where: { email: 'admin@unesta.com' },
    update: {},
    create: {
      email: 'admin@unesta.com',
      password: hashedPassword,
    },
  });

  console.log('Admin moderator created:', adminModerator.email);

  // 5. Assign role to moderator
  await prisma.moderatorRole.upsert({
    where: {
      moderatorId_roleId: {
        moderatorId: adminModerator.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      moderatorId: adminModerator.id,
      roleId: superAdminRole.id,
    },
  });

  console.log('Role assigned to admin moderator');

  // 6. Create test user
  const testUser = await prisma.user.upsert({
    where: { phone: '+919999999999' },
    update: {},
    create: {
      phone: '+919999999999',
      firstName: 'Test',
      lastName: 'User',
      role: 'BOTH',
      isPhoneVerified: true,
    },
  });

  console.log('Test user created:', testUser.phone);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
