import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config.js';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", ...(config.analytics ? [config.analytics.origin] : [])],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", ...(config.analytics ? config.analytics.connect : [])],
      frameSrc: ['https://www.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      ...(config.isProd ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  strictTransportSecurity: config.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: false } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  crossOriginEmbedderPolicy: false, // Google Maps iframe needs this off
  xFrameOptions: { action: 'deny' },
});

export function extraHeaders(req, res, next) {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  res.removeHeader('X-Powered-By');
  next();
}

// Reject cross-site form posts / fetches. SameSite cookies are the primary defence; this is the second layer.
export function sameOriginOnly(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch { /* invalid */ }
    if (host !== req.get('host')) return res.status(403).json({ error: 'Cross-site request blocked.' });
  } else if (req.get('sec-fetch-site') && !['same-origin', 'none'].includes(req.get('sec-fetch-site'))) {
    return res.status(403).json({ error: 'Cross-site request blocked.' });
  }
  next();
}

const make = (windowMs, limit, message) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  handler: (req, res) => {
    const wantsJson = req.originalUrl.startsWith('/api/') || req.get('accept')?.includes('json');
    res.status(429);
    return wantsJson ? res.json({ error: message }) : res.type('text').send(message);
  },
});

export const limits = {
  global: make(60_000, 300, 'Too many requests. Please slow down and try again shortly.'),
  login: make(15 * 60_000, config.isTest ? 1000 : 10, 'Too many login attempts. Try again in 15 minutes.'),
  enquiry: make(60 * 60_000, 6, 'You have sent several enquiries recently. Please message us on WhatsApp instead.'),
  admin: make(5 * 60_000, 600, 'Too many admin requests. Please wait a moment.'),
  track: make(60_000, 90, 'Too many requests.'),
  upload: make(10 * 60_000, 60, 'Too many uploads. Please wait a few minutes.'),
};
