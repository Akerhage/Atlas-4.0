import { PrismaClient } from '../src/generated/prisma/client.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
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
  console.log(`✅ Admin user created: ${admin.username} (id: ${admin.id})`);

  const defaults = [
    { key: 'imap_enabled', value: 'true' },
    { key: 'imap_inbound', value: 'false' },
    { key: 'backup_interval_hours', value: '24' },
    { key: 'jwt_expires_in', value: '24h' },
    { key: 'upload_ttl_days', value: '90' },
  ];

  for (const s of defaults) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log(`✅ Default settings created`);
  console.log('\n🎉 Login with: admin / admin123');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
