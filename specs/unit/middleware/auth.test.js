const jwt = require('jsonwebtoken');

function createRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

function loadAuthMiddleware() {
  delete require.cache[require.resolve('../../../middleware/auth.ts')];
  return require('../../../middleware/auth.ts');
}

describe('middleware/auth', () => {
  afterEach(() => {
    delete process.env.CLIENT_API_KEY;
    delete process.env.JWT_SECRET;
    vi.restoreAllMocks();
  });

  it('allows internal API-key calls without a bearer token', () => {
    process.env.CLIENT_API_KEY = 'atlas-internal-key';
    process.env.JWT_SECRET = 'jwt-secret';

    const authenticateToken = loadAuthMiddleware();
    const req = { headers: { 'x-api-key': 'atlas-internal-key' } };
    const res = createRes();
    const next = vi.fn();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ username: 'System', role: 'admin' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when neither API-key nor bearer token is present', () => {
    process.env.JWT_SECRET = 'jwt-secret';

    const authenticateToken = loadAuthMiddleware();
    const req = { headers: {} };
    const res = createRes();
    const next = vi.fn();

    authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Auth required' });
  });

  it('accepts a valid bearer token and exposes the decoded user on req.user', () => {
    process.env.JWT_SECRET = 'jwt-secret';
    const token = jwt.sign({ username: 'patrik', role: 'admin' }, 'jwt-secret');

    const authenticateToken = loadAuthMiddleware();
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = vi.fn();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ username: 'patrik', role: 'admin' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects an invalid bearer token with 403', () => {
    process.env.JWT_SECRET = 'jwt-secret';
    const token = jwt.sign({ username: 'patrik', role: 'admin' }, 'different-secret');

    const authenticateToken = loadAuthMiddleware();
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = vi.fn();

    authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
  });
});
