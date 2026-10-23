import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { db, audit } from '../models/database.js';
import { verifyTotp, unseal, useRecoveryCode } from '../services/totp.js';

const scrypt = promisify(crypto.scrypt);
const N = 32768, R = 8, P = 1, KEYLEN = 64;
export const COOKIE = config.isProd ? '__Host-sid' : 'sid';
const IDLE_MS = 2 * 60 * 60 * 1000;
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export async function verifyPassword(password, stored) {
  const [alg, n, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length,
    { N: +n, r: +r, p: +p, maxmem: 128 * +n * +r * 2 });
  return crypto.timingSafeEqual(actual, expected);
}
// Used so unknown e-mail addresses cost the same time as real ones.
const DUMMY_HASH = await hashPassword(crypto.randomBytes(12).toString('hex'));

export function passwordProblem(pw, email = '') {
  if (typeof pw !== 'string' || pw.length < 12) return 'Use at least 12 characters.';
  if (pw.length > 200) return 'Password is too long.';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Include both letters and numbers.';
  if (/^(.)\1+$/.test(pw)) return 'Choose a less repetitive password.';
  const lower = pw.toLowerCase();
  if (['password', 'qwerty', '123456', 'admin', 'jaipur', 'letmein'].some((w) => lower.includes(w))) return 'Avoid common words like "password" or "admin".';
  if (email && lower.includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length > 3) return 'Do not use your e-mail name in the password.';
  return null;
}

const hmac = (v) => crypto.createHmac('sha256', config.sessionSecret).update(v).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function createSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token_hash, user_id, csrf, ip, created_at, last_seen, expires_at) VALUES (?,?,?,?,?,?,?)')
    .run(hmac(token), userId, csrf, req.ip, now, now, now + ABSOLUTE_MS);
  res.cookie(COOKIE, token, { httpOnly: true, secure: config.isProd, sameSite: 'strict', path: '/', maxAge: ABSOLUTE_MS });
  return csrf;
}
export function destroySession(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hmac(token));
  res.clearCookie(COOKIE, { httpOnly: true, secure: config.isProd, sameSite: 'strict', path: '/' });
}
export function destroyOtherSessions(req) {
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(req.user.id, req.session.token_hash);
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token || typeof token !== 'string') return res.status(401).json({ error: 'Please sign in.' });
  const row = db.prepare(`SELECT s.*, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(hmac(token));
  const now = Date.now();
  if (!row || row.expires_at < now || now - row.last_seen > IDLE_MS) {
    if (row) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
  if (!['GET', 'HEAD'].includes(req.method) && !safeEqual(req.get('x-csrf-token') || '', row.csrf)) {
    return res.status(403).json({ error: 'Security token missing. Refresh the page and try again.' });
  }
  if (now - row.last_seen > 60_000) db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(now, row.token_hash);
  req.session = row;
  req.user = { id: row.user_id, email: row.email, role: row.role };
  res.setHeader('Cache-Control', 'no-store');
  next();
}

export function requireOwner(req, res, next) {
  if (req.user?.role !== 'owner') return res.status(403).json({ error: 'Only the owner account can do this.' });
  next();
}

// Short-lived signed ticket handed out after a correct password when two-factor is on.
export function makeTicket(userId) {
  const body = Buffer.from(JSON.stringify({ u: userId, e: Date.now() + 5 * 60_000, n: crypto.randomBytes(6).toString('hex') })).toString('base64url');
  return `${body}.${hmac('ticket|' + body)}`;
}
export function readTicket(t) {
  const [body, sig] = String(t || '').split('.');
  if (!body || !sig || !safeEqual(sig, hmac('ticket|' + body))) return null;
  try { const d = JSON.parse(Buffer.from(body, 'base64url').toString()); return d.e > Date.now() ? d.u : null; } catch { return null; }
}

// Checks an authenticator code or a recovery code. Throttled like passwords.
export function checkSecondFactor(req, user, code) {
  const key = `2fa|${req.ip}|${user.id}`;
  const fails = db.prepare('SELECT COUNT(*) c FROM login_attempts WHERE key = ? AND at > ?').get(key, Date.now() - LOCK_MS).c;
  if (fails >= MAX_FAILS) return { locked: true };
  const secret = user.totp_secret ? unseal(user.totp_secret) : null;
  if (secret) {
    const step = verifyTotp(secret, code, user.totp_last_step);
    if (step) { db.prepare('UPDATE users SET totp_last_step = ? WHERE id = ?').run(step, user.id); db.prepare('DELETE FROM login_attempts WHERE key = ?').run(key); return { ok: true }; }
  }
  const left = useRecoveryCode(JSON.parse(user.recovery || '[]'), code);
  if (left) { db.prepare('UPDATE users SET recovery = ? WHERE id = ?').run(JSON.stringify(left), user.id); db.prepare('DELETE FROM login_attempts WHERE key = ?').run(key); audit(req, 'recovery_code_used', user.email); return { ok: true, recoveryLeft: left.length }; }
  db.prepare('INSERT INTO login_attempts (key, at) VALUES (?, ?)').run(key, Date.now());
  audit(req, '2fa_failed', user.email);
  return { ok: false };
}

export async function attemptLogin(req, email, password) {
  const key = `${req.ip}|${String(email).toLowerCase()}`;
  const since = Date.now() - LOCK_MS;
  const fails = db.prepare('SELECT COUNT(*) c FROM login_attempts WHERE key = ? AND at > ?').get(key, since).c;
  if (fails >= MAX_FAILS) return { locked: true };
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    db.prepare('INSERT INTO login_attempts (key, at) VALUES (?, ?)').run(key, Date.now());
    audit(req, 'login_failed', email);
    return { ok: false };
  }
  db.prepare('DELETE FROM login_attempts WHERE key = ?').run(key);
  return { ok: true, user };
}

export async function ensureAdmin() {
  const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (count > 0) return;
  if (!config.adminEmail || !config.adminPassword) {
    console.warn('\n[setup] No admin account exists. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, or run `npm run create-admin`.\n');
    return;
  }
  const problem = passwordProblem(config.adminPassword, config.adminEmail);
  if (problem) { console.error(`[setup] ADMIN_PASSWORD rejected: ${problem}`); process.exit(1); }
  db.prepare(`INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'owner')`).run(config.adminEmail, await hashPassword(config.adminPassword));
  console.log(`[setup] Admin account created for ${config.adminEmail}. You can now remove ADMIN_PASSWORD from .env.`);
}

setInterval(() => {
  const now = Date.now();
  db.prepare('DELETE FROM sessions WHERE expires_at < ? OR last_seen < ?').run(now, now - IDLE_MS);
  db.prepare('DELETE FROM login_attempts WHERE at < ?').run(now - LOCK_MS);
}, 60 * 60 * 1000).unref();
