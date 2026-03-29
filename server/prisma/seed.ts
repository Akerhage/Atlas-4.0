const { PrismaClient } = require('../src/generated/prisma');
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create default admin user
  const adminHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminHash,
      displayName: 'Admin',
      role: 'admin',
      agentColor: '#0071e3',
      avatarId: 0,
    },
  });
  console.log(`✅ Admin user created/verified: ${admin.username} (id: ${admin.id})`);

  // Create default settings
  const defaults = [
    { key: 'imap_enabled', value: 'true' },
    { key: 'imap_inbound', value: 'false' },
    { key: 'backup_interval_hours', value: '24' },
    { key: 'jwt_expires_in', value: '24h' },
    { key: 'upload_ttl_days', value: '90' },
    { key: 'auto_human_exit', value: 'false' },
  ];

  for (const setting of defaults) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`✅ Default settings created (${defaults.length} entries)`);

  console.log('\n🎉 Seed complete. Login with: admin / admin123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
