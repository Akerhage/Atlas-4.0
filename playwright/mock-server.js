const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const PORT = Number(process.env.PLAYWRIGHT_PORT || 3001);
const ROOT_DIR = path.resolve(__dirname, '..');
const RENDERER_DIR = path.join(ROOT_DIR, 'Renderer');

const nowMs = Date.now();
const nowSec = Math.floor(nowMs / 1000);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function secAgo(minutes) {
  return nowSec - minutes * 60;
}

function msAgo(minutes) {
  return nowMs - minutes * 60 * 1000;
}

function msg(role, content, minutes, sender) {
  const entry = { role, content, timestamp: msAgo(minutes) };
  if (sender) entry.sender = sender;
  return entry;
}

const state = {
  currentUser: {
    id: 1,
    username: 'atlas-admin',
    display_name: 'Atlas Admin',
    role: 'admin',
    routing_tag: 'stockholm_city,goteborg_hisingen',
    agent_color: '#4e9af1',
    avatar_id: 0,
    is_online: 1,
    allowed_views: null,
    status_text: 'Playwright testserver'
  },
  offices: [
    { id: 1, name: 'Atlas Support City', city: 'Stockholm', area: 'City', routing_tag: 'stockholm_city', office_color: '#4e9af1' },
    { id: 2, name: 'Atlas Support Hisingen', city: 'Goteborg', area: 'Hisingen', routing_tag: 'goteborg_hisingen', office_color: '#22c55e' }
  ],
  users: [
    { id: 1, username: 'atlas-admin', display_name: 'Atlas Admin', role: 'admin', routing_tag: 'stockholm_city,goteborg_hisingen', agent_color: '#4e9af1', avatar_id: 0, is_online: 1, allowed_views: null, status_text: 'Playwright testserver' },
    { id: 2, username: 'teammate', display_name: 'Team Mate', role: 'agent', routing_tag: 'stockholm_city', agent_color: '#f59e0b', avatar_id: 1, is_online: 1, allowed_views: '["chat","my-tickets","archive","customers","templates","about"]', status_text: 'Helping customers' },
    { id: 3, username: 'officecoach', display_name: 'Office Coach', role: 'agent', routing_tag: 'goteborg_hisingen', agent_color: '#10b981', avatar_id: 2, is_online: 0, allowed_views: '["chat","my-tickets","archive","customers","templates","about"]', status_text: 'Coaching team' }
  ],
  templates: [
    { id: 101, title: 'Min privata uppfoljning', owner: 'atlas-admin', group_name: null, content: '<p>Hej! Jag foljer upp ditt arende och aterkommer inom kort.</p>' },
    { id: 201, title: 'B-korkort priser', owner: null, group_name: 'BIL', content: '<p>Hej! Har kommer aktuell prislista for B-korkort.</p>' },
    { id: 202, title: 'English booking reply', owner: null, group_name: 'ENGELSKA', content: '<p>Hello! Here is the booking information in English.</p>' }
  ],
  inbox: {
    live_chats: [
      {
        conversation_id: 'live-chat-001',
        session_type: 'customer',
        contact_name: 'Anna Andersson',
        contact_email: 'anna@example.com',
        last_message: 'Hej! Jag vill boka en korlektion i Stockholm.',
        question: 'Jag vill boka en korlektion i Stockholm.',
        updated_at: secAgo(4),
        routing_tag: 'stockholm_city',
        owner: null,
        sender: 'user',
        vehicle: 'B',
        messages: [
          msg('user', 'Hej! Jag vill boka en korlektion i Stockholm.', 8),
          msg('assistant', 'Hej Anna! Jag hjalper dig garna.', 6, 'atlas-admin'),
          msg('user', 'Perfekt, jag vill helst kora efter jobbet.', 4)
        ]
      }
    ],
    mail: [
      {
        conversation_id: 'mail-001',
        session_type: 'message',
        subject: 'Fraga om intensivkurs',
        contact_name: 'Erik Ek',
        contact_email: 'erik@example.com',
        last_message: 'Hej, har ni intensivkurs i juli?',
        question: 'Har ni intensivkurs i juli?',
        updated_at: secAgo(12),
        routing_tag: 'goteborg_hisingen',
        owner: null,
        sender: 'user',
        vehicle: 'B',
        messages: [
          msg('user', 'Hej, har ni intensivkurs i juli?', 20),
          msg('assistant', 'Hej Erik! Jag ska kontrollera det.', 12, 'atlas-admin')
        ]
      }
    ],
    claimed: [
      {
        conversation_id: 'claimed-001',
        session_type: 'customer',
        contact_name: 'Sara Svensson',
        contact_email: 'sara@example.com',
        last_message: 'Jag vantar pa svar fran supporten.',
        question: 'Jag vantar pa svar fran supporten.',
        updated_at: secAgo(25),
        routing_tag: 'stockholm_city',
        owner: 'teammate',
        sender: 'user',
        vehicle: 'AM',
        messages: [
          msg('user', 'Jag vantar pa svar fran supporten.', 30),
          msg('assistant', 'Vi tittar pa det nu.', 25, 'teammate')
        ]
      }
    ]
  },
  myTickets: {
    tickets: [
      {
        conversation_id: 'my-chat-001',
        session_type: 'customer',
        contact_name: 'Mikael Melin',
        contact_email: 'mikael@example.com',
        last_message: 'Kan ni ringa upp mig i eftermiddag?',
        question: 'Kan ni ringa upp mig i eftermiddag?',
        updated_at: secAgo(9),
        routing_tag: 'stockholm_city',
        owner: 'atlas-admin',
        sender: 'user',
        vehicle: 'B',
        messages: [
          msg('user', 'Kan ni ringa upp mig i eftermiddag?', 18),
          msg('assistant', 'Absolut, vilken tid passar bast?', 14, 'atlas-admin'),
          msg('user', 'Efter 15 fungerar fint.', 9)
        ]
      },
      {
        conversation_id: 'my-mail-001',
        session_type: 'message',
        subject: 'Omplanering av lektion',
        contact_name: 'Lina Lind',
        contact_email: 'lina@example.com',
        last_message: 'Kan vi flytta min lektion till fredag?',
        question: 'Kan vi flytta min lektion till fredag?',
        updated_at: secAgo(15),
        routing_tag: 'stockholm_city',
        owner: 'atlas-admin',
        sender: 'user',
        vehicle: 'B',
        messages: [
          msg('user', 'Kan vi flytta min lektion till fredag?', 40),
          msg('assistant', 'Jag kontrollerar tillgangliga tider.', 15, 'atlas-admin')
        ]
      }
    ]
  },
  archive: [
    {
      conversation_id: 'archive-chat-001',
      session_type: 'customer',
      contact_name: 'Olivia Olsson',
      contact_email: 'olivia@example.com',
      question: 'Vad kostar en prova-pa lektion?',
      last_message: 'Tack for hjalpen!',
      preview: 'Vad kostar en prova-pa lektion?',
      owner: 'atlas-admin',
      routing_tag: 'stockholm_city',
      office: 'stockholm_city',
      city: 'Stockholm',
      vehicle: 'B',
      timestamp: msAgo(60 * 8),
      is_archived: 1,
      human_mode: 1,
      answer: [
        msg('user', 'Vad kostar en prova-pa lektion?', 60 * 10),
        msg('assistant', 'Den kostar 450 kronor.', 60 * 9, 'atlas-admin'),
        msg('user', 'Tack for hjalpen!', 60 * 8)
      ]
    },
    {
      conversation_id: 'archive-mail-001',
      session_type: 'message',
      contact_name: 'David Dahl',
      contact_email: 'david@example.com',
      subject: 'Teoriprov och bokning',
      preview: 'Kan ni hjalpa mig att boka teoriprov?',
      owner: 'teammate',
      routing_tag: 'goteborg_hisingen',
      office: 'goteborg_hisingen',
      city: 'Goteborg',
      vehicle: 'AM',
      timestamp: msAgo(60 * 24),
      is_archived: 1,
      human_mode: 1,
      answer: [
        msg('user', 'Kan ni hjalpa mig att boka teoriprov?', 60 * 26),
        msg('assistant', 'Ja, jag skickar instruktioner direkt.', 60 * 24, 'teammate')
      ]
    }
  ],
  customers: [
    { name: 'Anna Andersson', email: 'anna@example.com', phone: '0701234567', offices: 'stockholm_city, goteborg_hisingen', last_contact: secAgo(90), total_tickets: 2 },
    { name: 'Erik Ek', email: 'erik@example.com', phone: '0709876543', offices: 'goteborg_hisingen', last_contact: secAgo(240), total_tickets: 1 }
  ],
  customerTickets: {
    'anna@example.com': [
      { conversation_id: 'cust-anna-active-001', session_type: 'customer', contact_name: 'Anna Andersson', contact_email: 'anna@example.com', subject: 'Bokning av korlektion', question: 'Jag vill boka en korlektion i Stockholm.', timestamp: msAgo(60 * 3), is_archived: 0, routing_tag: 'stockholm_city', vehicle: 'B', answer: [msg('user', 'Jag vill boka en korlektion i Stockholm.', 60 * 3), msg('assistant', 'Vi har lediga tider nasta vecka.', 60 * 2, 'atlas-admin')] },
      { conversation_id: 'cust-anna-archived-001', session_type: 'message', contact_name: 'Anna Andersson', contact_email: 'anna@example.com', subject: 'Intensivkurs i juli', question: 'Finns det platser kvar i juli?', timestamp: msAgo(60 * 24 * 5), is_archived: 1, routing_tag: 'goteborg_hisingen', vehicle: 'B', answer: [msg('user', 'Finns det platser kvar i juli?', 60 * 24 * 5 + 30), msg('assistant', 'Ja, det finns fortfarande tva platser kvar.', 60 * 24 * 5, 'teammate')] }
    ],
    'erik@example.com': [
      { conversation_id: 'cust-erik-mail-001', session_type: 'message', contact_name: 'Erik Ek', contact_email: 'erik@example.com', subject: 'Intensivkurs och boende', question: 'Har ni intensivkurs med boende?', timestamp: msAgo(60 * 24 * 2), is_archived: 0, routing_tag: 'goteborg_hisingen', vehicle: 'B', answer: [msg('user', 'Har ni intensivkurs med boende?', 60 * 24 * 2 + 30), msg('assistant', 'Vi erbjuder kurs men inte boende.', 60 * 24 * 2, 'atlas-admin')] }
    ]
  },
  notes: {
    'live-chat-001': [{ id: 1, agent_name: 'atlas-admin', content: 'Kunden vill helst boka efter kl. 15.', created_at: new Date(msAgo(30)).toISOString() }],
    'mail-001': [],
    'claimed-001': [],
    'my-chat-001': [{ id: 2, agent_name: 'atlas-admin', content: 'Ring kunden efter lunch.', created_at: new Date(msAgo(45)).toISOString() }],
    'my-mail-001': [],
    'archive-chat-001': [],
    'archive-mail-001': []
  },
  customerNotes: {
    'anna@example.com': [{ id: 101, agent_name: 'Atlas Admin', content: 'Vanlig kund som ofta bokar sena tider.', created_at: new Date(msAgo(120)).toISOString() }],
    'erik@example.com': []
  },
  userStats: {
    'atlas-admin': { active: 2, archived: 18, mail_handled: 6, internals_sent: 4, total_active: 5, total_archived: 41, ai_answered: 11, human_handled: 30 },
    teammate: { active: 1, archived: 7, mail_handled: 2, internals_sent: 1, total_active: 5, total_archived: 41, ai_answered: 11, human_handled: 30 }
  },
  agentTickets: {
    'atlas-admin': [
      { conversation_id: 'my-chat-001', contact_name: 'Mikael Melin', preview: 'Kan ni ringa upp mig i eftermiddag?', owner: 'atlas-admin', is_assigned: 1, routing_tag: 'stockholm_city', last_message: 'Kan ni ringa upp mig i eftermiddag?' },
      { conversation_id: 'office-route-001', contact_name: 'Kontorskund', preview: 'Har ni tider i helgen?', owner: null, is_assigned: 0, routing_tag: 'stockholm_city', last_message: 'Har ni tider i helgen?' }
    ],
    teammate: [
      { conversation_id: 'claimed-001', contact_name: 'Sara Svensson', preview: 'Jag vantar pa svar fran supporten.', owner: 'teammate', is_assigned: 1, routing_tag: 'stockholm_city', last_message: 'Jag vantar pa svar fran supporten.' }
    ],
    officecoach: []
  },
  officeTickets: {
    stockholm_city: [
      { conversation_id: 'live-chat-001', contact_name: 'Anna Andersson', preview: 'Jag vill boka en korlektion i Stockholm.', routing_tag: 'stockholm_city', last_message: 'Jag vill boka en korlektion i Stockholm.' },
      { conversation_id: 'my-chat-001', contact_name: 'Mikael Melin', preview: 'Kan ni ringa upp mig i eftermiddag?', routing_tag: 'stockholm_city', last_message: 'Kan ni ringa upp mig i eftermiddag?' }
    ],
    goteborg_hisingen: [
      { conversation_id: 'mail-001', contact_name: 'Erik Ek', preview: 'Har ni intensivkurs i juli?', routing_tag: 'goteborg_hisingen', last_message: 'Har ni intensivkurs i juli?' }
    ]
  },
  knowledge: {
    stockholm_city: { city: 'Stockholm', area: 'City', office_color: '#4e9af1', contact: { phone: '08-123 45 67', email: 'stockholm@atlas.se', address: 'Sveavagen 10, Stockholm' }, opening_hours: [{ days: 'Man - Tor', hours: '08:30 - 17:00' }, { days: 'Fredag', hours: '08:00 - 14:00' }], languages: ['svenska', 'engelska'], booking_links: { CAR: 'https://atlas-support.se/boka/bil', MC: 'https://atlas-support.se/boka/mc', AM: 'https://atlas-support.se/boka/am' }, description: 'Stockholm City ansvarar for bokningar och elevsupport i innerstan.', prices: [{ service_name: 'Korlektion 40 min', price: 650, keywords: ['lektion', '40 min'] }, { service_name: 'Prova-pa lektion', price: 450, keywords: ['prova pa'] }], services_offered: ['Bil', 'MC', 'AM'] },
    goteborg_hisingen: { city: 'Goteborg', area: 'Hisingen', office_color: '#22c55e', contact: { phone: '031-123 45 67', email: 'goteborg@atlas.se', address: 'Hjalmar Brantingsgatan 12, Goteborg' }, opening_hours: [{ days: 'Man - Fre', hours: '09:00 - 16:30' }], languages: ['svenska', 'engelska', 'arabiska'], booking_links: { CAR: 'https://atlas-support.se/boka/goteborg-bil' }, description: 'Hisingen hanterar intensivkurser och AM-utbildningar.', prices: [{ service_name: 'Intensivkurs', price: 14900, keywords: ['intensivkurs'] }], services_offered: ['Bil', 'AM'] }
  },
  basfaktaList: [
    { filename: 'basfakta-priser.json', section_title: 'BASFAKTA - Priser' },
    { filename: 'basfakta-bokning.json', section_title: 'BASFAKTA - Bokning' }
  ],
  basfaktaFiles: {
    'basfakta-priser.json': { section_title: 'BASFAKTA - Priser', sections: [{ title: 'Vad kostar en korlektion?', answer: 'En vanlig korlektion kostar 650 kronor i Stockholm.', keywords: ['pris', 'korlektion'] }, { title: 'Finns prova-pa lektion?', answer: 'Ja, prova-pa lektion kostar 450 kronor.', keywords: ['prova pa', 'lektion'] }] },
    'basfakta-bokning.json': { section_title: 'BASFAKTA - Bokning', sections: [{ title: 'Hur bokar jag en lektion?', answer: 'Bokning sker via receptionen eller bokningslanken.', keywords: ['boka', 'lektion'] }] }
  },
  systemConfig: {
    PORT: '3001',
    NGROK_DOMAIN: 'atlas-demo.ngrok-free.app',
    OPENAI_API_KEY: 'sk-playwright-demo',
    EMAIL_USER: 'atlas-demo@atlas-support.se',
    EMAIL_PASS: 'app-password-demo',
    SMTP_HOST: 'smtp.demo.local',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    defaultConfidence: '0.72',
    pricingConfidence: '0.68',
    bookingConfidence: '0.75'
  },
  operationSettings: {
    imap_enabled: true,
    imap_inbound: true,
    backup_interval_hours: 24,
    backup_path: 'C:\\Atlas\\backups',
    jwt_expires_in: '8h',
    auto_human_exit: false,
    upload_ttl_days: 90
  },
  emailBlocklist: [
    { id: 1, pattern: 'blocked.example.com', type: 'domain', added_by: 'atlas-admin', created_at: new Date(msAgo(60 * 24 * 2)).toISOString() }
  ],
  availableServices: [
    { service_name: 'Korlektion 40 min', keywords: ['lektion', 'bil', '40 min'] },
    { service_name: 'Prova-pa lektion', keywords: ['prova pa', 'lektion', 'bil'] },
    { service_name: 'Risk 1 BIL', keywords: ['risk 1', 'riskettan', 'bil'] },
    { service_name: 'Intensivkurs', keywords: ['intensivkurs', 'bil'] }
  ],
  ragFailures: [
    { id: 1, query: 'Vad kostar am i malmo?', session_type: 'customer', ts_fallback_used: 1, ts_fallback_success: 0, ts_url: '', created_at: new Date(msAgo(60 * 6)).toISOString() }
  ],
  ragScores: {
    rag_score_a1_am: 25000,
    rag_score_fix_saknade: 20000,
    rag_score_c8_kontakt: 25000,
    rag_score_b1_policy: 50000,
    rag_score_c7_teori: 55000
  },
  bookingLinks: {
    AM: { type: 'info', text: 'Boka din AM-kurs via var hemsida har', linkText: 'har', url: 'https://atlas-support.se/boka/am' },
    MC: { type: 'info', text: 'For mer MC-information, kolla var hemsida', linkText: 'hemsida', url: 'https://atlas-support.se/boka/mc' },
    CAR: { type: 'info', text: 'For mer information om bilkor kort, kolla var hemsida', linkText: 'hemsida', url: 'https://atlas-support.se/boka/bil' },
    INTRO: { type: 'book', text: 'Boka handledarkurs har', linkText: 'har', url: 'https://atlas-support.se/boka/introduktion' },
    RISK1: { type: 'book', text: 'Boka Riskettan har', linkText: 'har', url: 'https://atlas-support.se/boka/risk1' },
    RISK2: { type: 'book', text: 'Boka Halkbana har', linkText: 'har', url: 'https://atlas-support.se/boka/risk2' },
    TEORI: { type: 'book', text: 'Plugga korkortsteori i appen har', linkText: 'har', url: 'https://atlas-support.se/app' },
    'B96/BE': { type: 'book', text: 'Boka slapvagnsutbildning har', linkText: 'har', url: 'https://atlas-support.se/boka/slap' },
    TUNG: { type: 'book', text: 'Boka utbildning for tung trafik har', linkText: 'har', url: 'https://atlas-support.se/boka/tung' },
    POLICY: { type: 'info', text: 'Las vara kopvillkor och policy har', linkText: 'har', url: 'https://atlas-support.se/policy' }
  },
  tsUrls: {
    TILLSTAND: 'https://www.transportstyrelsen.se/korkortstillstand',
    ATERKALLELSE: 'https://www.transportstyrelsen.se/aterkallat-korkort',
    RISK: 'https://www.transportstyrelsen.se/riskutbildning',
    HANDLEDARE: 'https://www.transportstyrelsen.se/introduktionsutbildning',
    BE_B96: 'https://www.transportstyrelsen.se/be-b96',
    YKB: 'https://www.transportstyrelsen.se/ykb',
    CE: 'https://www.transportstyrelsen.se/ce',
    MC_A: 'https://www.transportstyrelsen.se/mc',
    AM_MOPED: 'https://www.transportstyrelsen.se/am',
    B: 'https://www.transportstyrelsen.se/b',
    HALSA: 'https://www.transportstyrelsen.se/medicinska-krav',
    FORNYA: 'https://www.transportstyrelsen.se/fornya-korkortet',
    INTERNATIONELLT: 'https://www.transportstyrelsen.se/utlandska-korkort',
    ALDER: 'https://www.transportstyrelsen.se/ta-korkort'
  },
  uploadedFiles: [
    {
      id: 1,
      filename: 'welcome-guide.txt',
      original_name: 'welcome-guide.txt',
      conversation_id: 'mail-001',
      customer_name: 'Erik Ek',
      customer_email: 'erik@example.com',
      subject: 'Fraga om intensivkurs',
      uploaded_at: nowSec - 3600,
      expires_at: nowSec + 86400 * 30,
      _content: 'Playwright mock file: welcome guide'
    }
  ],
  aiArchive: [
    {
      conversation_id: 'ai-chat-001',
      session_type: 'customer',
      contact_name: 'AI Kund',
      contact_email: 'ai@example.com',
      question: 'Hur bokar jag en provlektion?',
      preview: 'Hur bokar jag en provlektion?',
      last_message: 'Du bokar enklast via receptionen eller bokningslanken.',
      owner: null,
      routing_tag: 'stockholm_city',
      office: 'stockholm_city',
      city: 'Stockholm',
      vehicle: 'B',
      timestamp: msAgo(60 * 36),
      is_archived: 1,
      human_mode: 0,
      answer: [
        msg('user', 'Hur bokar jag en provlektion?', 60 * 36 + 10),
        msg('assistant', 'Du bokar enklast via receptionen eller bokningslanken.', 60 * 36, 'atlas')
      ]
    }
  ]
};

const socketScript = `(function(){function createSocket(){return{connected:true,on(event,cb){if(event==='connect'&&typeof cb==='function')setTimeout(cb,0);return this;},once(event,cb){if(event==='connect'&&typeof cb==='function')setTimeout(cb,0);return this;},off(){return this;},emit(){return this;}};}window.io=window.io||function(){return createSocket();};})();`;

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createToken(username) {
  const user = state.users.find(item => item.username === username) || state.currentUser;
  return `${base64UrlEncode({ alg: 'none', typ: 'JWT' })}.${base64UrlEncode({ sub: username, role: user.role || 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })}.playwright`;
}

function base64UrlDecode(value) {
  const normalized = `${value}`.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return JSON.parse(Buffer.from(normalized + padding, 'base64').toString('utf8'));
}

function getAuthPayload(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return base64UrlDecode(parts[1]);
  } catch (error) {
    return null;
  }
}

function getAuthUser(req) {
  const payload = getAuthPayload(req);
  if (!payload?.sub) return state.currentUser;
  return state.users.find(item => item.username === payload.sub) || state.currentUser;
}

function requireAdmin(req, res) {
  const user = getAuthUser(req);
  if (user?.role === 'admin') return user;
  sendJson(res, 403, { error: 'Access denied' }, req.method);
  return null;
}

function ensureAuthorized(req, res) {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) return true;
  sendJson(res, 401, { error: 'Unauthorized' }, req.method);
  return false;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); });
    req.on('end', () => { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

function getContentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.ico': return 'image/x-icon';
    case '.mp3': return 'audio/mpeg';
    default: return 'application/octet-stream';
  }
}

function writeResponse(res, statusCode, headers, body, method) {
  res.writeHead(statusCode, { 'Cache-Control': 'no-store', ...headers });
  if (method === 'HEAD') return res.end();
  res.end(body);
}

function sendJson(res, statusCode, payload, method) {
  writeResponse(res, statusCode, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(payload), method);
}

function sendText(res, statusCode, payload, contentType, method) {
  writeResponse(res, statusCode, { 'Content-Type': contentType }, payload, method);
}

function sendNotFound(res, method) {
  sendJson(res, 404, { error: 'Not found' }, method);
}

function safeRendererPath(requestPath) {
  const relativePath = requestPath.replace(/^\/+/, '');
  const resolvedPath = path.normalize(path.join(RENDERER_DIR, relativePath));
  return resolvedPath.startsWith(RENDERER_DIR) ? resolvedPath : null;
}

function serveRendererFile(req, res, requestPath) {
  const filePath = safeRendererPath(requestPath);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendNotFound(res, req.method);
  const body = fs.readFileSync(filePath);
  writeResponse(res, 200, { 'Content-Type': getContentType(filePath) }, body, req.method);
}

function listInboxTickets() {
  return [...state.inbox.live_chats, ...state.inbox.mail, ...state.inbox.claimed];
}

function getCustomerEmail(url) {
  const byEmail = (url.searchParams.get('email') || '').toLowerCase();
  if (byEmail) return byEmail;
  const name = (url.searchParams.get('name') || '').toLowerCase();
  const phone = (url.searchParams.get('phone') || '').toLowerCase();
  const customer = state.customers.find(item => (name && item.name.toLowerCase() === name) || (phone && item.phone.toLowerCase() === phone));
  return customer ? customer.email.toLowerCase() : '';
}

function nextNumericId(values) {
  const max = values.reduce((current, value) => Math.max(current, Number(value?.id) || 0), 0);
  return max + 1;
}

function listAllNotes() {
  return Object.values(state.notes).flat();
}

function listTicketCollections() {
  return [
    state.inbox.live_chats,
    state.inbox.mail,
    state.inbox.claimed,
    state.myTickets.tickets,
    state.archive,
    state.aiArchive,
    ...Object.values(state.customerTickets)
  ];
}

function listAllTickets() {
  return listTicketCollections().flat();
}

function listActiveTickets() {
  return listAllTickets().filter(ticket => !ticket.is_archived);
}

function ticketMessages(ticket) {
  if (Array.isArray(ticket.messages)) return ticket.messages;
  if (Array.isArray(ticket.answer)) return ticket.answer;
  return [];
}

function findOffice(routingTag) {
  return state.offices.find(item => item.routing_tag === routingTag) || null;
}

function findTicketReference(conversationId) {
  for (const collection of listTicketCollections()) {
    const index = collection.findIndex(item => item.conversation_id === conversationId);
    if (index !== -1) return { collection, index, ticket: collection[index] };
  }
  return null;
}

function removeTicketEverywhere(conversationId) {
  for (const collection of listTicketCollections()) {
    const index = collection.findIndex(item => item.conversation_id === conversationId);
    if (index !== -1) collection.splice(index, 1);
  }
}

function upsertTicket(collection, ticket) {
  const index = collection.findIndex(item => item.conversation_id === ticket.conversation_id);
  if (index === -1) collection.push(ticket);
  else collection[index] = ticket;
}

function buildArchiveRecord(ticket, overrides = {}) {
  const office = findOffice(ticket.office || ticket.routing_tag);
  const messages = ticketMessages(ticket);
  return {
    conversation_id: ticket.conversation_id,
    session_type: ticket.session_type || 'customer',
    contact_name: ticket.contact_name || ticket.name || null,
    contact_email: ticket.contact_email || ticket.email || null,
    email: ticket.contact_email || ticket.email || null,
    question: ticket.question || ticket.last_message || ticket.preview || '',
    last_message: ticket.last_message || ticket.question || '',
    preview: ticket.preview || ticket.question || ticket.last_message || '',
    subject: ticket.subject || null,
    owner: ticket.owner || null,
    sender: ticket.sender || 'user',
    routing_tag: ticket.routing_tag || ticket.office || null,
    office: ticket.office || ticket.routing_tag || null,
    city: ticket.city || office?.city || null,
    vehicle: ticket.vehicle || null,
    timestamp: typeof ticket.timestamp === 'number' ? ticket.timestamp : Date.now(),
    is_archived: 1,
    human_mode: ticket.human_mode === undefined ? 1 : ticket.human_mode,
    source: ticket.source || null,
    answer: clone(messages),
    ...overrides
  };
}

function listAssignedTickets(username) {
  const all = [...state.myTickets.tickets, ...state.inbox.claimed];
  const seen = new Set();
  return all.filter(ticket => {
    if (ticket.owner !== username) return false;
    if (seen.has(ticket.conversation_id)) return false;
    seen.add(ticket.conversation_id);
    return true;
  });
}

function listKnownEmails() {
  const emails = new Set();
  for (const customer of state.customers) {
    if (customer.email) emails.add(customer.email.toLowerCase());
  }
  for (const ticket of listAllTickets()) {
    const email = ticket.contact_email || ticket.email;
    if (email) emails.add(`${email}`.toLowerCase());
  }
  return [...emails].sort();
}

function getUploadedFileResponse(file) {
  const { _content, ...rest } = file;
  return rest;
}

function createUploadedFile(originalName, conversationId) {
  const extension = path.extname(originalName || '') || '.txt';
  const filename = `upload-${Date.now()}-${Math.floor(Math.random() * 1000)}${extension}`;
  const uploadedFile = {
    id: nextNumericId(state.uploadedFiles),
    filename,
    original_name: originalName || filename,
    conversation_id: conversationId || 'unknown',
    customer_name: null,
    customer_email: null,
    subject: null,
    uploaded_at: Math.floor(Date.now() / 1000),
    expires_at: Math.floor(Date.now() / 1000) + (Number(state.operationSettings.upload_ttl_days) || 90) * 86400,
    _content: `Playwright mock upload for ${originalName || filename}`
  };
  state.uploadedFiles.push(uploadedFile);
  return uploadedFile;
}

function inferMultipartFilename(rawBuffer) {
  const raw = rawBuffer.toString('utf8');
  const match = raw.match(/filename="([^"]+)"/i);
  return match ? match[1] : 'attachment.txt';
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/favicon.ico') return writeResponse(res, 204, {}, '', req.method);
    if (pathname === '/socket.io/socket.io.js') return sendText(res, 200, socketScript, 'application/javascript; charset=utf-8', req.method);
    if (pathname === '/api/public/offices' && req.method === 'GET') return sendJson(res, 200, clone(state.offices), req.method);
    if (pathname === '/api/public/version' && req.method === 'GET') return sendJson(res, 200, { version: '4.0.0-playwright' }, req.method);

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.username) return sendJson(res, 400, { error: 'Username is required' }, req.method);
      const user = state.users.find(item => item.username === body.username);
      if (!user) return sendJson(res, 401, { error: 'Anvandaren finns inte' }, req.method);
      state.currentUser = { ...state.currentUser, ...user };
      return sendJson(res, 200, {
        token: createToken(user.username),
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          agent_color: user.agent_color,
          display_name: user.display_name,
          avatar_id: user.avatar_id,
          status_text: user.status_text,
          routing_tag: user.routing_tag,
          allowed_views: user.allowed_views ?? null
        }
      }, req.method);
    }

    if (pathname === '/api/auth/users' && req.method === 'GET') {
      if (!req.headers.authorization) return sendJson(res, 200, clone(state.users), req.method);
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.users), req.method);
    }

    if (pathname === '/api/auth/change-password' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, { success: true, message: 'Losenordet uppdaterat!' }, req.method);
    }

    if (pathname === '/api/auth/update-profile' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      const user = getAuthUser(req);
      const index = state.users.findIndex(item => item.username === user.username);
      if (index === -1) return sendNotFound(res, req.method);
      state.users[index] = { ...state.users[index], ...body };
      state.currentUser = { ...state.currentUser, ...body };
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname === '/api/templates' && req.method === 'GET') {
      if (!req.headers.authorization) return sendJson(res, 200, clone(state.templates), req.method);
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.templates), req.method);
    }

    if (pathname === '/api/templates/save' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      const finalId = body.id || nextNumericId(state.templates);
      const nextTemplate = {
        id: finalId,
        title: body.title || 'Namnlos mall',
        content: body.content || '',
        group_name: body.group_name || null,
        owner: body.owner || null
      };
      const index = state.templates.findIndex(item => Number(item.id) === Number(finalId));
      if (index === -1) state.templates.push(nextTemplate);
      else state.templates[index] = nextTemplate;
      return sendJson(res, 200, { status: 'success' }, req.method);
    }

    if (pathname === '/api/templates/delete' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      state.templates = state.templates.filter(item => Number(item.id) !== Number(body.id));
      return sendJson(res, 200, { status: 'success' }, req.method);
    }

    if (pathname.startsWith('/api/templates/delete/') && req.method === 'DELETE') {
      if (!ensureAuthorized(req, res)) return;
      const id = pathname.split('/').pop();
      const before = state.templates.length;
      state.templates = state.templates.filter(item => `${item.id}` !== `${id}`);
      if (before === state.templates.length) return sendJson(res, 404, { error: 'Mall hittades inte' }, req.method);
      return sendJson(res, 200, { status: 'success' }, req.method);
    }

    if (pathname === '/team/inbox' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      const user = getAuthUser(req);
      if (user.role === 'admin') {
        return sendJson(res, 200, {
          tickets: clone(listActiveTickets()),
          live_chats: clone(state.inbox.live_chats),
          mail: clone(state.inbox.mail),
          claimed: clone(state.inbox.claimed)
        }, req.method);
      }
      return sendJson(res, 200, { tickets: clone(listAssignedTickets(user.username)) }, req.method);
    }

    if (pathname === '/team/inbox/search' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      const query = (url.searchParams.get('q') || '').trim().toLowerCase();
      const tickets = listActiveTickets().filter(ticket => [ticket.contact_name, ticket.contact_email, ticket.subject, ticket.question, ticket.last_message, ticket.routing_tag, ticket.owner, ticket.conversation_id].filter(Boolean).join(' ').toLowerCase().includes(query));
      return sendJson(res, 200, { tickets: clone(tickets) }, req.method);
    }

    if (pathname === '/team/my-tickets' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      const user = getAuthUser(req);
      return sendJson(res, 200, { tickets: clone(listAssignedTickets(user.username)) }, req.method);
    }

    if (pathname.startsWith('/team/ticket/') && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      const conversationId = pathname.split('/').pop();
      const ref = findTicketReference(conversationId);
      if (!ref) return sendJson(res, 404, { error: 'Arende hittades inte' }, req.method);
      const ticket = ref.ticket;
      return sendJson(res, 200, {
        conversation_id: ticket.conversation_id,
        session_type: ticket.session_type || 'customer',
        routing_tag: ticket.routing_tag || ticket.office || null,
        owner: ticket.owner || null,
        sender: ticket.sender || 'user',
        is_archived: ticket.is_archived === 1,
        updated_at: ticket.updated_at || nowSec,
        subject: ticket.subject || null,
        contact_name: ticket.contact_name || null,
        contact_email: ticket.contact_email || ticket.email || null,
        contact_phone: ticket.contact_phone || ticket.phone || null,
        vehicle: ticket.vehicle || null,
        messages: clone(ticketMessages(ticket))
      }, req.method);
    }

    if (pathname === '/team/claim' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      const agentName = body.agentName || getAuthUser(req).username;
      const ref = findTicketReference(body.conversationId);
      if (!ref) return sendJson(res, 404, { error: 'Ticket not found' }, req.method);
      const ticket = { ...ref.ticket, owner: agentName, is_archived: 0, updated_at: nowSec };
      removeTicketEverywhere(body.conversationId);
      if (ticket.owner === getAuthUser(req).username) upsertTicket(state.myTickets.tickets, ticket);
      else upsertTicket(state.inbox.claimed, ticket);
      return sendJson(res, 200, { status: 'success', owner: ticket.owner, previousOwner: ref.ticket.owner || null, session_type: ticket.session_type }, req.method);
    }

    if (pathname === '/team/assign' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      const ref = findTicketReference(body.conversationId);
      if (!ref) return sendJson(res, 404, { error: 'Ticket not found' }, req.method);
      const ticket = { ...ref.ticket, owner: body.targetAgent, is_archived: 0, updated_at: nowSec };
      removeTicketEverywhere(body.conversationId);
      if (ticket.owner === getAuthUser(req).username) upsertTicket(state.myTickets.tickets, ticket);
      else upsertTicket(state.inbox.claimed, ticket);
      return sendJson(res, 200, { status: 'success', assignedTo: body.targetAgent }, req.method);
    }

    if (pathname === '/api/team/known-emails' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, { emails: listKnownEmails() }, req.method);
    }

    if (pathname === '/api/team/reply' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      const ref = findTicketReference(body.conversationId);
      if (!ref) return sendJson(res, 404, { error: 'Ticket not found' }, req.method);
      const nextMessage = {
        role: body.role || 'agent',
        content: body.message,
        sender: getAuthUser(req).username,
        timestamp: Date.now()
      };
      const messages = [...ticketMessages(ref.ticket), nextMessage];
      ref.ticket.messages = messages;
      ref.ticket.answer = messages;
      ref.ticket.last_message = body.message;
      ref.ticket.updated_at = nowSec;
      return sendJson(res, 200, { status: 'success', saved_message: body.message }, req.method);
    }

    if (pathname === '/api/team/create-internal' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      const sender = getAuthUser(req).username;
      const conversationId = `INTERNAL_${Date.now().toString(36)}`;
      const internalTicket = {
        conversation_id: conversationId,
        session_type: 'internal',
        human_mode: 1,
        owner: body.recipient,
        sender,
        updated_at: nowSec,
        is_archived: 0,
        routing_tag: 'INTERNAL',
        subject: body.subject || 'Internt meddelande',
        contact_name: sender,
        contact_email: 'Internt',
        last_message: body.message,
        messages: [{ id: conversationId, sender, role: 'agent', text: body.message, content: body.message, timestamp: Date.now() }]
      };
      upsertTicket(state.myTickets.tickets, internalTicket);
      state.notes[conversationId] = [];
      return sendJson(res, 200, { success: true, conversationId }, req.method);
    }

    if (pathname === '/api/archive' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, { archive: clone(state.archive) }, req.method);
    }

    if (pathname === '/api/archive/ai' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, { ai_chats: clone(state.aiArchive) }, req.method);
    }

    if (pathname === '/api/inbox/archive' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      const ref = findTicketReference(body.conversationId);
      if (!ref) return sendJson(res, 404, { error: 'Arendet hittades inte i databasen' }, req.method);
      const archiveRecord = buildArchiveRecord(ref.ticket);
      removeTicketEverywhere(body.conversationId);
      upsertTicket(state.archive, archiveRecord);
      return sendJson(res, 200, { status: 'success' }, req.method);
    }

    if (pathname === '/api/inbox/delete' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      removeTicketEverywhere(body.conversationId);
      delete state.notes[body.conversationId];
      state.uploadedFiles = state.uploadedFiles.filter(item => item.conversation_id !== body.conversationId);
      return sendJson(res, 200, { status: 'success' }, req.method);
    }

    if (pathname.startsWith('/api/notes/') && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      const conversationId = pathname.split('/').pop();
      return sendJson(res, 200, clone(state.notes[conversationId] || []), req.method);
    }

    if (pathname === '/api/notes' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      const conversationId = body.conversationId;
      const user = getAuthUser(req);
      const nextNote = {
        id: nextNumericId(listAllNotes()),
        agent_name: user.username,
        content: body.content || '',
        created_at: new Date().toISOString()
      };
      if (!state.notes[conversationId]) state.notes[conversationId] = [];
      state.notes[conversationId].unshift(nextNote);
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname.startsWith('/api/notes/') && req.method === 'PUT') {
      if (!ensureAuthorized(req, res)) return;
      const id = pathname.split('/').pop();
      const body = await readJsonBody(req);
      for (const conversationId of Object.keys(state.notes)) {
        const note = state.notes[conversationId].find(item => `${item.id}` === `${id}`);
        if (!note) continue;
        note.content = body.content || note.content;
        return sendJson(res, 200, { success: true }, req.method);
      }
      return sendJson(res, 404, { error: 'Note not found' }, req.method);
    }

    if (pathname.startsWith('/api/notes/') && req.method === 'DELETE') {
      if (!ensureAuthorized(req, res)) return;
      const id = pathname.split('/').pop();
      for (const conversationId of Object.keys(state.notes)) {
        const before = state.notes[conversationId].length;
        state.notes[conversationId] = state.notes[conversationId].filter(item => `${item.id}` !== `${id}`);
        if (before !== state.notes[conversationId].length) return sendJson(res, 200, { success: true }, req.method);
      }
      return sendJson(res, 404, { error: 'Note not found' }, req.method);
    }

    if (pathname === '/api/customers' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, { customers: clone(state.customers) }, req.method);
    }

    if (pathname === '/api/customers/tickets' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, { tickets: clone(state.customerTickets[getCustomerEmail(url)] || []) }, req.method);
    }

    if (pathname === '/api/customers/summarize' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      return sendJson(res, 200, { summary: `Sammanfattning for ${body.email}: kunden har flera arenden om bokning, priser och uppfoljning.` }, req.method);
    }

    if (pathname === '/api/customer-notes' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      const email = (url.searchParams.get('email') || '').toLowerCase();
      return sendJson(res, 200, { notes: clone(state.customerNotes[email] || []) }, req.method);
    }

    if (pathname === '/api/customer-notes' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      const email = `${body.email || ''}`.toLowerCase().trim();
      const user = getAuthUser(req);
      if (!state.customerNotes[email]) state.customerNotes[email] = [];
      state.customerNotes[email].unshift({
        id: nextNumericId(Object.values(state.customerNotes).flat()),
        agent_name: user.display_name || user.username,
        content: body.content || '',
        created_at: new Date().toISOString()
      });
      return sendJson(res, 200, { ok: true }, req.method);
    }

    if (pathname.startsWith('/api/customer-notes/') && req.method === 'DELETE') {
      if (!ensureAuthorized(req, res)) return;
      const id = pathname.split('/').pop();
      for (const email of Object.keys(state.customerNotes)) {
        const before = state.customerNotes[email].length;
        state.customerNotes[email] = state.customerNotes[email].filter(item => `${item.id}` !== `${id}`);
        if (before !== state.customerNotes[email].length) return sendJson(res, 200, { ok: true }, req.method);
      }
      return sendJson(res, 404, { error: 'Anteckning hittades inte' }, req.method);
    }

    if (pathname === '/api/admin/users' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.users), req.method);
    }

    if (pathname.startsWith('/api/admin/user-stats/') && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.userStats[pathname.split('/').pop()] || {}), req.method);
    }

    if (pathname.startsWith('/api/admin/agent-tickets/') && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.agentTickets[pathname.split('/').pop()] || []), req.method);
    }

    if (pathname.startsWith('/api/admin/office-tickets/') && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.officeTickets[pathname.split('/').pop()] || []), req.method);
    }

    if (pathname.startsWith('/api/knowledge/') && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      const item = state.knowledge[pathname.split('/').pop()];
      return item ? sendJson(res, 200, clone(item), req.method) : sendNotFound(res, req.method);
    }

    if (pathname.startsWith('/api/knowledge/') && req.method === 'PUT') {
      if (!ensureAuthorized(req, res)) return;
      const tag = pathname.split('/').pop();
      const body = await readJsonBody(req);
      if (!state.knowledge[tag]) return sendNotFound(res, req.method);
      state.knowledge[tag] = { ...state.knowledge[tag], ...body };
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname === '/api/admin/basfakta-list' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.basfaktaList), req.method);
    }

    if (pathname.startsWith('/api/admin/basfakta/') && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      const item = state.basfaktaFiles[pathname.split('/').pop()];
      return item ? sendJson(res, 200, clone(item), req.method) : sendNotFound(res, req.method);
    }

    if (pathname.startsWith('/api/admin/basfakta/') && req.method === 'PUT') {
      if (!ensureAuthorized(req, res)) return;
      const filename = pathname.split('/').pop();
      const body = await readJsonBody(req);
      if (!state.basfaktaFiles[filename]) return sendNotFound(res, req.method);
      state.basfaktaFiles[filename] = { ...state.basfaktaFiles[filename], ...body };
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname === '/api/admin/system-config' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.systemConfig), req.method);
    }

    if (pathname === '/api/admin/system-config' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      if (!body.field) return sendJson(res, 400, { error: 'field saknas' }, req.method);
      state.systemConfig[body.field] = body.value;
      return sendJson(res, 200, { success: true, changedFiles: ['.env'], restartRequired: false }, req.method);
    }

    if (pathname === '/api/admin/operation-settings' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.operationSettings), req.method);
    }

    if (pathname === '/api/admin/operation-settings' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      state.operationSettings[body.field] = body.value;
      return sendJson(res, 200, { success: true, field: body.field, value: body.value }, req.method);
    }

    if (pathname === '/api/admin/email-blocklist' && req.method === 'GET') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      return sendJson(res, 200, clone(state.emailBlocklist), req.method);
    }

    if (pathname === '/api/admin/email-blocklist' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      const rawPattern = `${body.pattern || ''}`.trim().toLowerCase();
      if (!rawPattern) return sendJson(res, 400, { error: 'Monster kravs.' }, req.method);
      const isDomain = rawPattern.startsWith('@') || (!rawPattern.includes('@') && rawPattern.includes('.'));
      const pattern = rawPattern.replace(/^@/, '');
      const existing = state.emailBlocklist.find(item => item.pattern === pattern);
      if (existing) return sendJson(res, 200, { ok: true, id: existing.id, pattern, type: existing.type }, req.method);
      const entry = {
        id: nextNumericId(state.emailBlocklist),
        pattern,
        type: isDomain ? 'domain' : 'email',
        added_by: adminUser.username,
        created_at: new Date().toISOString()
      };
      state.emailBlocklist.unshift(entry);
      return sendJson(res, 200, { ok: true, id: entry.id, pattern: entry.pattern, type: entry.type }, req.method);
    }

    if (pathname.startsWith('/api/admin/email-blocklist/') && req.method === 'DELETE') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const id = pathname.split('/').pop();
      state.emailBlocklist = state.emailBlocklist.filter(item => `${item.id}` !== `${id}`);
      return sendJson(res, 200, { ok: true }, req.method);
    }

    if (pathname.startsWith('/api/admin/report-spam/') && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const conversationId = pathname.split('/').pop();
      const ticket = listAllTickets().find(item => item.conversation_id === conversationId);
      const pattern = (ticket?.contact_email || ticket?.email || '').toLowerCase().trim();
      if (!pattern) return sendJson(res, 404, { error: 'Ingen e-post hittad for arendet.' }, req.method);
      const existing = state.emailBlocklist.find(item => item.pattern === pattern);
      if (existing) return sendJson(res, 200, { ok: true, pattern, added: false }, req.method);
      state.emailBlocklist.unshift({
        id: nextNumericId(state.emailBlocklist),
        pattern,
        type: 'email',
        added_by: getAuthUser(req).username,
        created_at: new Date().toISOString()
      });
      return sendJson(res, 200, { ok: true, pattern, added: true }, req.method);
    }

    if (pathname === '/api/admin/available-services' && req.method === 'GET') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      return sendJson(res, 200, clone(state.availableServices), req.method);
    }

    if (pathname === '/api/admin/rag-failures' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.ragFailures), req.method);
    }

    if (pathname === '/api/admin/rag-failures' && req.method === 'DELETE') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      state.ragFailures = [];
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname === '/api/admin/rag-scores' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.ragScores), req.method);
    }

    if (pathname === '/api/admin/rag-scores' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      state.ragScores[body.field] = parseInt(body.value, 10);
      return sendJson(res, 200, { success: true, field: body.field, value: state.ragScores[body.field], restartRequired: true }, req.method);
    }

    if (pathname === '/api/admin/booking-links' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.bookingLinks), req.method);
    }

    if (pathname === '/api/admin/booking-links' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      if (!state.bookingLinks[body.key]) return sendJson(res, 400, { error: `Okand nyckel: ${body.key}` }, req.method);
      state.bookingLinks[body.key] = { ...state.bookingLinks[body.key], url: body.url };
      return sendJson(res, 200, { success: true, key: body.key, url: body.url, restartRequired: true }, req.method);
    }

    if (pathname === '/api/admin/ts-urls' && req.method === 'GET') {
      if (!ensureAuthorized(req, res)) return;
      return sendJson(res, 200, clone(state.tsUrls), req.method);
    }

    if (pathname === '/api/admin/ts-urls' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      if (!Object.prototype.hasOwnProperty.call(state.tsUrls, body.key)) return sendJson(res, 400, { error: `Okand nyckel: ${body.key}` }, req.method);
      state.tsUrls[body.key] = body.url;
      return sendJson(res, 200, { success: true, key: body.key, url: body.url, restartRequired: true }, req.method);
    }

    if (pathname === '/api/admin/generate-report' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      const title = body.type === 'custom' ? 'Anpassad rapport' : 'Systemoversikt';
      const markdown = [
        `# ${title}`,
        '',
        `Genererad for mockservern ${new Date().toLocaleString('sv-SE')}.`,
        '',
        `- Aktiva arenden: ${listActiveTickets().length}`,
        `- Arkiverade arenden: ${state.archive.length}`,
        `- Agenter: ${state.users.length}`
      ].join('\n');
      return sendJson(res, 200, { title, markdown, generatedAt: new Date().toISOString() }, req.method);
    }

    if (pathname === '/api/admin/analyze-gaps' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const analysis = state.ragFailures.length
        ? 'Flera luckor verkar handla om pris- och lokalkoppling. Kontrollera basfakta for AM och kontorsspecifika priser.'
        : 'Inga tydliga luckor hittades i mockdatan just nu.';
      return sendJson(res, 200, { analysis }, req.method);
    }

    if (pathname === '/api/admin/analyze-gap-single' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      return sendJson(res, 200, {
        analysis: `Fragan "${body.query || ''}" verkar sakna ett tydligt kunskapsstycke och bor kompletteras i basfakta.`,
        target_file: 'knowledge/mock-gap.json',
        section: {
          title: body.query || 'Ny basfakta-post',
          answer: 'Lagg till ett kontrollerat svar for detta scenario.',
          keywords: ['mock', 'gap']
        }
      }, req.method);
    }

    if (pathname === '/api/admin/uploaded-files' && req.method === 'GET') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      return sendJson(res, 200, { files: state.uploadedFiles.map(getUploadedFileResponse) }, req.method);
    }

    if (pathname.startsWith('/api/admin/uploaded-files/') && req.method === 'DELETE') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const id = pathname.split('/').pop();
      state.uploadedFiles = state.uploadedFiles.filter(item => `${item.id}` !== `${id}`);
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname === '/api/admin/uploaded-files' && req.method === 'DELETE') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      state.uploadedFiles = [];
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname === '/api/admin/create-user' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      if (state.users.some(item => item.username === body.username)) return sendJson(res, 400, { error: 'Anvandarnamnet upptaget' }, req.method);
      const nextUser = {
        id: nextNumericId(state.users),
        username: body.username.toLowerCase(),
        role: body.role || 'agent',
        display_name: body.display_name || body.username,
        agent_color: body.agent_color || '#0071e3',
        avatar_id: body.avatar_id ?? 0,
        status_text: '',
        routing_tag: body.routing_tag || null,
        is_online: 0,
        allowed_views: null
      };
      state.users.push(nextUser);
      return sendJson(res, 200, { success: true, userId: nextUser.id }, req.method);
    }

    if (pathname === '/api/admin/update-user-profile' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      const index = state.users.findIndex(item => Number(item.id) === Number(body.userId));
      if (index === -1) return sendNotFound(res, req.method);
      state.users[index] = {
        ...state.users[index],
        username: body.username || state.users[index].username,
        role: body.role || state.users[index].role,
        display_name: body.display_name || state.users[index].display_name,
        agent_color: body.agent_color || state.users[index].agent_color,
        avatar_id: body.avatar_id ?? state.users[index].avatar_id,
        routing_tag: body.routing_tag ?? state.users[index].routing_tag
      };
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname === '/api/admin/reset-password' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname === '/api/admin/delete-user' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      const target = state.users.find(item => Number(item.id) === Number(body.userId));
      if (!target) return sendNotFound(res, req.method);
      state.users = state.users.filter(item => Number(item.id) !== Number(body.userId));
      for (const ticket of listAllTickets()) {
        if (ticket.owner === target.username) ticket.owner = null;
      }
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname === '/api/admin/update-office-color' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      const office = state.offices.find(item => item.routing_tag === body.routing_tag);
      if (!office) return sendNotFound(res, req.method);
      office.office_color = body.color;
      if (state.knowledge[body.routing_tag]) state.knowledge[body.routing_tag].office_color = body.color;
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname === '/api/admin/update-agent-color' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      const user = getAuthUser(req);
      if (user.role !== 'admin' && user.username !== body.username) return sendJson(res, 403, { error: 'Du kan bara andra din egen profilfarg.' }, req.method);
      const target = state.users.find(item => item.username === body.username);
      if (!target) return sendNotFound(res, req.method);
      target.agent_color = body.color;
      if (state.currentUser.username === body.username) state.currentUser.agent_color = body.color;
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname === '/api/admin/update-agent-offices' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      const target = state.users.find(item => item.username === body.username);
      if (!target) return sendNotFound(res, req.method);
      const tags = new Set(`${target.routing_tag || ''}`.split(',').map(item => item.trim()).filter(Boolean));
      if (body.isChecked) tags.add(body.tag);
      else tags.delete(body.tag);
      target.routing_tag = [...tags].join(',');
      return sendJson(res, 200, { success: true, newTags: target.routing_tag }, req.method);
    }

    if (pathname.startsWith('/api/admin/user-views/') && req.method === 'PUT') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const username = pathname.split('/').pop();
      const body = await readJsonBody(req);
      const target = state.users.find(item => item.username === username);
      if (!target) return sendNotFound(res, req.method);
      target.allowed_views = Array.isArray(body.allowed_views) ? JSON.stringify(body.allowed_views) : null;
      return sendJson(res, 200, { success: true, allowed_views: target.allowed_views }, req.method);
    }

    if (pathname === '/api/admin/create-office' && req.method === 'POST') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const body = await readJsonBody(req);
      if (state.offices.some(item => item.routing_tag === body.routing_tag)) return sendJson(res, 409, { error: `Routing tag '${body.routing_tag}' anvands redan.` }, req.method);
      const office = {
        id: nextNumericId(state.offices),
        name: body.area ? `${body.city} ${body.area}` : body.city,
        city: body.city,
        area: body.area || '',
        routing_tag: body.routing_tag,
        office_color: body.office_color || '#0071e3'
      };
      state.offices.push(office);
      state.knowledge[body.routing_tag] = {
        city: body.city,
        area: body.area || '',
        office_color: office.office_color,
        contact: body.contact || { phone: '', email: '', address: '' },
        opening_hours: body.opening_hours || [],
        languages: body.languages || [],
        booking_links: body.booking_links || {},
        description: body.description || '',
        prices: body.prices || [],
        services_offered: body.services_offered || []
      };
      state.officeTickets[body.routing_tag] = [];
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname.startsWith('/api/admin/office/') && req.method === 'DELETE') {
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return;
      const tag = pathname.split('/').pop();
      state.offices = state.offices.filter(item => item.routing_tag !== tag);
      delete state.knowledge[tag];
      delete state.officeTickets[tag];
      return sendJson(res, 200, { success: true }, req.method);
    }

    if (pathname === '/api/upload' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const rawBody = await readRawBody(req);
      const originalName = inferMultipartFilename(rawBody);
      const uploadedFile = createUploadedFile(originalName, 'unknown');
      return sendJson(res, 200, {
        filename: uploadedFile.filename,
        originalName: uploadedFile.original_name,
        url: `/api/public/uploads/${uploadedFile.filename}`
      }, req.method);
    }

    if (pathname === '/api/upload/patch-conversation' && req.method === 'POST') {
      if (!ensureAuthorized(req, res)) return;
      const body = await readJsonBody(req);
      const filenames = Array.isArray(body.filenames)
        ? body.filenames
        : (body.filename ? [body.filename] : []);
      for (const uploadedFile of state.uploadedFiles) {
        if (filenames.includes(uploadedFile.filename)) {
          uploadedFile.conversation_id = body.conversationId || body.conversation_id || uploadedFile.conversation_id;
        }
      }
      return sendJson(res, 200, { success: true }, req.method);
    }

    if ((pathname.startsWith('/api/public/uploads/') || pathname.startsWith('/uploads/')) && (req.method === 'GET' || req.method === 'HEAD')) {
      const filename = pathname.split('/').pop();
      const file = state.uploadedFiles.find(item => item.filename === filename);
      if (!file) return sendNotFound(res, req.method);
      const contentType = getContentType(filename);
      return sendText(res, 200, file._content || `Mock file for ${filename}`, contentType, req.method);
    }

    if (
      pathname === '/' ||
      pathname === '/index.html' ||
      pathname === '/renderer.js' ||
      pathname === '/loader.css' ||
      pathname === '/loader.html' ||
      pathname === '/loader.js' ||
      pathname.startsWith('/assets/') ||
      pathname.startsWith('/modules/')
    ) {
      return serveRendererFile(req, res, pathname === '/' ? '/index.html' : pathname);
    }

    if (req.method === 'GET') return serveRendererFile(req, res, '/index.html');
    return sendNotFound(res, req.method);
  } catch (error) {
    return sendJson(res, 500, { error: error.message }, req.method);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[playwright-mock-server] listening on http://${HOST}:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
