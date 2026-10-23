// Emergency: turn off two-factor for a user who lost their phone AND their recovery codes.
// Usage: npm run reset-2fa -- someone@example.com
import { db } from '../server/models/database.js';
const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) { console.error('Usage: npm run reset-2fa -- user@example.com'); process.exit(1); }
const r = db.prepare(`UPDATE users SET totp_enabled = 0, totp_secret = NULL, recovery = '[]' WHERE email = ?`).run(email);
if (!r.changes) { console.error('No such user.'); process.exit(1); }
db.prepare('DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)').run(email);
console.log(`Two-factor is now off for ${email}. They can sign in with their password and set it up again.`);
