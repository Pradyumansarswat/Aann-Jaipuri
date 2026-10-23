// Time-based one-time passwords (RFC 6238) using only Node's crypto: works with Google Authenticator, Microsoft Authenticator, Authy, 1Password.
import crypto from 'node:crypto';
import { config } from '../config.js';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf) {
  let bits = '', out = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}
const unbase32 = (s) => {
  let bits = '';
  for (const c of s.replace(/=+$/, '')) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  return Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
};

export const newSecret = () => base32(crypto.randomBytes(20));

function hotp(secret, counter) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', unbase32(secret)).update(msg).digest();
  const o = h[19] & 0xf;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, '0');
}
export const stepNow = () => Math.floor(Date.now() / 30000);
export const codeAt = (secret, step = stepNow()) => hotp(secret, step);

// Returns the matched time step (so a code cannot be used twice) or null.
export function verifyTotp(secret, code, lastStep = 0) {
  const clean = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const now = stepNow();
  for (const d of [0, -1, 1]) {
    const step = now + d;
    if (step <= lastStep) continue;
    const a = Buffer.from(hotp(secret, step)), b = Buffer.from(clean);
    if (crypto.timingSafeEqual(a, b)) return step;
  }
  return null;
}

export const otpauthUri = (secret, email, issuer) =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

// Secrets are encrypted at rest with a key derived from SESSION_SECRET.
const key = crypto.createHash('sha256').update('totp|' + config.sessionSecret).digest();
export function seal(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64')).join('.');
}
export function unseal(blob) {
  try {
    const [iv, tag, ct] = blob.split('.').map((x) => Buffer.from(x, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  } catch { return null; }
}

// Recovery codes: shown once, stored only as hashes, each usable one time.
const hashCode = (c) => crypto.createHmac('sha256', config.sessionSecret).update('recovery|' + c.toLowerCase().replace(/[^a-z0-9]/g, '')).digest('hex');
export function makeRecoveryCodes(n = 8) {
  const codes = Array.from({ length: n }, () => {
    const r = crypto.randomBytes(5).toString('hex');
    return `${r.slice(0, 5)}-${r.slice(5)}`;
  });
  return { codes, hashes: codes.map(hashCode) };
}
export function useRecoveryCode(hashes, input) {
  const h = hashCode(String(input || ''));
  const i = hashes.indexOf(h);
  if (i < 0) return null;
  return hashes.filter((_, j) => j !== i);
}
