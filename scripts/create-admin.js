// Add or reset an admin user: npm run create-admin
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { db } from '../server/models/database.js';
import { hashPassword, passwordProblem } from '../server/middleware/authentication.js';

let muted = false;
const out = new Writable({ write(chunk, enc, cb) { if (!muted) process.stdout.write(chunk, enc); cb(); } });
const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });

const email = (await rl.question('Admin email: ')).trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error('Invalid email.'); process.exit(1); }
muted = true; process.stdout.write('New password (min 12 chars, letters and numbers): ');
const pw = await rl.question(''); muted = false; console.log();
rl.close();
const problem = passwordProblem(pw, email);
if (problem) { console.error(problem); process.exit(1); }
const hash = await hashPassword(pw);
db.prepare(`INSERT INTO users (email, password_hash) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash`).run(email, hash);
db.prepare('DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)').run(email);
console.log(`Admin ${email} saved. All previous sessions for this user were signed out.`);
