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
  // ALL 47 OFFICES (from knowledge/*.json)
  // ============================================
  const offices = [
    // Göteborg (My Driving Academy) — 10 kontor
    { name: 'My Driving Academy - Göteborg Ullevi', routingTag: 'my_driving_academy_goteborg_ullevi', city: 'Göteborg', area: 'Ullevi', officeColor: '#926b16', phone: '0313362665', email: 'goteborg.ullevi@trafikskolan.com' },
    { name: 'My Driving Academy - Göteborg Högsbo', routingTag: 'my_driving_academy_goteborg_hogsbo', city: 'Göteborg', area: 'Högsbo', officeColor: '#926b16', phone: '0313756037', email: 'hogsbo@mydrivingacademy.se' },
    { name: 'My Driving Academy - Göteborg Hovås', routingTag: 'my_driving_academy_goteborg_hovas', city: 'Göteborg', area: 'Hovås', officeColor: '#926b16', phone: '031-19 99 99', email: 'hovas@mydrivingacademy.se' },
    { name: 'My Driving Academy - Göteborg Mölndal', routingTag: 'my_driving_academy_goteborg_molndal', city: 'Göteborg', area: 'Mölndal', officeColor: '#926b16', phone: '0317305460', email: 'molndal@trafikskolan.com' },
    { name: 'My Driving Academy - Göteborg Mölnlycke', routingTag: 'my_driving_academy_goteborg_molnlycke', city: 'Göteborg', area: 'Mölnlycke', officeColor: '#926b16', phone: '031885880', email: 'molnlycke@trafikskolan.com' },
    { name: 'My Driving Academy - Göteborg Västra Frölunda', routingTag: 'my_driving_academy_goteborg_vastra_frolunda', city: 'Göteborg', area: 'Västra Frölunda', officeColor: '#926b16', phone: '031456763', email: 'vastra.frolunda@trafikskolan.com' },
    { name: 'My Driving Academy - Göteborg Stora Holm', routingTag: 'my_driving_academy_goteborg_storaholm', city: 'Göteborg', area: 'Stora Holm', officeColor: '#926b16', phone: '031-336 26 65', email: 'goteborg.ullevi@trafikskolan.com' },
    { name: 'My Driving Academy - Göteborg Åby (Bana)', routingTag: 'my_driving_academy_goteborg_aby', city: 'Göteborg', area: 'Åby', officeColor: '#926b16', phone: '031-19 99 99', email: 'hej@mydrivingacademy.com' },
    { name: 'My Driving Academy - Göteborg Kungälv', routingTag: 'my_driving_academy_goteborg_kungalv', city: 'Göteborg', area: 'Kungälv', officeColor: '#926b16', phone: '031-19 99 99', email: 'info@kskolan.com' },
    { name: 'My Driving Academy - Göteborg Dingle', routingTag: 'my_driving_academy_goteborg_dingle', city: 'Göteborg', area: 'Dingle', officeColor: '#926b16', phone: '010-20 70 775', email: 'hovass@mydrivingacademy.se' },

    // Stockholm (My Driving Academy) — 7 kontor
    { name: 'My Driving Academy - Stockholm Kungsholmen', routingTag: 'my_driving_academy_stockholm_kungsholmen_lindhagsplan', city: 'Stockholm', area: 'Kungsholmen Lindhagsplan', officeColor: '#e77476', phone: '010-20 70 775', email: 'hej@mydrivingacademy.com' },
    { name: 'My Driving Academy - Stockholm Östermalm', routingTag: 'my_driving_academy_stockholm_ostermalm', city: 'Stockholm', area: 'Östermalm', officeColor: '#e77476', phone: '010-20 70 775', email: 'hej@mydrivingacademy.com' },
    { name: 'My Driving Academy - Stockholm Södermalm', routingTag: 'my_driving_academy_stockholm_sodermalm', city: 'Stockholm', area: 'Södermalm', officeColor: '#e77476', phone: '010-20 70 775', email: 'hej@mydrivingacademy.com' },
    { name: 'My Driving Academy - Stockholm Solna', routingTag: 'my_driving_academy_stockholm_solna', city: 'Stockholm', area: 'Solna', officeColor: '#e77476', phone: '010-20 70 775', email: 'hej@mydrivingacademy.com' },
    { name: 'My Driving Academy - Stockholm Djursholm', routingTag: 'my_driving_academy_stockholm_djursholm', city: 'Stockholm', area: 'Djursholm', officeColor: '#e77476', phone: '010-20 70 775', email: 'hej@mydrivingacademy.com' },
    { name: 'My Driving Academy - Stockholm Enskededalen', routingTag: 'my_driving_academy_stockholm_enskededalen', city: 'Stockholm', area: 'Enskededalen', officeColor: '#e77476', phone: '010-20 70 775', email: 'hej@mydrivingacademy.com' },
    { name: 'My Driving Academy - Stockholm Österåker', routingTag: 'my_driving_academy_stockholm_osteraker', city: 'Stockholm', area: 'Österåker', officeColor: '#e77476', phone: '010-20 70 775', email: 'hej@mydrivingacademy.com' },

    // Malmö (Mårtenssons) — 8 kontor
    { name: 'Mårtenssons - Malmö Bulltofta', routingTag: 'martenssons_trafikskola_malmo_bulltofta', city: 'Malmö', area: 'Bulltofta', officeColor: '#1f558b', phone: '010-333 32 31', email: 'bulltofta@trafikskolan.com' },
    { name: 'Mårtenssons - Malmö City', routingTag: 'martenssons_trafikskola_malmo_city', city: 'Malmö', area: 'City', officeColor: '#1f558b', phone: '040-64 39 535', email: 'malmo.city@trafikskolan.com' },
    { name: 'Mårtenssons - Malmö Limhamn', routingTag: 'martenssons_trafikskola_malmo_limhamn', city: 'Malmö', area: 'Limhamn', officeColor: '#1f558b', phone: '040-643 42 99', email: 'limhamn@trafikskolan.com' },
    { name: 'Mårtenssons - Malmö Södervärn', routingTag: 'martenssons_trafikskola_malmo_sodervarn', city: 'Malmö', area: 'Södervärn', officeColor: '#1f558b', phone: '040-643 42 85', email: 'malmo.sodervarn@trafikskolan.com' },
    { name: 'Mårtenssons - Malmö Triangeln', routingTag: 'martenssons_trafikskola_malmo_triangeln', city: 'Malmö', area: 'Triangeln', officeColor: '#1f558b', phone: '040-643 42 82', email: 'malmo.trianglen@trafikskolan.com' },
    { name: 'Mårtenssons - Malmö Värnhem', routingTag: 'martenssons_trafikskola_malmo_varnhem', city: 'Malmö', area: 'Värnhem', officeColor: '#1f558b', phone: '040-18 35 18', email: 'malmo.varnhem@trafikskolan.com' },
    { name: 'Mårtenssons - Malmö Västra Hamnen', routingTag: 'martenssons_trafikskola_malmo_vastra_hamnen', city: 'Malmö', area: 'Västra Hamnen', officeColor: '#1f558b', phone: '040-643 42 84', email: 'malmo.vastra.hamnen@trafikskolan.com' },
    { name: 'Mårtenssons - Malmö Jägersro (Tung)', routingTag: 'martenssons_trafikskola_malmo_jagersro', city: 'Malmö', area: 'Jägersro', officeColor: '#1f558b', phone: '010-188 83 26', email: 'tungtrafik@trafikskolan.com' },

    // Helsingborg (Mårtenssons) — 2 kontor
    { name: 'Mårtenssons - Helsingborg City', routingTag: 'martenssons_trafikskola_helsingborg_city', city: 'Helsingborg', area: 'City', officeColor: '#712f9d', phone: '042-301 78 80', email: 'helsingborg.city@trafikskolan.com' },
    { name: 'Mårtenssons - Helsingborg Hälsobacken', routingTag: 'martenssons_trafikskola_helsingborg_halsobacken', city: 'Helsingborg', area: 'Hälsobacken', officeColor: '#712f9d', phone: '042-301 78 82', email: 'helsingborg.halsobacken@trafikskolan.com' },

    // Lund (Mårtenssons) — 2 kontor
    { name: 'Mårtenssons - Lund Katedral', routingTag: 'martenssons_trafikskola_lund_katedral', city: 'Lund', area: 'Katedral', officeColor: '#0071e3', phone: '046-261 04 81', email: 'lund.katedral@trafikskolan.com' },
    { name: 'Mårtenssons - Lund Södertull', routingTag: 'martenssons_trafikskola_lund_sodertull', city: 'Lund', area: 'Södertull', officeColor: '#0071e3', phone: '046-261 04 80', email: 'lund.sodertull@trafikskolan.com' },

    // Enstaka städer (My Driving Academy)
    { name: 'My Driving Academy - Kungsbacka', routingTag: 'my_driving_academy_kungsbacka', city: 'Kungsbacka', area: '', officeColor: '#4c9e86', phone: '030015006', email: 'kungsbacka@trafikskolan.com' },
    { name: 'My Driving Academy - Gävle', routingTag: 'my_driving_academy_gavle', city: 'Gävle', area: '', officeColor: '#4c9e86', phone: '010-20 70 775', email: 'hej@mydrivingacademy.se' },
    { name: 'My Driving Academy - Linköping', routingTag: 'my_driving_academy_linkoping', city: 'Linköping', area: '', officeColor: '#4c9e86', phone: '010-20 70 775', email: 'hej@mydrivingacademy.com' },
    { name: 'My Driving Academy - Umeå', routingTag: 'my_driving_academy_umea', city: 'Umeå', area: '', officeColor: '#4c9e86', phone: '010-20 70 775', email: 'hej@mydrivingacademy.com' },
    { name: 'My Driving Academy - Uppsala', routingTag: 'my_driving_academy_uppsala', city: 'Uppsala', area: '', officeColor: '#4c9e86', phone: '010-20 70 775', email: 'hej@mydrivingacademy.com' },
    { name: 'My Driving Academy - Varberg', routingTag: 'my_driving_academy_varberg', city: 'Varberg', area: '', officeColor: '#4c9e86', phone: '010-20 70 775', email: 'hej@mydrivingacademy.com' },
    { name: 'My Driving Academy - Västerås', routingTag: 'my_driving_academy_vasteras', city: 'Västerås', area: '', officeColor: '#4c9e86', phone: '010-20 70 775', email: 'hej@mydrivingacademy.com' },

    // Enstaka städer (Mårtenssons)
    { name: 'Mårtenssons - Ängelholm', routingTag: 'martenssons_trafikskola_angelholm', city: 'Ängelholm', area: '', officeColor: '#4c9e86', phone: '0431-31 36 40', email: 'angelholm@trafikskolan.com' },
    { name: 'Mårtenssons - Eslöv', routingTag: 'martenssons_trafikskola_eslov', city: 'Eslöv', area: '', officeColor: '#4c9e86', phone: '041-353 56 50', email: 'eslov@trafikskolan.com' },
    { name: 'Mårtenssons - Hässleholm', routingTag: 'martenssons_trafikskola_hassleholm', city: 'Hässleholm', area: '', officeColor: '#4c9e86', phone: '045-125 70 25', email: 'hassleholm@trafikskolan.com' },
    { name: 'Mårtenssons - Höllviken', routingTag: 'martenssons_trafikskola_hollviken', city: 'Höllviken', area: '', officeColor: '#4c9e86', phone: '040-643 42 80', email: 'hollviken@trafikskolan.com' },
    { name: 'Mårtenssons - Kalmar', routingTag: 'martenssons_trafikskola_kalmar', city: 'Kalmar', area: '', officeColor: '#4c9e86', phone: '048-038 00 1', email: 'kalmar@trafikskolan.com' },
    { name: 'Mårtenssons - Kristianstad', routingTag: 'martenssons_trafikskola_kristianstad', city: 'Kristianstad', area: '', officeColor: '#4c9e86', phone: '044-140 99 20', email: 'kristianstad@trafikskolan.com' },
    { name: 'Mårtenssons - Landskrona', routingTag: 'martenssons_trafikskola_landskrona', city: 'Landskrona', area: '', officeColor: '#4c9e86', phone: '041-833 27 90', email: 'landskrona@trafikskolan.com' },
    { name: 'Mårtenssons - Trelleborg', routingTag: 'martenssons_trafikskola_trelleborg', city: 'Trelleborg', area: '', officeColor: '#4c9e86', phone: '041-01 00 08', email: 'trelleborg@trafikskolan.com' },
    { name: 'Mårtenssons - Växjö', routingTag: 'martenssons_trafikskola_vaxjo', city: 'Växjö', area: '', officeColor: '#4c9e86', phone: '047-051 52 10', email: 'vaxjo@trafikskolan.com' },
    { name: 'Mårtenssons - Vellinge', routingTag: 'martenssons_trafikskola_vellinge', city: 'Vellinge', area: '', officeColor: '#4c9e86', phone: '040-42 02 15', email: 'vellinge@trafikskolan.com' },
    { name: 'Mårtenssons - Ystad', routingTag: 'martenssons_trafikskola_ystad', city: 'Ystad', area: '', officeColor: '#4c9e86', phone: '041-121 17 20', email: 'ystad@trafikskolan.com' },
  ];

  for (const o of offices) {
    await prisma.office.upsert({ where: { routingTag: o.routingTag }, update: {}, create: o });
  }
  console.log(`✅ Offices: ${offices.length} kontor`);

  // ============================================
  // USER-OFFICE ASSIGNMENTS
  // ============================================
  const gbgUllevi = await prisma.office.findUnique({ where: { routingTag: 'my_driving_academy_goteborg_ullevi' } });
  const gbgHogsbo = await prisma.office.findUnique({ where: { routingTag: 'my_driving_academy_goteborg_hogsbo' } });
  const sthlmOstermalm = await prisma.office.findUnique({ where: { routingTag: 'my_driving_academy_stockholm_ostermalm' } });
  const malmoBulltofta = await prisma.office.findUnique({ where: { routingTag: 'martenssons_trafikskola_malmo_bulltofta' } });

  const assignments = [
    { userId: admin.id, officeId: gbgUllevi.id },
    { userId: agent1.id, officeId: gbgUllevi.id },
    { userId: agent1.id, officeId: gbgHogsbo.id },
    { userId: agent2.id, officeId: sthlmOstermalm.id },
    { userId: agent3.id, officeId: malmoBulltofta.id },
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
  // TICKETS
  // ============================================
  const tickets = [
    // Nya livechattar (open, no owner)
    { id: 'chat_live_001', channel: 'chat', status: 'open', humanMode: true, customerName: 'Erik Svensson', customerEmail: 'erik@example.com', customerPhone: '070-123 45 67', lastMessage: 'Hej, jag vill veta mer om ert körkortspaket!', vehicle: 'BIL', officeId: gbgUllevi.id },
    { id: 'chat_live_002', channel: 'chat', status: 'open', humanMode: true, customerName: 'Anna Johansson', customerEmail: 'anna@example.com', lastMessage: 'Vad kostar MC-kort hos er?', vehicle: 'MC', officeId: gbgHogsbo.id },
    { id: 'chat_live_003', channel: 'chat', status: 'open', humanMode: true, customerName: 'Mohammed Al-Rashid', customerEmail: 'mo@example.com', lastMessage: 'I would like to book a test lesson please', vehicle: 'BIL', officeId: sthlmOstermalm.id },

    // Nya mail-ärenden (open, no owner)
    { id: 'mail_inbound_001', channel: 'mail', status: 'open', humanMode: true, customerName: 'Lisa Borg', customerEmail: 'lisa.borg@gmail.com', lastMessage: 'Hej! Jag undrar om ni har några lediga tider för intensivkurs i augusti?', subject: 'Intensivkurs augusti', officeId: gbgUllevi.id },
    { id: 'mail_inbound_002', channel: 'mail', status: 'open', humanMode: true, customerName: 'Per Nilsson', customerEmail: 'per.nilsson@hotmail.com', lastMessage: 'Mitt paket gick ut förra månaden, kan jag förlänga det?', subject: 'Förlängning av paket', officeId: malmoBulltofta.id },

    // Plockade ärenden (claimed by agents)
    { id: 'chat_claimed_001', channel: 'chat', status: 'claimed', humanMode: true, customerName: 'Sofia Pettersson', customerEmail: 'sofia@example.com', customerPhone: '073-987 65 43', lastMessage: 'Tack! Jag vill boka in mig på risk 1 också.', vehicle: 'BIL', ownerId: agent1.id, officeId: gbgUllevi.id },
    { id: 'chat_claimed_002', channel: 'chat', status: 'claimed', humanMode: true, customerName: 'Oscar Bergström', customerEmail: 'oscar@example.com', lastMessage: 'Kan jag byta från manuell till automat mitt i paketet?', vehicle: 'BIL', ownerId: agent2.id, officeId: sthlmOstermalm.id },
    { id: 'mail_claimed_001', channel: 'mail', status: 'claimed', humanMode: true, customerName: 'Karin Lund', customerEmail: 'karin.lund@company.se', lastMessage: 'Jag behöver avboka min lektion imorgon pga sjukdom.', subject: 'Avbokning lektion', ownerId: admin.id, officeId: gbgUllevi.id },

    // Arkiverade ärenden
    { id: 'chat_archived_001', channel: 'chat', status: 'closed', humanMode: false, customerName: 'David Ek', customerEmail: 'david@example.com', lastMessage: 'Perfekt, då ses vi på tisdag!', vehicle: 'BIL', ownerId: agent1.id, officeId: gbgUllevi.id, closeReason: 'Löst', archivedAt: new Date('2026-03-25') },
    { id: 'mail_archived_001', channel: 'mail', status: 'closed', humanMode: false, customerName: 'Elin Forsberg', customerEmail: 'elin@example.com', lastMessage: 'Tack för snabbt svar!', subject: 'Fråga om presentkort', ownerId: agent3.id, officeId: malmoBulltofta.id, closeReason: 'Löst', archivedAt: new Date('2026-03-20') },
    { id: 'chat_archived_002', channel: 'chat', status: 'closed', humanMode: false, customerName: 'Ali Hassan', customerEmail: 'ali@example.com', lastMessage: 'Ok tack, jag bokar via hemsidan.', vehicle: 'MC', ownerId: agent2.id, officeId: sthlmOstermalm.id, closeReason: 'Kund bokade själv', archivedAt: new Date('2026-03-15') },
  ];

  for (const t of tickets) {
    await prisma.ticket.upsert({ where: { id: t.id }, update: {}, create: t });
  }
  console.log(`✅ Tickets: ${tickets.length} ärenden`);

  // ============================================
  // MESSAGES
  // ============================================
  const messages = [
    { ticketId: 'chat_live_001', role: 'customer', content: 'Hej, jag vill veta mer om ert körkortspaket!' },
    { ticketId: 'chat_live_001', role: 'atlas', content: 'Hej Erik! Vi har flera paket. Vårt populäraste är Baspaketet med 15 lektioner, Risk 1 och Risk 2. Vilken stad gäller det?' },
    { ticketId: 'chat_live_001', role: 'customer', content: 'Göteborg, Ullevi-kontoret' },
    { ticketId: 'chat_claimed_001', role: 'customer', content: 'Hej, jag har frågor om mitt paket' },
    { ticketId: 'chat_claimed_001', role: 'atlas', content: 'Hej Sofia! Vad kan jag hjälpa dig med?' },
    { ticketId: 'chat_claimed_001', role: 'customer', content: 'Jag vill prata med människa' },
    { ticketId: 'chat_claimed_001', role: 'system', content: 'Kund eskalerade till live-chatt' },
    { ticketId: 'chat_claimed_001', role: 'agent', content: 'Hej Sofia! Jag heter Sara och hjälper dig gärna. Vad gäller det?' },
    { ticketId: 'chat_claimed_001', role: 'customer', content: 'Tack! Jag vill boka in mig på risk 1 också.' },
    { ticketId: 'chat_claimed_002', role: 'customer', content: 'Kan jag byta från manuell till automat mitt i paketet?' },
    { ticketId: 'chat_claimed_002', role: 'agent', content: 'Hej Oscar! Ja det går bra. Villkor 78 tillkommer dock på körkortet om du kör upp på automat.' },
    { ticketId: 'mail_claimed_001', role: 'customer', content: 'Hej!\n\nJag behöver avboka min lektion imorgon pga sjukdom.\n\nMvh Karin', isEmail: true },
    { ticketId: 'mail_claimed_001', role: 'agent', content: 'Hej Karin!\n\nDu debiteras inte om du skickar giltigt läkarintyg inom 1 vecka.\n\nMvh Patrik', isEmail: true },
    { ticketId: 'mail_inbound_001', role: 'customer', content: 'Hej! Jag undrar om ni har lediga tider för intensivkurs i augusti?', isEmail: true },
    { ticketId: 'chat_archived_001', role: 'customer', content: 'Vilken tid är min lektion på tisdag?' },
    { ticketId: 'chat_archived_001', role: 'agent', content: 'Din lektion är kl 14:00. Glöm inte legitimation!' },
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
    { name: 'Välkomstmail', subject: 'Välkommen till My Driving Academy!', body: '<p>Hej!</p><p>Tack för att du valt oss. Vi ser fram emot att hjälpa dig!</p><p>Boka din första lektion via hemsidan.</p><p>Mvh,<br>My Driving Academy</p>', category: 'BIL' },
    { name: 'Påminnelse Risk 1', subject: 'Påminnelse: Risk 1', body: '<p>Hej!</p><p>Påminnelse om Risk 1 (ca 3,5 timmar).</p><ul><li>Ta med legitimation</li><li>Var på plats 10 min innan</li></ul><p>Mvh</p>', category: 'BIL' },
    { name: 'Avbokning bekräftelse', subject: 'Bekräftelse på avbokning', body: '<p>Hej!</p><p>Din lektion är avbokad. Vid sjukdom: skicka läkarintyg inom 1 vecka.</p><p>Mvh</p>', category: 'BIL' },
    { name: 'MC-säsong start', subject: 'MC-säsongen har börjat!', body: '<p>Hej!</p><p>MC-säsongen är igång (mars/april–oktober/november). Boka idag!</p><p>Mvh</p>', category: 'MC' },
  ];

  for (const t of templates) {
    const exists = await prisma.template.findFirst({ where: { name: t.name } });
    if (!exists) await prisma.template.create({ data: t });
  }
  console.log(`✅ Templates: ${templates.length} mailmallar`);

  // ============================================
  // TICKET NOTES
  // ============================================
  await prisma.ticketNote.create({ data: { ticketId: 'chat_claimed_001', agentId: agent1.id, content: 'Kund vill boka Risk 1. Ledig plats 5 april.' } });
  await prisma.ticketNote.create({ data: { ticketId: 'mail_claimed_001', agentId: admin.id, content: 'Kund skickar läkarintyg inom veckan. Följ upp.' } });
  await prisma.ticketNote.create({ data: { ticketId: 'chat_claimed_002', agentId: agent2.id, content: 'Informerat om villkor 78. Kund funderar.' } });
  console.log(`✅ Notes: 3 anteckningar`);

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

  console.log('\n🎉 Seed klar!');
  console.log(`   ${offices.length} kontor (Göteborg 10, Stockholm 7, Malmö 8, Helsingborg 2, Lund 2, + 18 enstaka)`);
  console.log('   Logga in: admin / admin123 | sara/johan/maria / agent123');
}

main()
  .catch(e => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
