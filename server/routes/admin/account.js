import QRCode from 'qrcode';
import { z } from 'zod';
import { db, audit } from '../../models/database.js';
import { limits } from '../../middleware/security.js';
import { attemptLogin, createSession, destroySession, destroyOtherSessions, requireOwner, makeTicket, readTicket, checkSecondFactor, hashPassword, verifyPassword, passwordProblem } from '../../middleware/authentication.js';
import { newSecret, seal, unseal, verifyTotp, otpauthUri, makeRecoveryCodes } from '../../services/totp.js';
import { getContent } from '../../services/content.js';
import { fail, validateBody, validateId } from '../../middleware/request-validation.js';

const publicUser = (u) => ({ email: u.email, role: u.role, totp: !!u.totp_enabled });
function startSession(req, res, u, extra = {}) {
  const csrf = createSession(req, res, u.id);
  req.user = { email: u.email };
  audit(req, 'login');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user: publicUser(u), csrf, ...extra });
}

export function registerLoginRoutes(admin) {
  admin.post('/login', limits.login, validateBody(z.object({ email: z.string().trim().max(200), password: z.string().max(200) })), async (req, res) => {
    const r = await attemptLogin(req, req.data.email, req.data.password);
    if (r.locked) return fail(res, 429, 'Too many failed attempts. Try again in 15 minutes.');
    if (!r.ok) return fail(res, 401, 'Incorrect email or password.');
    if (r.user.totp_enabled) return res.json({ needs2fa: true, ticket: makeTicket(r.user.id) });
    startSession(req, res, r.user);
  });
  admin.post('/login/2fa', limits.login, validateBody(z.object({ ticket: z.string().max(400), code: z.string().trim().max(40) })), (req, res) => {
    const uid = readTicket(req.data.ticket);
    const u = uid && db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    if (!u) return fail(res, 401, 'That sign-in expired. Start again.');
    const c = checkSecondFactor(req, u, req.data.code);
    if (c.locked) return fail(res, 429, 'Too many wrong codes. Try again in 15 minutes.');
    if (!c.ok) return fail(res, 401, 'That code is not right. Try the newest code from your app.');
    startSession(req, res, u, c.recoveryLeft !== undefined ? { recoveryLeft: c.recoveryLeft } : {});
  });
}

export function registerAccountRoutes(admin) {
  admin.get('/me', (req, res) => res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)), csrf: req.session.csrf }));
  admin.post('/logout', (req, res) => { audit(req, 'logout'); destroySession(req, res); res.json({ ok: true }); });
  
  admin.post('/password', limits.login, validateBody(z.object({ current: z.string().max(200), next: z.string().max(200) })), async (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!(await verifyPassword(req.data.current, u.password_hash))) return fail(res, 400, 'Current password is incorrect.');
    const problem = passwordProblem(req.data.next, u.email);
    if (problem) return fail(res, 400, problem);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(req.data.next), u.id);
    destroyOtherSessions(req);
    audit(req, 'password_changed');
    res.json({ ok: true });
  });
  
  // ---------------- two-factor (each person for their own account) ----------------
  const needPassword = async (req, res, password) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!(await verifyPassword(password, u.password_hash))) { fail(res, 400, 'Your password is not correct.'); return null; }
    return u;
  };
  admin.post('/2fa/setup', limits.login, validateBody(z.object({ password: z.string().max(200) })), async (req, res) => {
    const u = await needPassword(req, res, req.data.password);
    if (!u) return;
    if (u.totp_enabled) return fail(res, 400, 'Two-factor sign-in is already on.');
    const secret = newSecret();
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(seal(secret), u.id);
    const uri = otpauthUri(secret, u.email, getContent().brand.name + ' site manager');
    const svg = await QRCode.toString(uri, { type: 'svg', margin: 1, width: 220, errorCorrectionLevel: 'M' });
    res.json({ secret, qr: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') });
  });
  admin.post('/2fa/enable', limits.login, validateBody(z.object({ code: z.string().trim().max(12) })), (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const secret = u.totp_secret && unseal(u.totp_secret);
    if (!secret || u.totp_enabled) return fail(res, 400, 'Start the setup again.');
    const step = verifyTotp(secret, req.data.code, 0);
    if (!step) return fail(res, 400, 'That code is not right. Check the time on your phone and try the newest code.');
    const { codes, hashes } = makeRecoveryCodes();
    db.prepare('UPDATE users SET totp_enabled = 1, totp_last_step = ?, recovery = ? WHERE id = ?').run(step, JSON.stringify(hashes), u.id);
    destroyOtherSessions(req);
    audit(req, '2fa_enabled');
    res.json({ recoveryCodes: codes });
  });
  admin.post('/2fa/disable', limits.login, validateBody(z.object({ password: z.string().max(200), code: z.string().trim().max(40) })), async (req, res) => {
    const u = await needPassword(req, res, req.data.password);
    if (!u) return;
    const c = checkSecondFactor(req, u, req.data.code);
    if (c.locked) return fail(res, 429, 'Too many wrong codes. Try again in 15 minutes.');
    if (!c.ok) return fail(res, 400, 'That code is not right.');
    db.prepare(`UPDATE users SET totp_enabled = 0, totp_secret = NULL, recovery = '[]' WHERE id = ?`).run(u.id);
    audit(req, '2fa_disabled');
    res.json({ ok: true });
  });
}

export function registerUserRoutes(admin) {
  // ---------------- users (owner only) ----------------
  const ownerCount = () => db.prepare(`SELECT COUNT(*) c FROM users WHERE role = 'owner'`).get().c;
  admin.get('/users', requireOwner, (req, res) => res.json({ users: db.prepare('SELECT id, email, role, totp_enabled, created_at FROM users ORDER BY id').all().map((u) => ({ ...u, totp_enabled: !!u.totp_enabled, you: u.id === req.user.id })) }));
  admin.post('/users', requireOwner, validateBody(z.object({ email: z.email().max(200), password: z.string().max(200), role: z.enum(['owner', 'editor']) }).strict()), async (req, res) => {
    const email = req.data.email.toLowerCase();
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return fail(res, 409, 'There is already a user with that email.');
    const problem = passwordProblem(req.data.password, email);
    if (problem) return fail(res, 400, problem);
    const info = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)').run(email, await hashPassword(req.data.password), req.data.role);
    audit(req, 'user_created', `${email} (${req.data.role})`);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });
  admin.patch('/users/:id', requireOwner, validateId, validateBody(z.object({ role: z.enum(['owner', 'editor']), password: z.string().max(200) }).partial().strict()), async (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.id);
    if (!u) return fail(res, 404, 'User not found.');
    if (req.data.role && req.data.role !== u.role) {
      if (u.role === 'owner' && ownerCount() <= 1) return fail(res, 400, 'There must always be at least one owner.');
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(req.data.role, u.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    }
    if (req.data.password) {
      const problem = passwordProblem(req.data.password, u.email);
      if (problem) return fail(res, 400, problem);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(req.data.password), u.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    }
    audit(req, 'user_updated', u.email);
    res.json({ ok: true });
  });
  admin.post('/users/:id/reset-2fa', requireOwner, validateId, (req, res) => {
    const r = db.prepare(`UPDATE users SET totp_enabled = 0, totp_secret = NULL, recovery = '[]' WHERE id = ?`).run(req.id);
    if (!r.changes) return fail(res, 404, 'User not found.');
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.id);
    audit(req, 'user_2fa_reset', String(req.id));
    res.json({ ok: true });
  });
  admin.delete('/users/:id', requireOwner, validateId, (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.id);
    if (!u) return fail(res, 404, 'User not found.');
    if (u.id === req.user.id) return fail(res, 400, 'You cannot delete your own account.');
    if (u.role === 'owner' && ownerCount() <= 1) return fail(res, 400, 'There must always be at least one owner.');
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    audit(req, 'user_deleted', u.email);
    res.json({ ok: true });
  });
}
