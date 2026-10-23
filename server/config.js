import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SITE_URL: z.string().url().default('http://localhost:3000'),
  TRUST_PROXY: z.string().default('0'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters. Run `npm run setup`.'),
  ADMIN_EMAIL: z.string().email().optional().or(z.literal('')),
  ADMIN_PASSWORD: z.string().optional(),
  DATA_DIR: z.string().default('./data'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  NOTIFY_EMAIL: z.string().optional(),
  ANALYTICS_PROVIDER: z.enum(['', 'none', 'plausible', 'umami']).default(''),
  ANALYTICS_SRC: z.string().url().optional().or(z.literal('')),
  ANALYTICS_SITE: z.string().max(200).optional(),
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  HEARTBEAT_URL: z.string().url().optional().or(z.literal('')),
  HEARTBEAT_MINUTES: z.coerce.number().int().min(1).max(60).default(5),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('\nConfiguration error:');
  for (const i of parsed.error.issues) console.error(` - ${i.path.join('.')}: ${i.message}`);
  console.error('\nRun `npm run setup` to generate a valid .env file.\n');
  process.exit(1);
}
const env = parsed.data;
const isProd = env.NODE_ENV === 'production';

if (isProd && /change|example|secret|password/i.test(env.SESSION_SECRET)) {
  console.error('SESSION_SECRET looks like a placeholder. Generate a random one with `npm run setup`.');
  process.exit(1);
}

const dataDir = path.resolve(root, env.DATA_DIR);

// Privacy-friendly analytics (cookie-less). Only the script host you configure is allowed by the CSP.
let analytics = null;
if (['plausible', 'umami'].includes(env.ANALYTICS_PROVIDER) && env.ANALYTICS_SRC && env.ANALYTICS_SITE) {
  const origin = new URL(env.ANALYTICS_SRC).origin;
  analytics = { provider: env.ANALYTICS_PROVIDER, src: env.ANALYTICS_SRC, site: env.ANALYTICS_SITE, origin,
    connect: [origin, ...(origin === 'https://cloud.umami.is' ? ['https://api-gateway.umami.is'] : [])] };
}

export const config = {
  root,
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  siteUrl: env.SITE_URL.replace(/\/+$/, ''),
  trustProxy: env.TRUST_PROXY === '0' || env.TRUST_PROXY === '' ? false : /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY === 'true' ? 1 : env.TRUST_PROXY,
  sessionSecret: env.SESSION_SECRET,
  adminEmail: env.ADMIN_EMAIL || '',
  adminPassword: env.ADMIN_PASSWORD || '',
  dataDir,
  dbPath: path.join(dataDir, 'store.db'),
  catalogueDir: dataDir,
  analytics,
  sentryDsn: env.SENTRY_DSN || '',
  heartbeatUrl: env.HEARTBEAT_URL || '',
  heartbeatMinutes: env.HEARTBEAT_MINUTES,
  uploadDir: path.join(dataDir, 'uploads'),
  publicDir: path.join(root, 'public'),
  adminDir: path.join(root, 'admin'),
  smtp: env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.NOTIFY_EMAIL
    ? { host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER, pass: env.SMTP_PASS,
        from: env.SMTP_FROM || env.SMTP_USER, to: env.NOTIFY_EMAIL }
    : null,
};
