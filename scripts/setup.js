// Creates a .env with fresh random secrets. Usage: npm run setup [-- --email you@shop.com --url https://yourdomain.com --production]
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };

if (fs.existsSync(envPath) && !process.argv.includes('--force')) {
  console.log('.env already exists. Nothing changed. (Use --force to overwrite and rotate all secrets.)');
  process.exit(0);
}
const pick = (set, n) => Array.from(crypto.randomBytes(n), (b) => set[b % set.length]).join('');
const password = pick('ABCDEFGHJKLMNPQRSTUVWXYZ', 4) + pick('abcdefghijkmnopqrstuvwxyz', 6) + pick('23456789', 4) + pick('abcdefghijkmnopqrstuvwxyz', 4) + pick('ABCDEFGHJKLMNPQRSTUVWXYZ', 2);
const shuffled = Array.from(password).sort(() => crypto.randomInt(3) - 1).join("");
const email = arg('email') || 'owner@example.com';
const url = (arg('url') || 'http://localhost:3000').replace(/\/+$/, '');
const prod = process.argv.includes('--production');

let env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const set = (k, v) => { env = env.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`); };
set('NODE_ENV', prod ? 'production' : 'development');
set('SITE_URL', url);
set('SESSION_SECRET', crypto.randomBytes(48).toString('base64url'));
set('ADMIN_EMAIL', email);
set('ADMIN_PASSWORD', shuffled);
fs.writeFileSync(envPath, env, { mode: 0o600 });

console.log(`
.env created (permissions 600).

  CMS login:   ${url}/admin
  Email:       ${email}
  Password:    ${shuffled}

Save this password now. It is hashed on first start and you can then delete ADMIN_PASSWORD from .env.
Change it from CMS > Account after signing in.${prod ? '' : '\nOn your live server set NODE_ENV=production and serve the site over HTTPS.'}
`);
