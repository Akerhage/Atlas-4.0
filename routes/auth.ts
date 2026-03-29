// ============================================
// routes/auth.js - Auth & publika endpoints
// VAD DEN GÖR: Hanterar inloggning, lösenordsbyte,
//              profiländring, seed och versionsinfo
// ANVÄNDS AV: server.js via app.use('/api', authRoutes)
// ============================================

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { db, getUserByUsername, createUser, updateUserPassword } = require('../db');
const authenticateToken = require('../middleware/auth');

type LoginAttempt = {
  count: number;
  firstAttempt: number;
};

type LiveIo = {
  emit: (eventName: string, payload: Record<string, unknown>) => void;
};

type AuthRouter = ReturnType<typeof express.Router> & {
  setJwtExpiresIn: (val: string) => void;
  setIo: (ioInstance: LiveIo | null) => void;
};

type AuthenticatedUser = {
  id: number;
  username: string;
  role: string;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: Record<string, unknown>) => unknown;
};

type RequestLike<TBody = Record<string, unknown>> = {
  body: TBody;
  headers: Record<string, string | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
};

type AuthenticatedRequest<TBody = Record<string, unknown>> = RequestLike<TBody> & {
  user: AuthenticatedUser;
};

type LoginRequestBody = {
  username: string;
  password: string;
};

type ChangePasswordBody = {
  oldPassword: string;
  newPassword: string;
};

type UpdateProfileBody = {
  display_name?: string;
  status_text?: string;
  agent_color?: string;
  avatar_id?: number;
};

type SeedBody = {
  username: string;
  password: string;
};

type DbUser = {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  agent_color?: string;
  display_name?: string;
  avatar_id?: number;
  status_text?: string;
  routing_tag?: string | null;
  allowed_views?: unknown;
};

const router = express.Router() as AuthRouter;
const JWT_SECRET: string | undefined = process.env.JWT_SECRET;

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

// Brute-force-skydd för login (max 5 fel / 15 min per IP)
const loginAttempts = new Map<string, LoginAttempt>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// JWT-utgångstid - synkas från server.js via setJwtExpiresIn() vid start och vid settings-ändring
let jwtExpiresIn = '24h';
router.setJwtExpiresIn = (val: string) => {
  jwtExpiresIn = val;
};

// Socket.io-instans - injiceras från server.js via setIo() för live-uppdateringar
let io: LiveIo | null = null;
router.setIo = (ioInstance: LiveIo | null) => {
  io = ioInstance;
};

// =============================================================================
// AUTHENTICATION ENDPOINTS
// =============================================================================
router.post('/auth/login', async (req: RequestLike<LoginRequestBody>, res: ResponseLike) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (attempt && attempt.count >= LOGIN_MAX_ATTEMPTS && (now - attempt.firstAttempt) < LOGIN_WINDOW_MS) {
    const waitMin = Math.ceil((LOGIN_WINDOW_MS - (now - attempt.firstAttempt)) / 60000);
    console.warn(`[LOGIN] Rate limit för ${ip} - spärrad ${waitMin} min till`);
    return res.status(429).json({ error: `För många inloggningsförsök. Försök igen om ${waitMin} min.` });
  }

  const { username, password } = req.body;
  console.log(`Inloggningsförsök: ${username}`);

  try {
    const user = await getUserByUsername(username) as DbUser | null;

    if (!user) {
      console.log(`Användaren "${username}" hittades inte i DB.`);
      const entry = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
      entry.count += 1;
      loginAttempts.set(ip, entry);
      return res.status(401).json({ error: 'Användaren finns inte' });
    }

    const match = await bcrypt.compare(password, user.password_hash) as boolean;

    if (!match) {
      console.log(`Fel lösenord för "${username}"`);
      const entry = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
      entry.count += 1;
      loginAttempts.set(ip, entry);
      return res.status(401).json({ error: 'Felaktigt lösenord' });
    }

    loginAttempts.delete(ip);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, routing_tag: user.routing_tag },
      JWT_SECRET,
      { expiresIn: jwtExpiresIn }
    );

    console.log(`${username} inloggad (ID: ${user.id}, Roll: ${user.role})`);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        agent_color: user.agent_color,
        display_name: user.display_name,
        avatar_id: user.avatar_id,
        status_text: user.status_text,
        routing_tag: user.routing_tag,
        allowed_views: user.allowed_views ?? null,
      },
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Internt serverfel' });
  }
});

router.post('/auth/change-password', authenticateToken, async (req: AuthenticatedRequest<ChangePasswordBody>, res: ResponseLike) => {
  const { oldPassword, newPassword } = req.body;
  const username = req.user.username;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Fyll i både gammalt och nytt lösenord' });
  }

  try {
    const user = await getUserByUsername(username) as DbUser | null;
    if (!user) {
      return res.status(404).json({ error: 'Användaren hittades inte' });
    }

    const validPass = await bcrypt.compare(oldPassword, user.password_hash) as boolean;
    if (!validPass) {
      return res.status(401).json({ error: 'Fel nuvarande lösenord' });
    }

    const newHash = await bcrypt.hash(newPassword, 10) as string;
    await updateUserPassword(username, newHash);

    console.log(`Lösenord bytt för användare: ${username}`);
    return res.json({ success: true, message: 'Lösenordet uppdaterat!' });
  } catch (err) {
    console.error('Password change error:', err);
    return res.status(500).json({ error: 'Kunde inte byta lösenord' });
  }
});

router.post('/auth/update-profile', authenticateToken, async (req: AuthenticatedRequest<UpdateProfileBody>, res: ResponseLike) => {
  const { display_name, status_text, agent_color, avatar_id } = req.body;
  const userId = req.user.id;
  const sql = 'UPDATE users SET display_name = ?, status_text = ?, agent_color = ?, avatar_id = ? WHERE id = ?';

  db.run(sql, [display_name, status_text, agent_color, avatar_id, userId], (err: Error | null) => {
    if (err) {
      console.error('Update profile error:', err);
      return res.status(500).json({ error: 'Kunde inte uppdatera profil' });
    }

    if (io && agent_color) {
      io.emit('agent:color_updated', { username: req.user.username, color: agent_color });
    }

    return res.json({ success: true });
  });
});

router.post('/auth/seed', async (req: RequestLike<SeedBody>, res: ResponseLike) => {
  try {
    const count = await new Promise<number>((resolve, reject) => {
      db.get('SELECT COUNT(*) as c FROM users', [], (err: Error | null, row?: { c?: number }) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row?.c ?? 1);
      });
    });

    if (count > 0) {
      return res.status(403).json({ error: 'Setup already complete' });
    }

    const { username, password } = req.body;
    const hash = await bcrypt.hash(password, 10) as string;
    await createUser(username, hash);
    return res.json({ message: 'User created' });
  } catch (err) {
    return res.status(500).json({ error: getErrorMessage(err) });
  }
});

router.get('/public/version', (_req: RequestLike, res: ResponseLike) => {
  res.json({ version: '4.0' });
});

module.exports = router;
