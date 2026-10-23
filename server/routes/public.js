import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../models/database.js';
import { waLink } from '../views/render.js';
import * as P from '../views/pages.js';
import { searchProducts, getProductBySlug, featuredProducts, relatedProducts, listCategories, countView, countEnquiryClick } from '../models/products.js';
import { COOKIE } from '../middleware/authentication.js';
import * as catalogue from '../services/catalogue.js';
import { limits } from '../middleware/security.js';
import { notifyEnquiry, sendCatalogueEmail } from '../services/mailer.js';
import { getSiteContent as site, renderPublicPage as page } from '../controllers/public-controller.js';

export const pub = Router();
export const trackRouter = Router();
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|monitor|uptime|curl|wget|python|node-fetch|axios/i;

pub.get('/', (req, res) => {
  const s = site();
  page(req, res, {}, P.homePage({ site: s, categories: listCategories({ homeOnly: true }), featured: featuredProducts(8) }));
});

pub.get('/products', (req, res) => {
  const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const query = { q: str(req.query.q, 80), category: str(req.query.category, 80).replace(/[^a-z0-9-]/g, ''),
    sort: ['recommended', 'newest', 'name'].includes(req.query.sort) ? req.query.sort : 'recommended' };
  const page_ = Math.max(1, parseInt(req.query.page, 10) || 1);
  const result = searchProducts({ ...query, page: page_ });
  const categories = listCategories();
  const cat = categories.find((c) => c.slug === query.category);
  const s = site();
  page(req, res, { title: cat ? cat.name : 'Wholesale Jaipuri kurti collection',
    description: cat ? `${cat.name} wholesale designs from ${s.brand.name} ${s.brand.byline}, Jaipur. ${cat.tagline}` : undefined,
    noindex: !!(query.q || page_ > 1) },
  P.productsPage({ site: s, result, categories, query }));
});

pub.get('/products/:slug', (req, res, next) => {
  const p = getProductBySlug(String(req.params.slug));
  if (!p) return next();
  const ua = req.get('user-agent') || '';
  if (ua && !BOT.test(ua) && !req.cookies?.[COOKIE] && !req.get('sec-purpose') && !req.get('purpose')) countView(p.id);
  const s = site();
  const abs = (u) => (u.startsWith('http') ? u : config.siteUrl + u);
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.code,
    description: p.description || `${p.name}, wholesale Jaipuri kurti`, image: p.images.map(abs),
    brand: { '@type': 'Brand', name: s.brand.name }, material: p.fabric || undefined,
    category: p.categories.map((c) => c.name).join(', ') || undefined };
  page(req, res, { title: `${p.name} (${p.code})`, image: p.images[0],
    description: `${p.name}. ${p.fabric ? p.fabric + '. ' : ''}Wholesale from ${s.brand.name} ${s.brand.byline}, Jaipur.`.slice(0, 200), jsonLd },
  P.productPage({ site: s, p, related: relatedProducts(p) }));
});

pub.get('/categories', (req, res) => page(req, res, { title: 'Wholesale kurti categories' }, P.categoriesPage({ site: site(), categories: listCategories() })));
pub.get('/about', (req, res) => page(req, res, { title: 'About us' }, P.aboutPage({ site: site() })));
pub.get('/privacy', (req, res) => { const s = site(); page(req, res, { title: 'Privacy policy' }, P.legalPage({ site: s, title: 'Privacy policy', text: s.legal.privacy })); });
pub.get('/terms', (req, res) => { const s = site(); page(req, res, { title: 'Terms of use' }, P.legalPage({ site: s, title: 'Terms of use', text: s.legal.terms })); });
pub.get('/contact', (req, res) => page(req, res, { title: 'Contact and factory visit' }, P.contactPage({ site: site() })));

// ---------------- enquiries ----------------
const clean = (max, min = 0) => z.string().transform((s) => s.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()).pipe(z.string().min(min).max(max));
const opt = (schema) => z.preprocess((v) => v ?? '', schema);
const enquirySchema = z.object({
  name: clean(80, 2), shop: clean(100, 2), city: clean(100, 2),
  phone: opt(clean(20).refine((v) => v === '' || /^[+\d][\d\s-]{6,18}$/.test(v), 'Enter a valid phone number')),
  buyer_type: opt(clean(60)), requirement: clean(1000, 5), product_code: opt(clean(40)),
  website: z.string().max(200).optional(),
});

pub.post('/enquiry', limits.enquiry, async (req, res) => {
  const wantsJson = req.get('accept')?.includes('application/json');
  const parsed = enquirySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.path.join('') === 'phone' ? 'Please enter a valid phone number.' : 'Please fill in your name, shop, city and requirement.';
    return wantsJson ? res.status(400).json({ error: msg }) : page(req, res, { title: 'Check your details', status: 400, noindex: true }, P.formErrorPage(msg));
  }
  const e = parsed.data;
  const { brand } = site();
  const msg = `Hello ${brand.name} ${brand.byline}, I am ${e.name} from ${e.shop}, ${e.city}.${e.buyer_type ? ` Buyer type: ${e.buyer_type}.` : ''}${e.product_code ? ` Design: ${e.product_code}.` : ''} Requirement: ${e.requirement}`;
  const waUrl = waLink(brand, msg.slice(0, 900));
  if (e.website) return wantsJson ? res.json({ ok: true, whatsapp: waUrl }) : res.redirect(303, '/'); // honeypot: pretend success
  if (e.product_code && !db.prepare('SELECT 1 FROM products WHERE code = ? AND deleted_at IS NULL').get(e.product_code)) e.product_code = '';
  db.prepare('INSERT INTO enquiries (name, shop, city, phone, buyer_type, requirement, product_code) VALUES (?,?,?,?,?,?,?)')
    .run(e.name, e.shop, e.city, e.phone, e.buyer_type, e.requirement, e.product_code);
  notifyEnquiry(e);
  if (wantsJson) return res.json({ ok: true, whatsapp: waUrl });
  return page(req, res, { title: 'Thank you', noindex: true }, P.thanksPage({ site: site(), waUrl }));
});

// ---------------- SEO / ops ----------------
pub.get('/robots.txt', (req, res) => res.type('text').send(
  `User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /enquiry\nDisallow: /catalogue/\nSitemap: ${config.siteUrl}/sitemap.xml\n`));

pub.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/products', '/categories', '/catalogue', '/about', '/contact', '/privacy', '/terms'];
  for (const c of listCategories()) urls.push(`/products?category=${c.slug}`);
  const prods = db.prepare(`SELECT slug, updated_at FROM products WHERE status = 'published' AND deleted_at IS NULL`).all();
  const x = (s) => s.replace(/&/g, '&amp;');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `<url><loc>${x(config.siteUrl + u)}</loc></url>`).join('\n') + '\n' +
    prods.map((p) => `<url><loc>${x(config.siteUrl)}/products/${p.slug}</loc><lastmod>${p.updated_at.slice(0, 10)}</lastmod></url>`).join('\n') +
    '\n</urlset>');
});

pub.get('/healthz', (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { db.prepare('SELECT 1').get(); res.json({ ok: true, uptime: Math.round(process.uptime()) }); }
  catch { res.status(503).json({ ok: false }); }
});

// ---------------- catalogue ----------------
const CATALOGUE_HEADERS = { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="wholesale-catalogue.pdf"', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' };

pub.get('/catalogue', (req, res) => page(req, res, { title: 'Wholesale catalogue PDF' }, P.cataloguePage({ site: site(), status: catalogue.status() })));

pub.get('/catalogue.pdf', async (req, res) => {
  if (site().catalogue.requireDetails) return res.redirect(302, '/catalogue');
  const { file } = await catalogue.pdfFile();
  res.sendFile(file, { headers: CATALOGUE_HEADERS });
});
pub.get('/catalogue/download', async (req, res) => {
  if (!catalogue.checkToken(req.query.t)) return res.redirect(302, '/catalogue');
  const { file } = await catalogue.pdfFile();
  res.sendFile(file, { headers: CATALOGUE_HEADERS });
});

const catalogueSchema = z.object({
  name: clean(80, 2), shop: clean(100, 2), city: clean(100, 2), phone: opt(clean(20).refine((v) => v === '' || /^[+\d][\d\s-]{6,18}$/.test(v), 'Enter a valid phone number')),
  email: opt(clean(120).refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email')), buyer_type: opt(clean(60)),
  website: z.string().max(200).optional(),
}).refine((d) => d.phone || d.email, { message: 'Add a phone number or an email address.', path: ['phone'] });

pub.post('/catalogue/request', limits.enquiry, async (req, res) => {
  const wantsJson = req.get('accept')?.includes('application/json');
  const parsed = catalogueSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || 'Please check your details.';
    return wantsJson ? res.status(400).json({ error: msg }) : page(req, res, { title: 'Check your details', status: 400, noindex: true }, P.formErrorPage(msg));
  }
  const e = parsed.data;
  const s = site();
  const waUrl = waLink(s.brand, `Hello ${s.brand.name} ${s.brand.byline}, I am ${e.name} from ${e.shop}, ${e.city}. I downloaded your catalogue. Please share wholesale rates and minimum orders.`);
  if (e.website) return wantsJson ? res.json({ ok: true, download: '/catalogue', whatsapp: waUrl }) : res.redirect(303, '/catalogue');
  db.prepare(`INSERT INTO enquiries (name, shop, city, phone, email, buyer_type, requirement, source) VALUES (?,?,?,?,?,?,?,'catalogue')`)
    .run(e.name, e.shop, e.city, e.phone, e.email, e.buyer_type, 'Catalogue request');
  notifyEnquiry({ ...e, requirement: 'Catalogue request', source: 'catalogue' });
  const download = `/catalogue/download?t=${catalogue.makeToken()}`;
  const emailed = !!(e.email && config.smtp);
  catalogue.pdfFile().then(({ file }) => { if (emailed) return sendCatalogueEmail({ to: e.email, name: e.name, brandName: `${s.brand.name} ${s.brand.byline}`, file }); }).catch((err) => console.error('[catalogue]', err.message));
  if (wantsJson) return res.json({ ok: true, download, whatsapp: waUrl, emailed });
  return page(req, res, { title: 'Your catalogue', noindex: true }, P.catalogueThanksPage({ site: s, downloadUrl: download, waUrl, emailed }));
});

// ---------------- first-party click counter ----------------
trackRouter.post('/', limits.track, (req, res) => {
  const slug = typeof req.body?.p === 'string' ? req.body.p.slice(0, 120) : '';
  if (/^[a-z0-9-]+$/.test(slug) && !req.cookies?.[COOKIE]) {
    const row = db.prepare('SELECT id FROM products WHERE slug = ? AND deleted_at IS NULL').get(slug);
    if (row) countEnquiryClick(row.id);
  }
  res.status(204).end();
});
