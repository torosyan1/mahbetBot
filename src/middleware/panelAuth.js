const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ── Config ────────────────────────────────────────────────────
// Every panel API is protected by a signed JWT. The secret has no fallback
// on purpose — a hardcoded default would make the signature worthless.
const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const JWT_ISSUER     = 'mahbet-bot-api';
const JWT_AUDIENCE   = 'mahbet-admin-panel';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('[auth] FATAL: JWT_SECRET is missing or shorter than 32 chars.');
  console.error('[auth] Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
  process.exit(1);
}

const PANEL_USER = process.env.PANEL_USER;
const PANEL_PASS = process.env.PANEL_PASS;

if (!PANEL_USER || !PANEL_PASS) {
  console.error('[auth] FATAL: PANEL_USER / PANEL_PASS must be set in .env');
  process.exit(1);
}

// Shared secret for the MahBet site → bot tracking endpoints
// (/login, /registration, /fraud). Those are called by the website, not by the
// admin panel, so they cannot carry an admin JWT.
const SITE_API_KEY = process.env.SITE_API_KEY;

if (!SITE_API_KEY) {
  console.warn('[auth] WARNING: SITE_API_KEY is not set — /login, /registration and /fraud stay open.');
  console.warn('[auth] Set SITE_API_KEY here and send it as the x-api-key header from the MahBet site to close them.');
}

// Second factor for every endpoint that pushes a Telegram message to users.
// A valid admin JWT alone must not be enough to fire a broadcast — a stolen or
// forgotten session should not be able to spam the whole user base.
const BROADCAST_PIN = process.env.BROADCAST_PIN;

if (!BROADCAST_PIN) {
  console.warn('[auth] WARNING: BROADCAST_PIN is not set — all send endpoints reject with 503.');
  console.warn('[auth] Set BROADCAST_PIN in .env to enable broadcasting.');
} else if (BROADCAST_PIN.length < 4) {
  console.error('[auth] FATAL: BROADCAST_PIN must be at least 4 characters.');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Pull the bearer token out of the request (header, legacy header, or query). */
function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();

  // Legacy header kept for the old Vue panel in /public.
  if (req.headers['x-panel-token']) return String(req.headers['x-panel-token']).trim();

  // EventSource (SSE) cannot set headers, so /trigger-stream passes ?token=.
  if (req.query && req.query.token) return String(req.query.token).trim();

  return null;
}

// ── Login ─────────────────────────────────────────────────────
function verifyCredentials(username, password) {
  // Both compares always run so the response time does not reveal which failed.
  const userOk = safeEqual(username, PANEL_USER);
  const passOk = safeEqual(password, PANEL_PASS);
  return userOk && passOk;
}

function signPanelToken(username) {
  return jwt.sign(
    { role: 'admin' },
    JWT_SECRET,
    {
      subject:   String(username),
      issuer:    JWT_ISSUER,
      audience:  JWT_AUDIENCE,
      expiresIn: JWT_EXPIRES_IN,
    }
  );
}

/**
 * Brute-force guard for /panel-login: 10 failed attempts per IP per 15 min.
 * In-memory is fine here — the panel runs as a single pm2 process.
 */
const MAX_ATTEMPTS = 10;
const WINDOW_MS    = 15 * 60 * 1000;
const attempts     = new Map(); // ip → { count, resetAt }

function loginRateLimit(req, res, next) {
  const ip  = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = attempts.get(ip);

  if (rec && now > rec.resetAt) attempts.delete(ip);

  const current = attempts.get(ip);
  if (current && current.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many login attempts. Try again later.', retryAfter });
  }

  // Let the route report the outcome so only failures count against the limit.
  res.locals.recordLoginFailure = () => {
    const existing = attempts.get(ip);
    if (existing) existing.count += 1;
    else attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  };
  res.locals.clearLoginFailures = () => attempts.delete(ip);

  next();
}

/**
 * Same guard for the broadcast PIN, but stricter — a PIN is short enough to
 * brute-force, so 5 wrong tries per IP per 15 min.
 */
const PIN_MAX_ATTEMPTS = 5;
const PIN_WINDOW_MS    = 15 * 60 * 1000;
const pinAttempts      = new Map(); // ip → { count, resetAt }

// Keep the maps from growing unbounded on a long-running process.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of attempts) {
    if (now > rec.resetAt) attempts.delete(ip);
  }
  for (const [ip, rec] of pinAttempts) {
    if (now > rec.resetAt) pinAttempts.delete(ip);
  }
}, WINDOW_MS);
sweep.unref();

// ── Middlewares ───────────────────────────────────────────────
/** Requires a valid admin-panel JWT. Attaches the payload as req.admin. */
function panelAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', code: 'no_token' });
  }

  try {
    req.admin = jwt.verify(token, JWT_SECRET, {
      issuer:     JWT_ISSUER,
      audience:   JWT_AUDIENCE,
      algorithms: ['HS256'],
    });
    return next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'token_expired' : 'invalid_token';
    return res.status(401).json({ error: 'Unauthorized', code });
  }
}

/**
 * Requires the broadcast PIN on top of a valid admin JWT. Mount it AFTER
 * panelAuth. The PIN comes from body.pin or the x-broadcast-pin header, and is
 * stripped from the body so it never reaches a caption, a log line or the DB.
 *
 * Fails closed: with no BROADCAST_PIN configured nothing can be sent.
 */
function requireBroadcastPin(req, res, next) {
  if (!BROADCAST_PIN) {
    return res.status(503).json({
      error: 'Sending is disabled — BROADCAST_PIN is not configured on the server.',
      code:  'pin_not_configured',
    });
  }

  const ip  = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();

  const stale = pinAttempts.get(ip);
  if (stale && now > stale.resetAt) pinAttempts.delete(ip);

  const current = pinAttempts.get(ip);
  if (current && current.count >= PIN_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many wrong PIN attempts. Try again later.',
      code:  'pin_locked',
      retryAfter,
    });
  }

  const pin = req.body?.pin ?? req.headers['x-broadcast-pin'];
  if (!pin) {
    return res.status(401).json({ error: 'PIN required', code: 'pin_required' });
  }

  if (!safeEqual(pin, BROADCAST_PIN)) {
    const existing = pinAttempts.get(ip);
    if (existing) existing.count += 1;
    else pinAttempts.set(ip, { count: 1, resetAt: now + PIN_WINDOW_MS });

    const used = pinAttempts.get(ip).count;
    return res.status(401).json({
      error:        'Invalid PIN',
      code:         'pin_invalid',
      attemptsLeft: Math.max(PIN_MAX_ATTEMPTS - used, 0),
    });
  }

  pinAttempts.delete(ip);
  if (req.body && typeof req.body === 'object') delete req.body.pin;
  return next();
}

/** Requires the shared site key. No-op while SITE_API_KEY is unset. */
function siteAuth(req, res, next) {
  if (!SITE_API_KEY) return next();

  const key = req.headers['x-api-key'];
  if (key && safeEqual(key, SITE_API_KEY)) return next();

  return res.status(401).json({ error: 'Unauthorized' });
}

/**
 * CORS options that only let the admin panel origins talk to this API.
 * PANEL_ORIGINS is a comma-separated list, e.g.
 *   PANEL_ORIGINS=https://panel.mahbet.com,http://localhost:3001
 */
const allowedOrigins = (process.env.PANEL_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

if (!allowedOrigins.length) {
  console.warn('[auth] WARNING: PANEL_ORIGINS is not set — CORS is open to every origin.');
}

const corsOptions = {
  origin(origin, callback) {
    // No Origin header = server-to-server / curl / the Telegram webhook. CORS
    // is a browser rule, so those are gated by the JWT check instead.
    if (!origin) return callback(null, true);
    if (!allowedOrigins.length) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-panel-token', 'x-api-key'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

module.exports = {
  panelAuth,
  requireBroadcastPin,
  siteAuth,
  corsOptions,
  loginRateLimit,
  signPanelToken,
  verifyCredentials,
  JWT_EXPIRES_IN,
};
