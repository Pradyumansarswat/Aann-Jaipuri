import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { config } from './config.js';
import { Sentry, sentryEnabled } from './services/sentry.js';
import { securityHeaders, extraHeaders, sameOriginOnly, limits } from './middleware/security.js';
import { pub, trackRouter } from './routes/public.js';
import { admin } from './routes/admin.js';
import { errorHandler } from './middleware/error-handler.js';
import { renderNotFound } from './controllers/public-controller.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('etag', 'strong');

  app.use(securityHeaders);
  app.use(extraHeaders);
  app.use(compression());
  app.use(limits.global);
  app.use(cookieParser());
  app.use(express.json({ limit: '300kb' }));
  app.use(express.urlencoded({ extended: false, limit: '50kb', parameterLimit: 30 }));
  app.use(sameOriginOnly);

  const staticOpts = { dotfiles: 'ignore', index: false, fallthrough: true };
  app.use('/assets', express.static(path.join(config.publicDir, 'assets'), { ...staticOpts, maxAge: '7d' }));
  app.use('/uploads', express.static(config.uploadDir, {
    ...staticOpts,
    maxAge: '365d',
    immutable: true,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  }));

  app.use('/api/admin', admin);
  app.use('/api/t', trackRouter);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  const adminPage = (file) => (req, res) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    res.sendFile(path.join(config.adminDir, file));
  };
  app.get(['/admin', '/admin/'], adminPage('index.html'));
  app.get('/admin/admin.css', adminPage('admin.css'));
  app.get('/admin/admin.js', adminPage('admin.js'));
  app.use('/admin', express.static(config.adminDir, {
    dotfiles: 'ignore',
    index: false,
    fallthrough: true,
    setHeaders: (res) => {
      res.set({
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
      });
    },
  }));

  app.use(pub);

  app.use(renderNotFound);

  if (sentryEnabled) Sentry.setupExpressErrorHandler(app);

  app.use(errorHandler);

  return app;
}
