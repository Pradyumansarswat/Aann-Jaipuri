import { db } from '../../models/database.js';
import { config } from '../../config.js';
import { DEFAULTS, getContent } from '../../services/content.js';
import { topDesigns } from '../../models/products.js';

export function registerDashboardRoutes(admin) {
  // ---------------- dashboard ----------------
  admin.get('/stats', (req, res) => {
    const one = (sql) => db.prepare(sql).get().c;
    const brand = getContent().brand;
    const me = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const live = `status='published' AND deleted_at IS NULL`;
    const warnings = [];
    if (brand.whatsapp === DEFAULTS.brand.whatsapp) warnings.push({ text: 'Your WhatsApp number is still the sample number. Visitors cannot reach you until you change it.', section: 'brand' });
    if (!one(`SELECT COUNT(*) c FROM products WHERE ${live}`)) warnings.push({ text: 'No published products yet. Add your first design.', section: 'products' });
    const setup = [
      { label: 'Real WhatsApp number set', ok: brand.whatsapp !== DEFAULTS.brand.whatsapp, hint: 'Brand and contact' },
      { label: 'Two-factor sign-in on for you', ok: !!me.totp_enabled, hint: 'Password and security' },
      { label: 'A second admin user added', ok: one('SELECT COUNT(*) c FROM users') > 1, hint: 'Users', ownerOnly: true },
      { label: 'GST number added (if you want it shown)', ok: !!getContent().legal.gstin, hint: 'Legal pages and GST' },
      { label: 'Site is running in production mode', ok: config.isProd, hint: 'NODE_ENV=production in .env' },
      { label: 'Email alerts for new enquiries', ok: !!config.smtp, hint: 'SMTP settings in .env' },
      { label: 'Visitor analytics (Plausible or Umami)', ok: !!config.analytics, hint: 'ANALYTICS_* in .env' },
      { label: 'Error tracking (Sentry)', ok: !!config.sentryDsn, hint: 'SENTRY_DSN in .env' },
      { label: 'Uptime heartbeat configured', ok: !!config.heartbeatUrl, hint: 'HEARTBEAT_URL in .env, plus a monitor on /healthz' },
    ];
    res.json({
      products: one(`SELECT COUNT(*) c FROM products WHERE ${live}`), drafts: one(`SELECT COUNT(*) c FROM products WHERE status='draft' AND deleted_at IS NULL`),
      trash: one('SELECT COUNT(*) c FROM products WHERE deleted_at IS NOT NULL'),
      categories: one('SELECT COUNT(*) c FROM categories'), newEnquiries: one(`SELECT COUNT(*) c FROM enquiries WHERE status='new'`),
      enquiries: one('SELECT COUNT(*) c FROM enquiries'),
      recent: db.prepare('SELECT * FROM enquiries ORDER BY id DESC LIMIT 5').all(), warnings, setup, popular: topDesigns(30, 8),
      analyticsProvider: config.analytics?.provider || null,
      audit: db.prepare('SELECT at, user_email, action, detail FROM audit_log ORDER BY id DESC LIMIT 15').all(),
    });
  });
}
