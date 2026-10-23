import { getContent } from '../services/content.js';
import { layout } from '../views/render.js';
import { notFoundPage } from '../views/pages.js';

export function getSiteContent() {
  return getContent();
}

export function renderPublicPage(req, res, options, body) {
  const html = layout({
    site: getSiteContent(),
    req,
    path: req.path,
    ...options,
    body,
  });
  return res.status(options.status === undefined ? 200 : options.status).type('html').send(html);
}

export function renderNotFound(req, res) {
  return res.status(404).type('html').send(layout({
    site: getSiteContent(),
    req,
    path: req.path,
    title: 'Page not found',
    noindex: true,
    body: notFoundPage(),
  }));
}
