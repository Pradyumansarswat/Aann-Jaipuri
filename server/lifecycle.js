import { config } from './config.js';
import { Sentry, sentryEnabled } from './services/sentry.js';
import { db } from './models/database.js';
import { purgeOld } from './controllers/trash-controller.js';

export function configureServer(server) {
  server.requestTimeout = 60_000;
  server.headersTimeout = 20_000;

  const purgeTrash = () => {
    try {
      purgeOld();
    } catch (error) {
      console.error(error);
    }
  };

  try {
    const purged = purgeOld();
    if (purged) console.log(`[trash] permanently removed ${purged} product(s) older than 30 days`);
  } catch (error) {
    console.error(error);
  }
  setInterval(purgeTrash, 6 * 60 * 60_000).unref();

  if (config.heartbeatUrl) {
    const pingHeartbeat = () => {
      fetch(config.heartbeatUrl, { signal: AbortSignal.timeout(10_000) })
        .catch((error) => console.error('[heartbeat]', error.message));
    };
    pingHeartbeat();
    setInterval(pingHeartbeat, config.heartbeatMinutes * 60_000).unref();
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      if (sentryEnabled) await Sentry.close(2000);
      server.close(() => {
        db.close();
        process.exit(0);
      });
    });
  }
}
