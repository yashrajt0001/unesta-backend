import { PrismaClient, AmenityCategory } from '@prisma/client';
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
  const hashedPassword = await bcrypt.hash('Admin@123', 12);

  const adminModerator = await prisma.moderator.upsert({
    where: { email: 'admin@unesta.com' },
    update: { password: hashedPassword },
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

  // 7. Seed amenities (reference data — icons are Material Symbols names)
  const amenityDefs: { name: string; icon: string; category: AmenityCategory }[] = [
    // Essentials
    { name: 'Wifi', icon: 'wifi', category: 'ESSENTIALS' },
    { name: 'Kitchen', icon: 'cooking', category: 'ESSENTIALS' },
    { name: 'Refrigerator', icon: 'kitchen', category: 'ESSENTIALS' },
    { name: 'Microwave', icon: 'microwave', category: 'ESSENTIALS' },
    { name: 'Air Conditioning', icon: 'ac_unit', category: 'ESSENTIALS' },
    { name: 'Heating', icon: 'mode_heat', category: 'ESSENTIALS' },
    { name: 'Hot Water', icon: 'water_heater', category: 'ESSENTIALS' },
    { name: 'Drinking Water', icon: 'water_drop', category: 'ESSENTIALS' },
    { name: 'Power Backup', icon: 'power', category: 'ESSENTIALS' },
    { name: 'TV', icon: 'tv', category: 'ESSENTIALS' },
    { name: 'Washing Machine', icon: 'local_laundry_service', category: 'ESSENTIALS' },
    { name: 'Dryer', icon: 'dry_cleaning', category: 'ESSENTIALS' },
    { name: 'Iron', icon: 'iron', category: 'ESSENTIALS' },
    { name: 'Hair Dryer', icon: 'dry', category: 'ESSENTIALS' },
    { name: 'Towels & Bed Linen', icon: 'bed', category: 'ESSENTIALS' },
    { name: 'Dedicated Workspace', icon: 'desk', category: 'ESSENTIALS' },
    { name: 'Free Parking', icon: 'local_parking', category: 'ESSENTIALS' },
    { name: 'Elevator', icon: 'elevator', category: 'ESSENTIALS' },

    // Features
    { name: 'Swimming Pool', icon: 'pool', category: 'FEATURES' },
    { name: 'Gym', icon: 'fitness_center', category: 'FEATURES' },
    { name: 'Hot Tub', icon: 'hot_tub', category: 'FEATURES' },
    { name: 'Bathtub', icon: 'bathtub', category: 'FEATURES' },
    { name: 'Balcony', icon: 'balcony', category: 'FEATURES' },
    { name: 'Terrace', icon: 'deck', category: 'FEATURES' },
    { name: 'Garden', icon: 'yard', category: 'FEATURES' },
    { name: 'BBQ Grill', icon: 'outdoor_grill', category: 'FEATURES' },
    { name: 'Fire Pit', icon: 'local_fire_department', category: 'FEATURES' },
    { name: 'Dishwasher', icon: 'dishwasher', category: 'FEATURES' },
    { name: 'Coffee Maker', icon: 'coffee_maker', category: 'FEATURES' },
    { name: 'Breakfast Included', icon: 'free_breakfast', category: 'FEATURES' },
    { name: 'Housekeeping', icon: 'cleaning_services', category: 'FEATURES' },
    { name: 'Air Purifier', icon: 'air', category: 'FEATURES' },
    { name: 'Sound System', icon: 'speaker', category: 'FEATURES' },
    { name: 'Projector', icon: 'theaters', category: 'FEATURES' },
    { name: 'Game Console', icon: 'sports_esports', category: 'FEATURES' },
    { name: 'Board Games', icon: 'casino', category: 'FEATURES' },
    { name: 'Books', icon: 'menu_book', category: 'FEATURES' },
    { name: 'Piano', icon: 'piano', category: 'FEATURES' },
    { name: 'Beach Essentials', icon: 'surfing', category: 'FEATURES' },
    { name: 'EV Charger', icon: 'ev_station', category: 'FEATURES' },
    { name: 'Pet Friendly', icon: 'pets', category: 'FEATURES' },
    { name: 'Smoking Allowed', icon: 'smoking_rooms', category: 'FEATURES' },
    { name: 'Wheelchair Accessible', icon: 'accessible', category: 'FEATURES' },
    { name: 'Baby Cot', icon: 'crib', category: 'FEATURES' },
    { name: 'High Chair', icon: 'child_care', category: 'FEATURES' },

    // Safety
    { name: 'Smoke Alarm', icon: 'detector_smoke', category: 'SAFETY' },
    { name: 'Carbon Monoxide Alarm', icon: 'detector_co', category: 'SAFETY' },
    { name: 'Fire Extinguisher', icon: 'fire_extinguisher', category: 'SAFETY' },
    { name: 'First Aid Kit', icon: 'medical_services', category: 'SAFETY' },
    { name: 'Security Cameras', icon: 'videocam', category: 'SAFETY' },
    { name: '24/7 Security', icon: 'local_police', category: 'SAFETY' },
    { name: 'Gated Property', icon: 'fence', category: 'SAFETY' },
    { name: 'Private Entrance', icon: 'door_front', category: 'SAFETY' },
    { name: 'Bedroom Door Lock', icon: 'lock', category: 'SAFETY' },
    { name: 'Emergency Exit', icon: 'emergency', category: 'SAFETY' },

    // Location
    { name: 'Beachfront', icon: 'beach_access', category: 'LOCATION' },
    { name: 'Lakefront', icon: 'sailing', category: 'LOCATION' },
    { name: 'Sea View', icon: 'waves', category: 'LOCATION' },
    { name: 'Lake View', icon: 'water', category: 'LOCATION' },
    { name: 'Mountain View', icon: 'landscape', category: 'LOCATION' },
    { name: 'City View', icon: 'location_city', category: 'LOCATION' },
    { name: 'Garden View', icon: 'local_florist', category: 'LOCATION' },
    { name: 'Ski-in / Ski-out', icon: 'downhill_skiing', category: 'LOCATION' },
    { name: 'Near Public Transport', icon: 'directions_transit', category: 'LOCATION' },
    { name: 'Near Airport', icon: 'flight', category: 'LOCATION' },
    { name: 'City Centre', icon: 'apartment', category: 'LOCATION' },
    { name: 'Countryside', icon: 'agriculture', category: 'LOCATION' },
  ];

  // sortOrder is assigned per category, following the order listed above
  const categoryCounters: Record<string, number> = {};
  for (const def of amenityDefs) {
    const sortOrder = (categoryCounters[def.category] = (categoryCounters[def.category] ?? 0) + 1);
    await prisma.amenity.upsert({
      where: { name: def.name },
      update: { icon: def.icon, category: def.category, sortOrder },
      create: { ...def, sortOrder },
    });
  }

  console.log('Amenities seeded:', amenityDefs.length);

  // 8. Seed rule templates (reference data — hosts pick these, or type their own)
  const ruleTemplateDefs = [
    'No smoking',
    'No parties or events',
    'No pets',
    'No unregistered guests',
    'Quiet hours after 10 PM',
    'No loud music',
    'Remove shoes indoors',
    'No food in the bedrooms',
    'Keep the property clean',
    'Dispose of garbage in the bins provided',
    'Do not move the furniture',
    'Switch off lights, fans, and AC when leaving',
    'No commercial photography or filming',
    'Valid government ID required at check-in',
    'Children must be supervised at all times',
    'Report any damage to the host',
  ];

  for (const [i, text] of ruleTemplateDefs.entries()) {
    await prisma.ruleTemplate.upsert({
      where: { text },
      update: { sortOrder: i + 1 },
      create: { text, sortOrder: i + 1 },
    });
  }

  console.log('Rule templates seeded:', ruleTemplateDefs.length);

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
