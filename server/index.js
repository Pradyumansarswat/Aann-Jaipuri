import { config } from './config.js';
import { ensureAdmin } from './middleware/authentication.js';
import { seedIfEmpty } from './services/seed.js';
import { createApp } from './app.js';
import { configureServer } from './lifecycle.js';

seedIfEmpty();
await ensureAdmin();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`\nStore running at ${config.siteUrl.startsWith('http://localhost') ? `http://localhost:${config.port}` : config.siteUrl}  (CMS: /admin)\n`);
});
configureServer(server);
