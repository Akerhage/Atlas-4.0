const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '..', '..', 'atlas.db');
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`📂 Seeding database: ${dbPath}\n`);

  // ============================================
  // USERS
  // ============================================
  const adminHash = await bcrypt.hash('admin123', 12);
  const agentHash = await bcrypt.hash('agent123', 12);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: adminHash, displayName: 'Patrik', role: 'admin', agentColor: '#0071e3', avatarId: 0, statusText: 'Tillgänglig' },
  });

  const agent1 = await prisma.user.upsert({
    where: { username: 'sara' },
    update: {},
    create: { username: 'sara', passwordHash: agentHash, displayName: 'Sara Lindgren', role: 'agent', agentColor: '#e74c3c', avatarId: 5, statusText: '' },
  });

  const agent2 = await prisma.user.upsert({
    where: { username: 'johan' },
    update: {},
    create: { username: 'johan', passwordHash: agentHash, displayName: 'Johan Eriksson', role: 'agent', agentColor: '#2ecc71', avatarId: 3, statusText: 'Lunch 12-13' },
  });

  const agent3 = await prisma.user.upsert({
    where: { username: 'maria' },
    update: {},
    create: { username: 'maria', passwordHash: agentHash, displayName: 'Maria Andersson', role: 'agent', agentColor: '#9b59b6', avatarId: 7, statusText: '' },
  });

  console.log(`✅ Users: admin (admin123), sara/johan/maria (agent123)`);

  // ============================================
  // OFFICES
  // ============================================
  const offices = [
    { name: 'MDA Göteborg Ullevi', routingTag: 'goteborg_ullevi', city: 'Göteborg', area: 'Ullevi', officeColor: '#926b16', phone: '031-123 45 67', email: 'ullevi@trafikskola.se' },
    { name: 'MDA Göteborg Högsbo', routingTag: 'goteborg_hogsbo', city: 'Göteborg', area: 'Högsbo', officeColor: '#c0392b', phone: '031-234 56 78', email: 'hogsbo@trafikskola.se' },
    { name: 'MDA Stockholm City', routingTag: 'stockholm_city', city: 'Stockholm', area: 'City', officeColor: '#2980b9', phone: '08-123 45 67', email: 'city@trafikskola.se' },
    { name: 'MDA Malmö Bulltofta', routingTag: 'malmo_bulltofta', city: 'Malmö', area: 'Bulltofta', officeColor: '#27ae60', phone: '040-123 45 67', email: 'bulltofta@trafikskola.se' },
    { name: 'MDA Helsingborg', routingTag: 'helsingborg_halsobacken', city: 'Helsingborg', area: 'Hälsobacken', officeColor: '#8e44ad', phone: '042-123 45 67', email: 'helsingborg@trafikskola.se' },
  ];

  for (const o of offices) {
    await prisma.office.upsert({ where: { routingTag: o.routingTag }, update: {}, create: o });
  }
  console.log(`✅ Offices: ${offices.length} kontor`);

  // Assign agents to offices
  const gbgUllevi = await prisma.office.findUnique({ where: { routingTag: 'goteborg_ullevi' } });
  const gbgHogsbo = await prisma.office.findUnique({ where: { routingTag: 'goteborg_hogsbo' } });
  const sthlmCity = await prisma.office.findUnique({ where: { routingTag: 'stockholm_city' } });

  const assignments = [
    { userId: admin.id, officeId: gbgUllevi.id },
    { userId: agent1.id, officeId: gbgUllevi.id },
    { userId: agent1.id, officeId: gbgHogsbo.id },
    { userId: agent2.id, officeId: sthlmCity.id },
    { userId: agent3.id, officeId: gbgHogsbo.id },
  ];

  for (const a of assignments) {
    await prisma.userOffice.upsert({
      where: { userId_officeId: { userId: a.userId, officeId: a.officeId } },
      update: {},
      create: a,
    });
  }
  console.log(`✅ Office assignments: ${assignments.length} kopplingar`);

  // ============================================
  // TICKETS (diverse testdata)
  // ============================================
  const tickets = [
    // Nya livechattar (open, no owner)
    {
      id: 'chat_live_001', channel: 'chat', status: 'open', humanMode: true,
      customerName: 'Erik Svensson', customerEmail: 'erik@example.com', customerPhone: '070-123 45 67',
      lastMessage: 'Hej, jag vill veta mer om ert körkortspaket!', vehicle: 'BIL',
      officeId: gbgUllevi.id,
    },
    {
      id: 'chat_live_002', channel: 'chat', status: 'open', humanMode: true,
      customerName: 'Anna Johansson', customerEmail: 'anna@example.com',
      lastMessage: 'Vad kostar MC-kort hos er?', vehicle: 'MC',
      officeId: gbgHogsbo.id,
    },
    {
      id: 'chat_live_003', channel: 'chat', status: 'open', humanMode: true,
      customerName: 'Mohammed Al-Rashid', customerEmail: 'mo@example.com',
      lastMessage: 'I would like to book a test lesson please', vehicle: 'BIL',
      officeId: sthlmCity.id,
    },

    // Nya mail-ärenden (open, no owner)
    {
      id: 'mail_inbound_001', channel: 'mail', status: 'open', humanMode: true,
      customerName: 'Lisa Borg', customerEmail: 'lisa.borg@gmail.com',
      lastMessage: 'Hej! Jag undrar om ni har några lediga tider för intensivkurs i augusti?',
      subject: 'Intensivkurs augusti', officeId: gbgUllevi.id,
    },
    {
      id: 'mail_inbound_002', channel: 'mail', status: 'open', humanMode: true,
      customerName: 'Per Nilsson', customerEmail: 'per.nilsson@hotmail.com',
      lastMessage: 'Mitt paket gick ut förra månaden, kan jag förlänga det?',
      subject: 'Förlängning av paket', officeId: sthlmCity.id,
    },

    // Plockade ärenden (claimed by agents)
    {
      id: 'chat_claimed_001', channel: 'chat', status: 'claimed', humanMode: true,
      customerName: 'Sofia Pettersson', customerEmail: 'sofia@example.com', customerPhone: '073-987 65 43',
      lastMessage: 'Tack för hjälpen! Jag vill boka in mig på risk 1 också.',
      vehicle: 'BIL', ownerId: agent1.id, officeId: gbgUllevi.id,
    },
    {
      id: 'chat_claimed_002', channel: 'chat', status: 'claimed', humanMode: true,
      customerName: 'Oscar Bergström', customerEmail: 'oscar@example.com',
      lastMessage: 'Kan jag byta från manuell till automat mitt i paketet?',
      vehicle: 'BIL', ownerId: agent2.id, officeId: sthlmCity.id,
    },
    {
      id: 'mail_claimed_001', channel: 'mail', status: 'claimed', humanMode: true,
      customerName: 'Karin Lund', customerEmail: 'karin.lund@company.se',
      lastMessage: 'Jag behöver avboka min lektion imorgon pga sjukdom.',
      subject: 'Avbokning lektion', ownerId: admin.id, officeId: gbgUllevi.id,
    },

    // Arkiverade ärenden
    {
      id: 'chat_archived_001', channel: 'chat', status: 'closed', humanMode: false,
      customerName: 'David Ek', customerEmail: 'david@example.com',
      lastMessage: 'Perfekt, då ses vi på tisdag!', vehicle: 'BIL',
      ownerId: agent1.id, officeId: gbgUllevi.id, closeReason: 'Löst',
      archivedAt: new Date('2026-03-25'),
    },
    {
      id: 'mail_archived_001', channel: 'mail', status: 'closed', humanMode: false,
      customerName: 'Elin Forsberg', customerEmail: 'elin@example.com',
      lastMessage: 'Tack för snabbt svar, vi hörs!',
      subject: 'Fråga om presentkort', ownerId: agent3.id, officeId: gbgHogsbo.id, closeReason: 'Löst',
      archivedAt: new Date('2026-03-20'),
    },
    {
      id: 'chat_archived_002', channel: 'chat', status: 'closed', humanMode: false,
      customerName: 'Ali Hassan', customerEmail: 'ali@example.com',
      lastMessage: 'Ok tack, jag bokar via hemsidan.', vehicle: 'MC',
      ownerId: agent2.id, officeId: sthlmCity.id, closeReason: 'Kund bokade själv',
      archivedAt: new Date('2026-03-15'),
    },
  ];

  for (const t of tickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: t,
    });
  }
  console.log(`✅ Tickets: ${tickets.length} ärenden (3 live-chattar, 2 mail, 3 plockade, 3 arkiverade)`);

  // ============================================
  // MESSAGES (konversationshistorik)
  // ============================================
  const messages = [
    // Live chat 001
    { ticketId: 'chat_live_001', role: 'customer', content: 'Hej, jag vill veta mer om ert körkortspaket!' },
    { ticketId: 'chat_live_001', role: 'atlas', content: 'Hej Erik! Vi har flera paket att välja mellan. Vårt populäraste är Baspaketet som inkluderar 15 lektioner, Risk 1 och Risk 2. Vilken stad gäller det?' },
    { ticketId: 'chat_live_001', role: 'customer', content: 'Göteborg, Ullevi-kontoret' },

    // Claimed chat 001
    { ticketId: 'chat_claimed_001', role: 'customer', content: 'Hej, jag har frågor om mitt paket' },
    { ticketId: 'chat_claimed_001', role: 'atlas', content: 'Hej Sofia! Vad kan jag hjälpa dig med?' },
    { ticketId: 'chat_claimed_001', role: 'customer', content: 'Jag vill prata med människa' },
    { ticketId: 'chat_claimed_001', role: 'system', content: 'Kund eskalerade till live-chatt' },
    { ticketId: 'chat_claimed_001', role: 'agent', content: 'Hej Sofia! Jag heter Sara och hjälper dig gärna. Vad gäller det?' },
    { ticketId: 'chat_claimed_001', role: 'customer', content: 'Tack för hjälpen! Jag vill boka in mig på risk 1 också.' },

    // Claimed chat 002
    { ticketId: 'chat_claimed_002', role: 'customer', content: 'Kan jag byta från manuell till automat mitt i paketet?' },
    { ticketId: 'chat_claimed_002', role: 'agent', content: 'Hej Oscar! Ja, det går bra att byta. Det tillkommer dock villkor 78 på ditt körkort om du gör uppkörningen på automat.' },

    // Mail claimed
    { ticketId: 'mail_claimed_001', role: 'customer', content: 'Hej!\n\nJag behöver avboka min lektion imorgon pga sjukdom. Kan ni hjälpa mig?\n\nMvh Karin', isEmail: true },
    { ticketId: 'mail_claimed_001', role: 'agent', content: 'Hej Karin!\n\nSjälvklart. Du debiteras inte om du uppvisar giltigt läkarintyg inom 1 vecka. Skicka det till oss så ordnar vi resten.\n\nMed vänliga hälsningar\nPatrik', isEmail: true },

    // Mail inbound 001
    { ticketId: 'mail_inbound_001', role: 'customer', content: 'Hej! Jag undrar om ni har några lediga tider för intensivkurs i augusti? Jag bor i Göteborg.', isEmail: true },

    // Archived
    { ticketId: 'chat_archived_001', role: 'customer', content: 'Vilken tid är min lektion på tisdag?' },
    { ticketId: 'chat_archived_001', role: 'agent', content: 'Din lektion är kl 14:00 på tisdag. Glöm inte ta med dig legitimation!' },
    { ticketId: 'chat_archived_001', role: 'customer', content: 'Perfekt, då ses vi på tisdag!' },
  ];

  for (const m of messages) {
    await prisma.message.create({ data: m });
  }
  console.log(`✅ Messages: ${messages.length} meddelanden`);

  // ============================================
  // TEMPLATES
  // ============================================
  const templates = [
    {
      name: 'Välkomstmail',
      subject: 'Välkommen till My Driving Academy!',
      body: '<p>Hej!</p><p>Tack för att du valt oss för din körkortsutbildning. Vi ser fram emot att hjälpa dig!</p><p>Boka din första lektion via vår hemsida eller ring oss.</p><p>Med vänliga hälsningar,<br>My Driving Academy</p>',
      category: 'BIL',
    },
    {
      name: 'Påminnelse Risk 1',
      subject: 'Påminnelse: Risk 1 utbildning',
      body: '<p>Hej!</p><p>Vi vill påminna om din kommande Risk 1 utbildning. Kursen är cirka 3,5 timmar.</p><p><strong>Kom ihåg:</strong></p><ul><li>Ta med giltig legitimation</li><li>Var på plats 10 minuter innan start</li></ul><p>Mvh,<br>My Driving Academy</p>',
      category: 'BIL',
    },
    {
      name: 'Avbokning bekräftelse',
      subject: 'Bekräftelse på avbokning',
      body: '<p>Hej!</p><p>Vi bekräftar härmed att din lektion har avbokats.</p><p>Vid sjukdom: du debiteras inte om giltigt läkarintyg skickas in inom 1 vecka.</p><p>Vill du boka en ny tid? Kontakta oss eller boka via hemsidan.</p><p>Mvh,<br>My Driving Academy</p>',
      category: 'BIL',
    },
    {
      name: 'MC-säsong start',
      subject: 'MC-säsongen har börjat!',
      body: '<p>Hej!</p><p>Nu är MC-säsongen igång! Vi erbjuder MC-utbildning från mars/april till oktober/november.</p><p>Boka din plats redan idag — populära tider fylls snabbt.</p><p>Mvh,<br>My Driving Academy</p>',
      category: 'MC',
    },
  ];

  for (const t of templates) {
    const exists = await prisma.template.findFirst({ where: { name: t.name } });
    if (!exists) await prisma.template.create({ data: t });
  }
  console.log(`✅ Templates: ${templates.length} mailmallar`);

  // ============================================
  // TICKET NOTES
  // ============================================
  const notes = [
    { ticketId: 'chat_claimed_001', agentId: agent1.id, content: 'Kund vill boka Risk 1. Kollat tillgänglighet — ledig plats 5 april.' },
    { ticketId: 'mail_claimed_001', agentId: admin.id, content: 'Kund skickar läkarintyg inom veckan. Följ upp om det inte kommer.' },
    { ticketId: 'chat_claimed_002', agentId: agent2.id, content: 'Informerat om villkor 78. Kund funderar.' },
  ];

  for (const n of notes) {
    await prisma.ticketNote.create({ data: n });
  }
  console.log(`✅ Notes: ${notes.length} anteckningar`);

  // ============================================
  // SETTINGS
  // ============================================
  const settings = [
    { key: 'imap_enabled', value: 'true' },
    { key: 'imap_inbound', value: 'false' },
    { key: 'backup_interval_hours', value: '24' },
    { key: 'jwt_expires_in', value: '24h' },
    { key: 'upload_ttl_days', value: '90' },
    { key: 'auto_human_exit', value: 'false' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log(`✅ Settings: ${settings.length} inställningar`);

  console.log('\n🎉 Seed klar! Logga in med:');
  console.log('   Admin:  admin / admin123');
  console.log('   Agent:  sara / agent123');
  console.log('   Agent:  johan / agent123');
  console.log('   Agent:  maria / agent123');
}

main()
  .catch(e => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
