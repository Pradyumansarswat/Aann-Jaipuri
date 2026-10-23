// End-to-end check of the storefront, CMS API and security rules. Runs against a throw-away copy of the database.
// Usage: npm test
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import { codeAt, stepNow } from '../server/services/totp.js';

const PORT = 3100 + Math.floor(Math.random() * 400);
const BASE = `http://localhost:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurti-test-'));
const EMAIL = 'tester@example.com', PASS = 'Correct7Horse9Battery';
const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, NODE_ENV: 'test', PORT: String(PORT), SITE_URL: BASE, SESSION_SECRET: crypto.randomBytes(40).toString('hex'),
    ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD: PASS, DATA_DIR: dataDir, TRUST_PROXY: '0',
    ANALYTICS_PROVIDER: 'plausible', ANALYTICS_SRC: 'https://plausible.io/js/script.js', ANALYTICS_SITE: 'example.com',
    SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0', HEARTBEAT_URL: `${BASE}/healthz` }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));

let pass = 0, failed = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { failed++; console.log(`  FAIL ${name} ${extra}`); } };
const wait = async () => { for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/healthz')).ok) return; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 250)); } throw new Error('Server did not start.\n' + log); };

let cookie = '', csrf = '';
const req = async (p, { method = 'GET', json, form, headers = {}, auth = true, raw } = {}) => {
  const h = { ...headers };
  if (auth && cookie) h.cookie = cookie;
  if (auth && csrf && method !== 'GET') h['x-csrf-token'] = csrf;
  let body;
  if (json) { h['content-type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  if (raw) { h['content-type'] = 'application/x-www-form-urlencoded'; body = raw; }
  const res = await fetch(BASE + p, { method, headers: h, body, redirect: 'manual' });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  return { res, text, data, status: res.status };
};

try {
  await wait();
  console.log('\nStorefront');
  for (const p of ['/', '/products', '/categories', '/about', '/contact']) { const r = await req(p); ok(r.status === 200 && r.text.includes('<h1'), `GET ${p} renders`); }
  const adminPage = await req('/admin');
  ok(adminPage.status === 200 && adminPage.text.includes('type="module"'), 'CMS loads its module entry point');
  const adminPages = await req('/admin/pages/index.js');
  ok(adminPages.status === 200 && adminPages.text.includes('createAdminPages'), 'CMS page modules are served');
  const adminDashboard = await req('/admin/pages/dashboard.js');
  ok(adminDashboard.status === 200 && adminDashboard.text.includes('createDashboardPages'), 'CMS screen module is served');
  const home = await req('/');
  ok(!/<script(?![^>]*\bsrc=)[^>]*>(?!\s*<)/.test(home.text.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')), 'no inline scripts (CSP-safe)');
  ok(!/\sstyle=/.test(home.text), 'no inline style attributes (CSP-safe)');
  const csp = home.res.headers.get('content-security-policy') || '';
  ok(csp.includes("script-src 'self'") && csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"), 'strict CSP header');
  ok(home.res.headers.get('x-content-type-options') === 'nosniff', 'nosniff header');
  ok(!home.res.headers.get('x-powered-by'), 'X-Powered-By hidden');
  ok((await req('/nope-page')).status === 404, '404 page');
  ok((await req('/products/does-not-exist')).status === 404, 'unknown product 404');
  const list = await req('/products?category=block-print');
  ok(list.text.includes('Sanganeri Gulab Kalidar Set'), 'category filter lists seeded product');
  ok((await req('/products?q=' + encodeURIComponent("<script>alert(1)</script>"))).text.includes('&lt;script&gt;'), 'search term is escaped');
  ok(!(await req('/products?q=%25%27%22')).text.includes('Error'), 'odd search characters are safe');
  ok((await req('/sitemap.xml')).text.includes('/products/'), 'sitemap lists products');
  ok((await req('/.env')).status === 404 && (await req('/../data/store.db')).status === 404 && (await req('/server/config.js')).status === 404, 'no source/secret files exposed');
  ok((await req('/uploads/../../etc/passwd')).status === 404, 'path traversal blocked');

  console.log('\nAuthentication and CSRF');
  ok((await req('/api/admin/products', { auth: false })).status === 401, 'admin API requires login');
  ok((await req('/api/admin/stats', { auth: false })).status === 401, 'stats requires login');
  const bad = await req('/api/admin/login', { method: 'POST', json: { email: EMAIL, password: 'wrong-password-123' }, auth: false });
  ok(bad.status === 401, 'wrong password rejected');
  const cross = await req('/api/admin/login', { method: 'POST', json: { email: EMAIL, password: PASS }, auth: false, headers: { origin: 'https://evil.example' } });
  ok(cross.status === 403, 'cross-site login request blocked');
  const login = await req('/api/admin/login', { method: 'POST', json: { email: EMAIL, password: PASS }, auth: false });
  ok(login.status === 200 && !!login.data.csrf, 'correct login works');
  const sc = login.res.headers.get('set-cookie') || '';
  ok(/HttpOnly/i.test(sc) && /SameSite=Strict/i.test(sc), 'session cookie is HttpOnly + SameSite=Strict');
  cookie = sc.split(';')[0]; csrf = login.data.csrf;
  const noCsrf = await fetch(BASE + '/api/admin/categories', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'X Test' }) });
  ok(noCsrf.status === 403, 'write without CSRF token is rejected');

  console.log('\nCategories and products');
  const cat = await req('/api/admin/categories', { method: 'POST', json: { name: 'Test Kurtis', tagline: 'Testing' } });
  ok(cat.status === 201, 'create category');
  const png = await sharp({ create: { width: 900, height: 1200, channels: 3, background: '#aa3355' } }).png().toBuffer();
  const fd = new FormData(); fd.append('files', new Blob([png], { type: 'image/png' }), 'photo.png');
  const up = await req('/api/admin/upload', { method: 'POST', form: fd });
  ok(up.status === 200 && up.data.files[0].url.endsWith('.webp'), 'image upload converted to webp');
  const imgUrl = up.data?.files?.[0]?.url;
  const served = await req(imgUrl);
  ok(served.res.headers.get('content-type')?.includes('image/webp'), 'uploaded image is served');
  const fake = new FormData(); fake.append('files', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/png' }), 'evil.png');
  ok((await req('/api/admin/upload', { method: 'POST', form: fake })).status === 400, 'fake image / SVG upload rejected');
  const php = new FormData(); php.append('files', new Blob(['<?php echo 1; ?>'], { type: 'image/jpeg' }), 'shell.php.jpg');
  ok((await req('/api/admin/upload', { method: 'POST', form: php })).status === 400, 'disguised script upload rejected');
  const prod = await req('/api/admin/products', { method: 'POST', json: { code: 'TEST-1', name: 'Test <b>Kurti</b>', description: 'Line one\n\nLine two', photos: [{ url: imgUrl, alt: 'Maroon test kurti front view' }], categories: [cat.data.id], is_new: true, status: 'published', sort: 1 } });
  ok(prod.status === 201, 'create product');
  ok((await req('/api/admin/products', { method: 'POST', json: { code: 'test-1', name: 'Dup' } })).status === 409, 'duplicate code rejected');
  ok((await req('/api/admin/products', { method: 'POST', json: { code: 'T2', name: 'Bad image', photos: [{ url: 'https://evil.example/x.png', alt: '' }] } })).status === 400, 'external image URL rejected');
  ok((await req('/api/admin/products', { method: 'POST', json: { code: 'T3', name: 'Extra', hacked: true } })).status === 400, 'unknown fields rejected');
  const page = await req('/products');
  ok(page.text.includes('Test &lt;b&gt;Kurti&lt;/b&gt;') && !page.text.includes('<b>Kurti</b>'), 'product name is HTML-escaped on the storefront');
  const pslug = (page.text.match(/href="\/products\/(test-b-kurti[^"]*)"/) || [])[1];
  ok(!!pslug && (await req('/products/' + pslug)).status === 200, 'product detail page works');
  ok((await req('/products/' + pslug)).text.includes('alt="Maroon test kurti front view"'), 'per-photo alt text is used on the product page');
  ok((await req('/api/admin/products/' + prod.data.id, { method: 'PATCH', json: { status: 'draft' } })).status === 200, 'toggle to draft');
  ok((await req('/products/' + pslug)).status === 404 && !(await req('/products')).text.includes('Test &lt;b&gt;'), 'draft is hidden from visitors');
  ok((await req('/api/admin/media/' + up.data.files[0].id, { method: 'DELETE' })).status === 409, 'in-use image cannot be deleted');
  ok((await req('/api/admin/products/' + prod.data.id, { method: 'DELETE' })).status === 200, 'delete moves product to Trash');
  ok((await req('/products/' + pslug)).status === 404 && !(await req('/sitemap.xml')).text.includes(pslug), 'trashed product is gone from the site and sitemap');
  const trash = await req('/api/admin/products/trash');
  ok(trash.data.products.some((x) => x.id === prod.data.id), 'Trash lists the deleted product');
  const dup = await req('/api/admin/products', { method: 'POST', json: { code: 'TEST-1', name: 'Dup of trashed' } });
  ok(dup.status === 409 && /Trash/.test(dup.data.error), 'code of a trashed product is reserved with a helpful message');
  ok((await req(`/api/admin/products/${prod.data.id}/restore`, { method: 'POST' })).status === 200, 'restore from Trash');
  ok((await req('/products/' + pslug)).status === 404, 'restored product comes back as a draft (still hidden)');
  ok((await req('/api/admin/products/' + prod.data.id, { method: 'DELETE' })).status === 200, 'trash again');
  ok((await req(`/api/admin/products/${prod.data.id}/forever`, { method: 'DELETE' })).status === 200, 'owner can delete forever');
  ok((await req('/api/admin/categories/' + cat.data.id, { method: 'DELETE' })).status === 200, 'delete category');
  ok((await req('/api/admin/media/' + up.data.files[0].id, { method: 'DELETE' })).status === 200, 'unused image can be deleted');

  console.log('\nBulk add');
  const mk = async (color) => { const f = new FormData(); f.append('files', new Blob([await sharp({ create: { width: 600, height: 800, channels: 3, background: color } }).jpeg().toBuffer()], { type: 'image/jpeg' }), 'b.jpg'); return (await req('/api/admin/upload', { method: 'POST', form: f })).data.files[0].url; };
  const [b1, b2] = [await mk('#336699'), await mk('#993366')];
  const nc = await req('/api/admin/products/next-code?prefix=AANN-');
  ok(nc.status === 200 && nc.data.next === 139, 'next design code is suggested after AANN-138');
  const bulk = (items) => req('/api/admin/products/bulk', { method: 'POST', json: { items } });
  const item = (code, url) => ({ code, name: 'Bulk Kurti ' + code, photos: [{ url, alt: 'Bulk alt ' + code }], status: 'draft', is_new: true });
  ok((await bulk([item('BLK-1', b1), item('BLK-1', b2)])).status === 409, 'bulk rejects duplicate codes inside the batch');
  ok((await bulk([item('AANN-101', b1)])).status === 409, 'bulk rejects a code that already exists');
  const okBulk = await bulk([item('BLK-1', b1), item('BLK-2', b2)]);
  ok(okBulk.status === 201 && okBulk.data.created === 2, 'bulk creates many products at once');
  ok((await req('/api/admin/products?q=BLK-')).data.products.length === 2, 'bulk products appear in the product list as drafts');
  for (const id of okBulk.data.ids) await req('/api/admin/products/' + id, { method: 'DELETE' });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Products');
  sheet.addRow(['code', 'name', 'description', 'fabric', 'sizes', 'colors', 'moq', 'categories']);
  sheet.addRow(['IMPORT-1', 'Imported Kurti', 'Spreadsheet details', 'Cotton', 'M, L, XL', 'Maroon', '4 pieces', '']);
  const spreadsheet = new FormData();
  spreadsheet.append('file', new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'products.xlsx');
  const preview = await req('/api/admin/products/import/preview', { method: 'POST', form: spreadsheet });
  ok(preview.status === 200 && preview.data.items[0].code === 'IMPORT-1' && preview.data.items[0].fabric === 'Cotton', 'Excel product details can be previewed');
  const csvSpreadsheet = new FormData();
  csvSpreadsheet.append('file', new Blob(['\uFEFFcode,name\nIMPORT-CSV,CSV Kurti'], { type: 'text/csv' }), 'products.csv');
  const csvPreview = await req('/api/admin/products/import/preview', { method: 'POST', form: csvSpreadsheet });
  ok(csvPreview.status === 200 && csvPreview.data.items[0].code === 'IMPORT-CSV', 'Excel-exported CSV with a UTF-8 BOM can be previewed');
  const imported = await req('/api/admin/products/bulk', { method: 'POST', json: { items: [{
    code: preview.data.items[0].code, name: preview.data.items[0].name, description: preview.data.items[0].description,
    fabric: preview.data.items[0].fabric, sizes: preview.data.items[0].sizes, colors: preview.data.items[0].colors,
    moq: preview.data.items[0].moq, photos: [], categories: [], status: 'draft', sort: 100,
  }] } });
  const importedProduct = await req(`/api/admin/products/${imported.data.ids[0]}`);
  ok(imported.status === 201 && importedProduct.data.product.photos.length === 0 && importedProduct.data.product.status === 'draft', 'Excel import creates draft products without images');
  await req(`/api/admin/products/${imported.data.ids[0]}`, { method: 'DELETE' });

  console.log('\nWebsite content');
  const c = await req('/api/admin/content');
  ok(c.status === 200 && c.data.schema.brand && c.data.content.home.heroSlides.length, 'content schema served');
  const brand = { ...c.data.content.brand, name: 'TESTBRAND', whatsapp: '919812345678', logoImage: '/assets/seed/og.svg' };
  ok((await req('/api/admin/content/brand', { method: 'PUT', json: brand })).status === 200, 'save brand content');
  const h2 = await req('/');
  ok(h2.text.includes('TESTBRAND') && h2.text.includes('wa.me/919812345678'), 'content change appears on the website');
  ok(h2.text.includes('<img class="logo-image" src="/assets/seed/og.svg"'), 'saved logo image appears in the website header');
  ok((await req('/api/admin/content/brand', { method: 'PUT', json: { ...brand, whatsapp: 'abc' } })).status === 400, 'invalid WhatsApp number rejected');
  ok((await req('/api/admin/content/brand', { method: 'PUT', json: { ...brand, mapEmbed: 'https://evil.example/map' } })).status === 400, 'non-Google map URL rejected');
  ok((await req('/api/admin/content/brand', { method: 'PUT', json: { ...brand, instagramUrl: 'javascript:alert(1)' } })).status === 400, 'javascript: URL rejected');
  await req('/api/admin/content/brand', { method: 'PUT', json: { ...brand, name: '<img src=x onerror=alert(1)>' } });
  ok(!(await req('/')).text.includes('<img src=x onerror'), 'injected HTML in content is escaped');
  await req('/api/admin/content/brand', { method: 'DELETE' });

  console.log('\nEnquiries');
  const enq = await req('/enquiry', { method: 'POST', headers: { accept: 'application/json' }, raw: new URLSearchParams({ name: 'Asha', shop: '=HYPERLINK("x")', city: 'Pune', requirement: 'Need 100 kurtis', buyer_type: 'Retail boutique or store', phone: '+91 98765 43210' }).toString() });
  ok(enq.status === 200 && enq.data.whatsapp.startsWith('https://wa.me/'), 'enquiry saved and WhatsApp link returned');
  const spam = await req('/enquiry', { method: 'POST', headers: { accept: 'application/json' }, raw: new URLSearchParams({ name: 'Bot', shop: 'Bot', city: 'Bot', requirement: 'buy now', website: 'http://spam' }).toString() });
  ok(spam.status === 200, 'honeypot answers normally');
  ok((await req('/enquiry', { method: 'POST', headers: { accept: 'application/json' }, raw: 'name=a' })).status === 400, 'incomplete enquiry rejected');
  const list2 = await req('/api/admin/enquiries');
  ok(list2.data.enquiries.length === 1, 'only the real enquiry is stored (honeypot dropped)');
  const csv = await req('/api/admin/enquiries.csv');
  ok(csv.text.includes(`"'=HYPERLINK`), 'CSV export neutralises formula injection');
  ok((await req('/api/admin/enquiries/' + list2.data.enquiries[0].id, { method: 'PATCH', json: { status: 'contacted' } })).status === 200, 'update enquiry status');

  console.log('\nLegal pages, GST and footer');
  const priv = await req('/privacy'), terms = await req('/terms');
  ok(priv.status === 200 && priv.text.includes('<h1>Privacy policy</h1>') && !priv.text.includes('{{'), 'privacy policy renders with tokens filled in');
  ok(terms.status === 200 && terms.text.includes('Governing law'), 'terms page renders');
  ok(!(await req('/')).text.includes('GSTIN:'), 'GST line is hidden until a number is entered');
  const legal = (await req('/api/admin/content')).data.content.legal;
  ok((await req('/api/admin/content/legal', { method: 'PUT', json: { ...legal, gstin: '12345' } })).status === 400, 'invalid GSTIN rejected');
  ok((await req('/api/admin/content/legal', { method: 'PUT', json: { ...legal, gstin: '08abcde1234f1z5', legalName: 'Padmavati Textiles' } })).status === 200, 'valid GSTIN saved');
  const foot = (await req('/')).text;
  ok(foot.includes('GSTIN: <strong>08ABCDE1234F1Z5</strong>') && foot.includes('Padmavati Textiles') && foot.includes('/privacy') && foot.includes('/terms'), 'footer shows GSTIN, legal name and legal links');
  ok((await req('/api/admin/content/legal', { method: 'PUT', json: { ...legal, privacy: 'Hello <script>alert(1)</script>' } })).status === 200 && !(await req('/privacy')).text.includes('<script>alert(1)'), 'legal text is escaped');
  await req('/api/admin/content/legal', { method: 'DELETE' });

  console.log('\nCatalogue PDF');
  ok((await req('/catalogue')).status === 200, 'catalogue page renders');
  ok((await req('/catalogue.pdf')).status === 302, 'direct PDF link redirects to the form while details are required');
  ok((await req('/catalogue/download?t=bad.token')).status === 302, 'forged download token rejected');
  const cr = await req('/catalogue/request', { method: 'POST', headers: { accept: 'application/json' }, raw: new URLSearchParams({ name: 'Ravi', shop: 'Ravi Store', city: 'Surat', email: 'ravi@example.com' }).toString() });
  ok(cr.status === 200 && cr.data.download.startsWith('/catalogue/download?t='), 'catalogue request returns a signed download link');
  ok((await req('/catalogue/request', { method: 'POST', headers: { accept: 'application/json' }, raw: new URLSearchParams({ name: 'Ravi', shop: 'Ravi Store', city: 'Surat' }).toString() })).status === 400, 'request needs a phone or email');
  const dl = await fetch(BASE + cr.data.download);
  const pdfBytes = Buffer.from(await dl.arrayBuffer());
  ok(dl.status === 200 && dl.headers.get('content-type') === 'application/pdf' && pdfBytes.subarray(0, 5).toString() === '%PDF-' && pdfBytes.length > 5000, 'signed link downloads a real generated PDF');
  ok((await req('/api/admin/enquiries')).data.enquiries.some((x) => x.source === 'catalogue' && x.email === 'ravi@example.com'), 'catalogue request is saved as a lead');
  const notPdf = new FormData(); notPdf.append('file', new Blob(['hello'], { type: 'application/pdf' }), 'x.pdf');
  ok((await req('/api/admin/catalogue/upload', { method: 'POST', form: notPdf })).status === 400, 'fake PDF upload rejected');
  const realPdf = new FormData(); realPdf.append('file', new Blob(['%PDF-1.4\n%custom\n'], { type: 'application/pdf' }), 'mine.pdf');
  ok((await req('/api/admin/catalogue/upload', { method: 'POST', form: realPdf })).status === 200, 'owner can upload own PDF');
  const dl2 = Buffer.from(await (await fetch(BASE + cr.data.download)).arrayBuffer());
  ok(dl2.toString().includes('%custom'), 'uploaded PDF replaces the automatic one');
  ok((await req('/api/admin/catalogue/custom', { method: 'DELETE' })).status === 200, 'custom PDF can be removed');
  const cc = (await req('/api/admin/content')).data.content.catalogue;
  await req('/api/admin/content/catalogue', { method: 'PUT', json: { ...cc, requireDetails: false } });
  ok((await req('/catalogue.pdf')).status === 200, 'direct PDF link works when details are not required');
  await req('/api/admin/content/catalogue', { method: 'DELETE' });

  console.log('\nAnalytics and statistics');
  const csp2 = (await req('/')).res.headers.get('content-security-policy');
  ok(csp2.includes('script-src') && csp2.includes('https://plausible.io') && /connect-src[^;]*plausible/.test(csp2), 'CSP allows only the configured analytics host');
  ok((await req('/')).text.includes('data-domain="example.com"'), 'Plausible script tag is added');
  const slugAny = ((await req('/products')).text.match(/href="\/products\/([a-z0-9-]+)"/) || [])[1];
  await req('/products/' + slugAny, { headers: { 'user-agent': 'Mozilla/5.0 (test browser)' }, auth: false });
  await req('/products/' + slugAny, { headers: { 'user-agent': 'Googlebot/2.1' }, auth: false });
  const beacon = await req('/api/t', { method: 'POST', json: { p: slugAny }, auth: false });
  ok(beacon.status === 204, 'enquiry click beacon accepted');
  const pop = (await req('/api/admin/stats')).data.popular;
  ok(pop.totals.views === 1 && pop.totals.enquiries === 1, 'views counted once for browsers, bots ignored, clicks counted');
  ok((await req('/api/t', { method: 'POST', json: { p: '../etc' }, auth: false })).status === 204 && (await req('/api/admin/stats')).data.popular.totals.enquiries === 1, 'bad beacon slug ignored');

  console.log('\nUsers, roles and two-factor');
  const ownerSession = { cookie, csrf };
  ok((await req('/api/admin/users', { method: 'POST', json: { email: 'editor@example.com', password: 'short', role: 'editor' } })).status === 400, 'weak password rejected for new user');
  ok((await req('/api/admin/users', { method: 'POST', json: { email: 'editor@example.com', password: 'Quiet7River9Bridge', role: 'editor' } })).status === 201, 'owner adds a second user');
  const edLogin = await req('/api/admin/login', { method: 'POST', json: { email: 'editor@example.com', password: 'Quiet7River9Bridge' }, auth: false });
  const edSession = { cookie: (edLogin.res.headers.get('set-cookie') || '').split(';')[0], csrf: edLogin.data.csrf };
  Object.assign(globalThis, {}); cookie = edSession.cookie; csrf = edSession.csrf;
  ok((await req('/api/admin/products')).status === 200, 'editor can manage products');
  ok((await req('/api/admin/users')).status === 403, 'editor cannot see users');
  ok((await req('/api/admin/users', { method: 'POST', json: { email: 'x@example.com', password: 'Another4Strong9Pass', role: 'owner' } })).status === 403, 'editor cannot create users');
  ok((await req('/api/admin/products/1/forever', { method: 'DELETE' })).status === 403, 'editor cannot delete forever');
  cookie = ownerSession.cookie; csrf = ownerSession.csrf;
  const usersList = (await req('/api/admin/users')).data.users;
  const me = usersList.find((u) => u.you);
  ok((await req('/api/admin/users/' + me.id, { method: 'DELETE' })).status === 400, 'cannot delete your own account');
  ok((await req('/api/admin/users/' + me.id, { method: 'PATCH', json: { role: 'editor' } })).status === 400, 'cannot demote the last owner');

  ok((await req('/api/admin/2fa/setup', { method: 'POST', json: { password: 'wrong-password-1' } })).status === 400, '2FA setup needs the password');
  const setup = await req('/api/admin/2fa/setup', { method: 'POST', json: { password: PASS } });
  ok(setup.status === 200 && setup.data.qr.startsWith('data:image/svg+xml;base64,') && /^[A-Z2-7]{32}$/.test(setup.data.secret), '2FA setup returns a QR code and key');
  ok((await req('/api/admin/2fa/enable', { method: 'POST', json: { code: '000000' } })).status === 400, 'wrong code does not enable 2FA');
  const en = await req('/api/admin/2fa/enable', { method: 'POST', json: { code: codeAt(setup.data.secret) } });
  ok(en.status === 200 && en.data.recoveryCodes.length === 8, '2FA enabled with 8 recovery codes');
  ok((await req('/api/admin/stats')).status === 200, 'current session stays signed in after enabling 2FA');
  await req('/api/admin/logout', { method: 'POST' });
  const l1 = await req('/api/admin/login', { method: 'POST', json: { email: EMAIL, password: PASS }, auth: false });
  ok(l1.status === 200 && l1.data.needs2fa && !l1.res.headers.get('set-cookie'), 'password alone no longer signs in (no session issued)');
  const code2 = codeAt(setup.data.secret, stepNow() + 1);
  ok((await req('/api/admin/login/2fa', { method: 'POST', json: { ticket: l1.data.ticket, code: '111111' }, auth: false })).status === 401, 'wrong 2FA code rejected');
  ok((await req('/api/admin/login/2fa', { method: 'POST', json: { ticket: 'forged.ticket', code: code2 }, auth: false })).status === 401, 'forged 2FA ticket rejected');
  const l2 = await req('/api/admin/login/2fa', { method: 'POST', json: { ticket: l1.data.ticket, code: code2 }, auth: false });
  ok(l2.status === 200 && !!l2.data.csrf, 'correct authenticator code signs in');
  const replay = await req('/api/admin/login/2fa', { method: 'POST', json: { ticket: l1.data.ticket, code: code2 }, auth: false });
  ok(replay.status === 401, 'the same code cannot be used twice');
  cookie = (l2.res.headers.get('set-cookie') || '').split(';')[0]; csrf = l2.data.csrf;
  await req('/api/admin/logout', { method: 'POST' });
  const l3 = await req('/api/admin/login', { method: 'POST', json: { email: EMAIL, password: PASS }, auth: false });
  const rc = en.data.recoveryCodes[0];
  const l4 = await req('/api/admin/login/2fa', { method: 'POST', json: { ticket: l3.data.ticket, code: rc }, auth: false });
  ok(l4.status === 200 && l4.data.recoveryLeft === 7, 'recovery code signs in');
  cookie = (l4.res.headers.get('set-cookie') || '').split(';')[0]; csrf = l4.data.csrf;
  await req('/api/admin/logout', { method: 'POST' });
  const l5 = await req('/api/admin/login', { method: 'POST', json: { email: EMAIL, password: PASS }, auth: false });
  ok((await req('/api/admin/login/2fa', { method: 'POST', json: { ticket: l5.data.ticket, code: rc }, auth: false })).status === 401, 'a recovery code works only once');
  const l6 = await req('/api/admin/login/2fa', { method: 'POST', json: { ticket: l5.data.ticket, code: en.data.recoveryCodes[1] }, auth: false });
  cookie = (l6.res.headers.get('set-cookie') || '').split(';')[0]; csrf = l6.data.csrf;
  const st = (await req('/api/admin/stats')).data;
  ok(st.setup.find((x) => /Two-factor/.test(x.label)).ok && st.setup.find((x) => /Sentry/.test(x.label)).ok, 'go-live checklist reflects 2FA and Sentry');
  ok((await req('/api/admin/2fa/disable', { method: 'POST', json: { password: PASS, code: en.data.recoveryCodes[2] } })).status === 200, 'owner can turn 2FA off with password + code');
  const l7 = await req('/api/admin/login', { method: 'POST', json: { email: EMAIL, password: PASS }, auth: false });
  ok(l7.status === 200 && !!l7.data.csrf, 'normal sign-in works again after disabling 2FA');
  cookie = (l7.res.headers.get('set-cookie') || '').split(';')[0]; csrf = l7.data.csrf;

  console.log('\nPassword and logout');
  ok((await req('/api/admin/password', { method: 'POST', json: { current: PASS, next: 'short1' } })).status === 400, 'weak new password rejected');
  ok((await req('/api/admin/logout', { method: 'POST' })).status === 200, 'logout');
  ok((await req('/api/admin/stats')).status === 401, 'session is dead after logout');

  console.log('\nBrute-force protection');
  let locked = false;
  for (let i = 0; i < 8; i++) { const r = await req('/api/admin/login', { method: 'POST', json: { email: EMAIL, password: 'nope-nope-nope-' + i }, auth: false }); if (r.status === 429) locked = true; }
  ok(locked, 'repeated failures trigger lockout');
  ok((await req('/api/admin/login', { method: 'POST', json: { email: EMAIL, password: PASS }, auth: false })).status === 429, 'correct password is also blocked during lockout');
} catch (e) {
  failed++; console.error('\nTest run crashed:', e.message);
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => {
    if (server.exitCode !== null || server.signalCode !== null) return resolve();
    server.once('exit', resolve);
  });
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
