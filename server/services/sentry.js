// Error tracking. Off unless SENTRY_DSN is set. The DSN stays on the server.
import * as Sentry from '@sentry/node';
import { config } from '../config.js';
import fs from 'node:fs';

export const sentryEnabled = !!config.sentryDsn;
if (sentryEnabled) {
  const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.isProd ? 'production' : 'development',
    release: `${pkg.name}@${pkg.version}`,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Never ship visitor data (enquiry text, names, cookies, login details) to a third party.
    beforeSend(event) {
      if (event.request) { delete event.request.data; delete event.request.cookies; delete event.request.headers; delete event.request.query_string; }
      delete event.user;
      return event;
    },
  });
}
export { Sentry };
