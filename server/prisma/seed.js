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
  // USER-OFFICE ASSIGNMENTS (spread agents across offices)
  // ============================================
  const officeRefs = {};
  const allOffices = await prisma.office.findMany();
  for (const o of allOffices) officeRefs[o.routingTag] = o;

  const assignmentPairs = [
    // Admin: Göteborg kontor
    [admin.id, 'my_driving_academy_goteborg_ullevi'],
    [admin.id, 'my_driving_academy_goteborg_hogsbo'],
    [admin.id, 'my_driving_academy_goteborg_storaholm'],
    // Sara: Göteborg-regionen
    [agent1.id, 'my_driving_academy_goteborg_ullevi'],
    [agent1.id, 'my_driving_academy_goteborg_hogsbo'],
    [agent1.id, 'my_driving_academy_goteborg_molndal'],
    [agent1.id, 'my_driving_academy_goteborg_molnlycke'],
    [agent1.id, 'my_driving_academy_goteborg_vastra_frolunda'],
    [agent1.id, 'my_driving_academy_kungsbacka'],
    // Johan: Stockholm-kontor
    [agent2.id, 'my_driving_academy_stockholm_ostermalm'],
    [agent2.id, 'my_driving_academy_stockholm_kungsholmen_lindhagsplan'],
    [agent2.id, 'my_driving_academy_stockholm_sodermalm'],
    [agent2.id, 'my_driving_academy_stockholm_solna'],
    [agent2.id, 'my_driving_academy_stockholm_djursholm'],
    // Maria: Malmö + Skåne
    [agent3.id, 'martenssons_trafikskola_malmo_bulltofta'],
    [agent3.id, 'martenssons_trafikskola_malmo_city'],
    [agent3.id, 'martenssons_trafikskola_malmo_triangeln'],
    [agent3.id, 'martenssons_trafikskola_helsingborg_city'],
    [agent3.id, 'martenssons_trafikskola_lund_katedral'],
    [agent3.id, 'martenssons_trafikskola_kristianstad'],
  ];

  for (const [userId, tag] of assignmentPairs) {
    const office = officeRefs[tag];
    if (!office) continue;
    await prisma.userOffice.upsert({
      where: { userId_officeId: { userId, officeId: office.id } },
      update: {},
      create: { userId, officeId: office.id },
    });
  }
  console.log(`✅ Office assignments: ${assignmentPairs.length} kopplingar`);

  // ============================================
  // TICKETS (diverse test data)
  // ============================================
  const gbgUllevi = officeRefs['my_driving_academy_goteborg_ullevi'];
  const gbgHogsbo = officeRefs['my_driving_academy_goteborg_hogsbo'];
  const sthlmOstermalm = officeRefs['my_driving_academy_stockholm_ostermalm'];
  const malmoBulltofta = officeRefs['martenssons_trafikskola_malmo_bulltofta'];
  const malmoCity = officeRefs['martenssons_trafikskola_malmo_city'];
  const hbgCity = officeRefs['martenssons_trafikskola_helsingborg_city'];
  const lundKatedral = officeRefs['martenssons_trafikskola_lund_katedral'];
  const sthlmSodermalm = officeRefs['my_driving_academy_stockholm_sodermalm'];

  const tickets = [
    // === NYA LIVE-CHATTAR (open, no owner) ===
    { id: 'chat_live_001', channel: 'chat', status: 'open', humanMode: true, customerName: 'Erik Svensson', customerEmail: 'erik@example.com', customerPhone: '070-123 45 67', lastMessage: 'Hej, jag vill veta mer om ert körkortspaket!', vehicle: 'BIL', officeId: gbgUllevi.id },
    { id: 'chat_live_002', channel: 'chat', status: 'open', humanMode: true, customerName: 'Anna Johansson', customerEmail: 'anna@example.com', lastMessage: 'Vad kostar MC-kort hos er?', vehicle: 'MC', officeId: gbgHogsbo.id },
    { id: 'chat_live_003', channel: 'chat', status: 'open', humanMode: true, customerName: 'Mohammed Al-Rashid', customerEmail: 'mo@example.com', lastMessage: 'I would like to book a test lesson please', vehicle: 'BIL', officeId: sthlmOstermalm.id },
    { id: 'chat_live_004', channel: 'chat', status: 'open', humanMode: true, customerName: 'Fatima Khadiri', customerEmail: 'fatima@example.com', lastMessage: 'Hej! Kan jag boka AM-kort hos er i Malmö?', vehicle: 'AM', officeId: malmoCity.id },
    { id: 'chat_live_005', channel: 'chat', status: 'open', humanMode: true, customerName: 'Gustav Lindqvist', customerEmail: 'gustav@example.com', lastMessage: 'Har ni lastbilsutbildning?', vehicle: 'LASTBIL', officeId: hbgCity.id },

    // === NYA MAIL-ÄRENDEN (open, no owner) ===
    { id: 'mail_inbound_001', channel: 'mail', status: 'open', humanMode: true, customerName: 'Lisa Borg', customerEmail: 'lisa.borg@gmail.com', lastMessage: 'Hej! Lediga tider för intensivkurs i augusti?', subject: 'Intensivkurs augusti', officeId: gbgUllevi.id },
    { id: 'mail_inbound_002', channel: 'mail', status: 'open', humanMode: true, customerName: 'Per Nilsson', customerEmail: 'per.nilsson@hotmail.com', lastMessage: 'Mitt paket gick ut, kan jag förlänga?', subject: 'Förlängning av paket', officeId: malmoBulltofta.id },
    { id: 'mail_inbound_003', channel: 'mail', status: 'open', humanMode: true, customerName: 'Emma Strand', customerEmail: 'emma.strand@outlook.com', lastMessage: 'Jag vill köpa ett presentkort till min dotter', subject: 'Presentkort', officeId: lundKatedral.id },

    // === PLOCKADE ÄRENDEN (claimed by agents) ===
    { id: 'chat_claimed_001', channel: 'chat', status: 'claimed', humanMode: true, customerName: 'Sofia Pettersson', customerEmail: 'sofia@example.com', customerPhone: '073-987 65 43', lastMessage: 'Tack! Jag vill boka risk 1 också.', vehicle: 'BIL', ownerId: agent1.id, officeId: gbgUllevi.id },
    { id: 'chat_claimed_002', channel: 'chat', status: 'claimed', humanMode: true, customerName: 'Oscar Bergström', customerEmail: 'oscar@example.com', lastMessage: 'Kan jag byta till automat mitt i paketet?', vehicle: 'BIL', ownerId: agent2.id, officeId: sthlmOstermalm.id },
    { id: 'chat_claimed_003', channel: 'chat', status: 'claimed', humanMode: true, customerName: 'Nour Mansour', customerEmail: 'nour@example.com', lastMessage: 'Tack, jag väntar på bekräftelsen', vehicle: 'BIL', ownerId: agent3.id, officeId: malmoBulltofta.id },
    { id: 'mail_claimed_001', channel: 'mail', status: 'claimed', humanMode: true, customerName: 'Karin Lund', customerEmail: 'karin.lund@company.se', lastMessage: 'Jag behöver avboka pga sjukdom.', subject: 'Avbokning lektion', ownerId: admin.id, officeId: gbgUllevi.id },
    { id: 'mail_claimed_002', channel: 'mail', status: 'claimed', humanMode: true, customerName: 'Henrik Åström', customerEmail: 'henrik@foretag.se', lastMessage: 'Vi vill boka 5 platser på YKB-kurs', subject: 'YKB företagsbokning', ownerId: agent2.id, officeId: sthlmSodermalm.id },

    // === ARKIVERADE ÄRENDEN ===
    { id: 'chat_archived_001', channel: 'chat', status: 'closed', humanMode: false, customerName: 'David Ek', customerEmail: 'david@example.com', lastMessage: 'Perfekt, då ses vi på tisdag!', vehicle: 'BIL', ownerId: agent1.id, officeId: gbgUllevi.id, closeReason: 'Löst', archivedAt: new Date('2026-03-25') },
    { id: 'mail_archived_001', channel: 'mail', status: 'closed', humanMode: false, customerName: 'Elin Forsberg', customerEmail: 'elin@example.com', lastMessage: 'Tack för snabbt svar!', subject: 'Presentkort', ownerId: agent3.id, officeId: malmoBulltofta.id, closeReason: 'Löst', archivedAt: new Date('2026-03-20') },
    { id: 'chat_archived_002', channel: 'chat', status: 'closed', humanMode: false, customerName: 'Ali Hassan', customerEmail: 'ali@example.com', lastMessage: 'Ok tack, jag bokar via hemsidan.', vehicle: 'MC', ownerId: agent2.id, officeId: sthlmOstermalm.id, closeReason: 'Kund bokade själv', archivedAt: new Date('2026-03-15') },
    { id: 'chat_archived_003', channel: 'chat', status: 'closed', humanMode: false, customerName: 'Maja Öberg', customerEmail: 'maja@example.com', lastMessage: 'Jättebra, tack för all hjälp!', vehicle: 'BIL', ownerId: agent1.id, officeId: gbgHogsbo.id, closeReason: 'Löst', archivedAt: new Date('2026-03-10') },
    { id: 'mail_archived_002', channel: 'mail', status: 'closed', humanMode: false, customerName: 'Lars Björk', customerEmail: 'lars.bjork@gmail.com', lastMessage: 'Fakturan är betald, tack!', subject: 'Fakturafråga', ownerId: admin.id, officeId: gbgUllevi.id, closeReason: 'Löst', archivedAt: new Date('2026-03-05') },
    { id: 'chat_archived_004', channel: 'chat', status: 'closed', humanMode: false, customerName: 'Ida Wallin', customerEmail: 'ida@example.com', lastMessage: 'Okej, jag hör av mig nästa vecka', vehicle: 'AM', ownerId: agent3.id, officeId: hbgCity.id, closeReason: 'Kund återkommer', archivedAt: new Date('2026-02-28') },
  ];

  for (const t of tickets) {
    await prisma.ticket.upsert({ where: { id: t.id }, update: {}, create: t });
  }
  console.log(`✅ Tickets: ${tickets.length} ärenden (5 live-chattar, 3 mail, 5 plockade, 7 arkiverade)`);

  // ============================================
  // MESSAGES (deeper conversations)
  // ============================================
  const messages = [
    // chat_live_001 — Erik vill veta om paket
    { ticketId: 'chat_live_001', role: 'customer', content: 'Hej, jag vill veta mer om ert körkortspaket!' },
    { ticketId: 'chat_live_001', role: 'atlas', content: 'Hej Erik! Vi har flera paket att välja mellan:\n\n• **Minipaket** (5 lektioner)\n• **Mellanpaket** (10 lektioner)\n• **Baspaket** (15 lektioner + Risk 1 + Risk 2)\n\nVilken stad gäller det?' },
    { ticketId: 'chat_live_001', role: 'customer', content: 'Göteborg, Ullevi-kontoret' },
    { ticketId: 'chat_live_001', role: 'atlas', content: 'Bra val! På Ullevi erbjuder vi alla paket. Baspaketet är populärast — det inkluderar 15 körlektioner, Risk 1 och Risk 2. Vill du veta priset?' },
    { ticketId: 'chat_live_001', role: 'customer', content: 'Ja tack! Och vad ingår i Risk 1?' },

    // chat_live_002 — Anna frågar om MC
    { ticketId: 'chat_live_002', role: 'customer', content: 'Vad kostar MC-kort hos er?' },
    { ticketId: 'chat_live_002', role: 'atlas', content: 'Hej Anna! MC-utbildning erbjuds under säsongen mars/april till oktober/november. Vi har MC-paket med max 10 lektioner. Vilken stad?' },
    { ticketId: 'chat_live_002', role: 'customer', content: 'Göteborg Högsbo' },

    // chat_live_004 — Fatima AM-kort
    { ticketId: 'chat_live_004', role: 'customer', content: 'Hej! Kan jag boka AM-kort hos er i Malmö?' },
    { ticketId: 'chat_live_004', role: 'atlas', content: 'Hej Fatima! Ja, vi erbjuder AM-utbildning (EU-moped). Du behöver vara minst 15 år. Kursen innehåller teori och praktik.' },
    { ticketId: 'chat_live_004', role: 'customer', content: 'Vad kostar det?' },

    // chat_claimed_001 — Sofia (hel konversation med eskalering)
    { ticketId: 'chat_claimed_001', role: 'customer', content: 'Hej, jag har frågor om mitt paket' },
    { ticketId: 'chat_claimed_001', role: 'atlas', content: 'Hej Sofia! Vad kan jag hjälpa dig med?' },
    { ticketId: 'chat_claimed_001', role: 'customer', content: 'Hur länge gäller mitt baspaket?' },
    { ticketId: 'chat_claimed_001', role: 'atlas', content: 'Köp och paket gäller i **24 månader** från köpdatum. Genomförda kurser och körkortstillstånd gäller i **5 år**.' },
    { ticketId: 'chat_claimed_001', role: 'customer', content: 'Jag vill prata med människa' },
    { ticketId: 'chat_claimed_001', role: 'system', content: 'Kund eskalerade till live-chatt' },
    { ticketId: 'chat_claimed_001', role: 'agent', content: 'Hej Sofia! Jag heter Sara och hjälper dig gärna. Vad gäller det?' },
    { ticketId: 'chat_claimed_001', role: 'customer', content: 'Jag köpte baspaketet för 6 månader sen men har inte hunnit börja. Är det fortfarande giltigt?' },
    { ticketId: 'chat_claimed_001', role: 'agent', content: 'Ja, ditt paket gäller i 24 månader från köpdatum. Du har alltså 18 månader kvar. Vill du boka in din första lektion?' },
    { ticketId: 'chat_claimed_001', role: 'customer', content: 'Tack! Jag vill boka in mig på risk 1 också.' },

    // chat_claimed_002 — Oscar automat-fråga
    { ticketId: 'chat_claimed_002', role: 'customer', content: 'Kan jag byta från manuell till automat mitt i paketet?' },
    { ticketId: 'chat_claimed_002', role: 'agent', content: 'Hej Oscar! Ja det går bra att byta. Tänk dock på att om du gör uppkörningen på automat får du villkor 78 på ditt körkort, vilket innebär att du bara får köra automatväxlade bilar.' },
    { ticketId: 'chat_claimed_002', role: 'customer', content: 'Kan jag ta bort villkor 78 senare?' },
    { ticketId: 'chat_claimed_002', role: 'agent', content: 'Ja, du kan göra ett nytt körprov på manuell bil för att ta bort villkoret. Det kostar en uppkörningsavgift till Trafikverket.' },
    { ticketId: 'chat_claimed_002', role: 'customer', content: 'Ok, jag funderar på det. Tack!' },

    // chat_claimed_003 — Nour bekräftelse
    { ticketId: 'chat_claimed_003', role: 'customer', content: 'Hej, jag har bokat en lektion men fått ingen bekräftelse' },
    { ticketId: 'chat_claimed_003', role: 'agent', content: 'Hej Nour! Låt mig kolla. Vilken dag och tid bokade du?' },
    { ticketId: 'chat_claimed_003', role: 'customer', content: 'Tisdag 15:00 på Bulltofta' },
    { ticketId: 'chat_claimed_003', role: 'agent', content: 'Jag hittar din bokning! Bekräftelsen skickas till din e-post inom kort. Du är bokad tisdag kl 15:00.' },
    { ticketId: 'chat_claimed_003', role: 'customer', content: 'Tack, jag väntar på bekräftelsen' },

    // mail_claimed_001 — Karin avbokning
    { ticketId: 'mail_claimed_001', role: 'customer', content: 'Hej!\n\nJag behöver avboka min lektion imorgon (tisdag) pga sjukdom. Jag har läkarintyg.\n\nMvh Karin Lund', isEmail: true },
    { ticketId: 'mail_claimed_001', role: 'agent', content: 'Hej Karin!\n\nTack för att du hör av dig. Du debiteras inte om du skickar giltigt läkarintyg inom 1 vecka. Observera att VAB inte räknas.\n\nSkicka läkarintyget till: goteborg.ullevi@trafikskolan.com\n\nMvh Patrik', isEmail: true },
    { ticketId: 'mail_claimed_001', role: 'customer', content: 'Tack! Jag skickar läkarintyget idag.\n\nMvh Karin', isEmail: true },

    // mail_claimed_002 — Henrik YKB
    { ticketId: 'mail_claimed_002', role: 'customer', content: 'Hej!\n\nVi är ett åkeri som behöver boka YKB-fortbildning för 5 förare. Har ni lediga platser i april?\n\nMvh Henrik Åström\nTransportbolaget AB', isEmail: true },
    { ticketId: 'mail_claimed_002', role: 'agent', content: 'Hej Henrik!\n\nAbsolut, vi har YKB-fortbildning (35 timmar) i april. Jag skickar en offert till er.\n\nMvh Johan', isEmail: true },

    // mail_inbound_001 — Lisa intensivkurs
    { ticketId: 'mail_inbound_001', role: 'customer', content: 'Hej!\n\nJag undrar om ni har lediga tider för intensivkurs i augusti? Jag bor i Göteborg och vill ta B-körkort.\n\nMvh Lisa Borg', isEmail: true },

    // mail_inbound_003 — Emma presentkort
    { ticketId: 'mail_inbound_003', role: 'customer', content: 'Hej!\n\nJag vill köpa ett presentkort på körkortspaket till min dotter som fyller 18 i juni. Hur gör jag?\n\nMvh Emma Strand', isEmail: true },

    // Arkiverade konversationer
    { ticketId: 'chat_archived_001', role: 'customer', content: 'Vilken tid är min lektion på tisdag?' },
    { ticketId: 'chat_archived_001', role: 'agent', content: 'Din lektion är kl 14:00 på Ullevi. Glöm inte ta med legitimation!' },
    { ticketId: 'chat_archived_001', role: 'customer', content: 'Ska jag ha med något annat?' },
    { ticketId: 'chat_archived_001', role: 'agent', content: 'Nej, bara legitimation och bekväma skor. Vi ses!' },
    { ticketId: 'chat_archived_001', role: 'customer', content: 'Perfekt, då ses vi på tisdag!' },

    { ticketId: 'chat_archived_003', role: 'customer', content: 'Hej, har ni testlektion?' },
    { ticketId: 'chat_archived_003', role: 'atlas', content: 'Hej Maja! Ja, testlektion (provlektion) är en rabatterad första lektion på 80 minuter för nya bil-elever.' },
    { ticketId: 'chat_archived_003', role: 'customer', content: 'Vad kostar den?' },
    { ticketId: 'chat_archived_003', role: 'atlas', content: 'Testlektionen kostar normalt ett reducerat pris. Vill du boka en på Högsbo?' },
    { ticketId: 'chat_archived_003', role: 'customer', content: 'Ja tack!' },
    { ticketId: 'chat_archived_003', role: 'agent', content: 'Hej Maja! Du är bokad för testlektion fredag kl 10:00 på Högsbo.' },
    { ticketId: 'chat_archived_003', role: 'customer', content: 'Jättebra, tack för all hjälp!' },
  ];

  for (const m of messages) {
    await prisma.message.create({ data: m });
  }
  console.log(`✅ Messages: ${messages.length} meddelanden`);

  // ============================================
  // TEMPLATES
  // ============================================
  const templates = [
    { name: 'Välkomstmail', subject: 'Välkommen till My Driving Academy!', body: '<p>Hej!</p><p>Tack för att du valt oss för din körkortsutbildning. Vi ser fram emot att hjälpa dig!</p><p>Boka din första lektion via vår hemsida eller ring oss.</p><p>Med vänliga hälsningar,<br>My Driving Academy</p>', category: 'BIL' },
    { name: 'Påminnelse Risk 1', subject: 'Påminnelse: Risk 1 utbildning', body: '<p>Hej!</p><p>Påminnelse om din Risk 1 utbildning (ca 3,5 timmar).</p><ul><li>Ta med giltig legitimation</li><li>Var på plats 10 minuter innan start</li><li>Risk 1 för bil och MC är separata kurser</li></ul><p>Mvh,<br>My Driving Academy</p>', category: 'BIL' },
    { name: 'Avbokning bekräftelse', subject: 'Bekräftelse på avbokning', body: '<p>Hej!</p><p>Vi bekräftar att din lektion har avbokats.</p><p><strong>Vid sjukdom:</strong> Du debiteras inte om giltigt läkarintyg skickas in inom 1 vecka. OBS: VAB räknas inte.</p><p>Vill du boka ny tid? Kontakta oss eller boka via hemsidan.</p><p>Mvh,<br>My Driving Academy</p>', category: 'BIL' },
    { name: 'MC-säsong start', subject: 'MC-säsongen har börjat!', body: '<p>Hej!</p><p>MC-säsongen är igång! Vi erbjuder MC-utbildning från <strong>mars/april till oktober/november</strong>.</p><p>Boka din plats redan idag — populära tider fylls snabbt.</p><p>Mvh,<br>My Driving Academy</p>', category: 'MC' },
    { name: 'Paketinfo Bil', subject: 'Information om våra körkortspaket', body: '<p>Hej!</p><p>Här är våra paket för B-körkort:</p><ul><li><strong>Minipaket:</strong> 5 lektioner</li><li><strong>Mellanpaket:</strong> 10 lektioner</li><li><strong>Baspaket:</strong> 15 lektioner + Risk 1 + Risk 2</li><li><strong>Totalpaket:</strong> 15 lektioner + Risk 1 + Risk 2 + Mitt Körkort-appen</li></ul><p>Alla paket gäller i 24 månader.</p><p>Mvh</p>', category: 'BIL' },
    { name: 'Presentkort', subject: 'Ditt presentkort från My Driving Academy', body: '<p>Hej!</p><p>Grattis! Du har fått ett presentkort på körkortsutbildning. Presentkortet gäller i <strong>1 år</strong> från utfärdandedatum.</p><p>Kontakta oss för att boka din första lektion.</p><p>Mvh</p>', category: 'BIL' },
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
    { ticketId: 'chat_claimed_001', agentId: agent1.id, content: 'Kund vill boka Risk 1. Ledig plats 5 april. Kolla om hon vill boka via telefon eller hemsida.' },
    { ticketId: 'chat_claimed_001', agentId: admin.id, content: 'Sara kollar tillgänglighet. Kund är nöjd med paketinfo.' },
    { ticketId: 'mail_claimed_001', agentId: admin.id, content: 'Kund skickar läkarintyg inom veckan. Följ upp fredag om det inte kommit.' },
    { ticketId: 'chat_claimed_002', agentId: agent2.id, content: 'Informerat om villkor 78. Kund funderar på att byta till automat.' },
    { ticketId: 'chat_claimed_003', agentId: agent3.id, content: 'Bekräftelse skickad via e-post. Kund nöjd.' },
    { ticketId: 'mail_claimed_002', agentId: agent2.id, content: 'Företagsbokning 5 platser YKB april. Skickat offert.' },
    { ticketId: 'chat_archived_001', agentId: agent1.id, content: 'Kund bokad tisdag 14:00. Första lektion.' },
    { ticketId: 'chat_archived_003', agentId: agent1.id, content: 'Testlektion bokad fredag 10:00 Högsbo. Ny elev.' },
  ];
  for (const n of notes) {
    await prisma.ticketNote.create({ data: n });
  }
  console.log(`✅ Ticket notes: ${notes.length} anteckningar`);

  // ============================================
  // CUSTOMER NOTES (per customer, not ticket)
  // ============================================
  const customerNotes = [
    { customerEmail: 'sofia@example.com', agentId: agent1.id, content: 'Stamkund. Köpte baspaket 2025-09. Har gjort 3 av 15 lektioner. Föredrar morgontider.' },
    { customerEmail: 'oscar@example.com', agentId: agent2.id, content: 'Funderar på automat vs manuell. Har kört 8 lektioner manuell hittills.' },
    { customerEmail: 'karin.lund@company.se', agentId: admin.id, content: 'Företagskund via TransportAB. Avbokar ofta pga jobb. Alltid sjukintyg.' },
    { customerEmail: 'erik@example.com', agentId: agent1.id, content: 'Ny kund. Intresserad av baspaket Ullevi. Ska återkomma.' },
    { customerEmail: 'lisa.borg@gmail.com', agentId: admin.id, content: 'Vill göra intensivkurs augusti. Behöver körkortstillstånd först.' },
  ];
  for (const cn of customerNotes) {
    await prisma.customerNote.create({ data: cn });
  }
  console.log(`✅ Customer notes: ${customerNotes.length} kundanteckningar`);

  // ============================================
  // RAG FAILURES (knowledge gaps for admin view)
  // ============================================
  const ragFailures = [
    { query: 'Kan jag ta körkort med ADHD?', sessionType: 'customer', tsFallbackUsed: true, tsFallbackSuccess: false, tsUrl: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/medicinska-krav/' },
    { query: 'Vad händer om jag kör på rött ljus?', sessionType: 'customer', tsFallbackUsed: false, tsFallbackSuccess: false },
    { query: 'Hur lång tid tar det att ta körkort?', sessionType: 'customer', tsFallbackUsed: false, tsFallbackSuccess: false },
    { query: 'Kan jag öva med min pappas bil?', sessionType: 'customer', tsFallbackUsed: true, tsFallbackSuccess: true, tsUrl: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/handledarskap-och-ovningskorning/' },
    { query: 'Vad kostar det att ta MC-kort i Umeå?', sessionType: 'customer', tsFallbackUsed: false, tsFallbackSuccess: false },
    { query: 'Behöver jag glasögon för att ta körkort?', sessionType: 'customer', tsFallbackUsed: true, tsFallbackSuccess: true, tsUrl: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/medicinska-krav/' },
    { query: 'Finns det körkort för elscooter?', sessionType: 'customer', tsFallbackUsed: false, tsFallbackSuccess: false },
    { query: 'Kan man ta B-körkort vid 16 års ålder?', sessionType: 'customer', tsFallbackUsed: true, tsFallbackSuccess: false, tsUrl: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/' },
  ];
  for (const rf of ragFailures) {
    await prisma.ragFailure.create({ data: rf });
  }
  console.log(`✅ RAG failures: ${ragFailures.length} kunskapsluckor`);

  // ============================================
  // EMAIL BLOCKLIST
  // ============================================
  const blocklist = [
    { pattern: '*@spam-domain.com', type: 'email', addedBy: 'admin' },
    { pattern: 'no-reply@*', type: 'email', addedBy: 'admin' },
    { pattern: '*@mailer-daemon.*', type: 'email', addedBy: 'system' },
  ];
  for (const b of blocklist) {
    const exists = await prisma.emailBlocklist.findFirst({ where: { pattern: b.pattern } });
    if (!exists) await prisma.emailBlocklist.create({ data: b });
  }
  console.log(`✅ Email blocklist: ${blocklist.length} mönster`);

  // ============================================
  // LOCAL QA HISTORY
  // ============================================
  const qaHistory = [
    { question: 'Vad kostar körlektion i Göteborg?', answer: 'En körlektion på 40 min kostar ca 650-750 kr beroende på kontor.', isArchived: false },
    { question: 'Hur bokar jag risk 1?', answer: 'Du kan boka Risk 1 via vår hemsida eller ringa ditt lokala kontor.', isArchived: false },
    { question: 'Gäller presentkort på alla kontor?', answer: 'Ja, presentkort gäller på alla våra kontor i Sverige.', isArchived: true, solutionText: 'Lagt till i basfakta_om_foretaget.json' },
    { question: 'Kan jag göra Risk 2 före Risk 1?', answer: 'Nej, Risk 1 måste vara genomförd innan du gör Risk 2.', isArchived: false },
    { question: 'Vad är skillnaden mellan minipaket och baspaket?', answer: 'Minipaket har 5 lektioner, Baspaket har 15 lektioner + Risk 1 + Risk 2.', isArchived: true, solutionText: 'Täckt av basfakta_lektioner_paket_bil.json' },
  ];
  for (const qa of qaHistory) {
    await prisma.localQaHistory.create({ data: qa });
  }
  console.log(`✅ QA History: ${qaHistory.length} poster`);

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

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n🎉 Seed klar!');
  console.log(`   ${offices.length} kontor | 4 användare | ${assignmentPairs.length} kontorskopplingar`);
  console.log(`   ${tickets.length} ärenden | ${messages.length} meddelanden | ${notes.length} anteckningar`);
  console.log(`   ${customerNotes.length} kundnoteringar | ${ragFailures.length} kunskapsluckor | ${blocklist.length} blocklist`);
  console.log(`   ${templates.length} mallar | ${qaHistory.length} QA-historik | ${settings.length} inställningar`);
  console.log('\n   Logga in: admin / admin123 | sara/johan/maria / agent123');
}

main()
  .catch(e => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
