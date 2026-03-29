const jwt = require('jsonwebtoken');

const JWT_SECRET: string | undefined = process.env.JWT_SECRET;

type NextFunction = () => void;

interface RequestLike {
  headers: Record<string, string | undefined>;
  user?: Record<string, unknown>;
}

interface ResponseLike {
  status: (code: number) => {
    json: (payload: Record<string, string>) => unknown;
  };
}

function authenticateToken(req: RequestLike, res: ResponseLike, next: NextFunction): unknown {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];
  const token = authHeader ? authHeader.split(' ')[1] : undefined;

  if (apiKey && process.env.CLIENT_API_KEY && apiKey === process.env.CLIENT_API_KEY) {
    req.user = { username: 'System', role: 'admin' };
    return next();
  }

  if (token == null) {
    return res.status(401).json({ error: 'Auth required' });
  }

  return jwt.verify(token, JWT_SECRET, (err: unknown, user: Record<string, unknown>) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    return next();
  });
}

module.exports = authenticateToken;
