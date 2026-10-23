// Builds the wholesale lookbook PDF from published products, or serves a custom PDF the owner uploaded.
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { config } from '../config.js';
import { db } from '../models/database.js';
import { getContent } from './content.js';
import { listCategories, withCategories } from '../models/products.js';

const AUTO = path.join(config.catalogueDir, 'catalogue-auto.pdf');
const KEY = path.join(config.catalogueDir, 'catalogue-auto.key');
const CUSTOM = path.join(config.catalogueDir, 'catalogue-custom.pdf');
const C = { maroon: '#5C1624', dark: '#3A0C16', gold: '#C69C49', goldD: '#8A6420', ivory: '#FBF6EE', ink: '#2A211C', grey: '#6B5E55', line: '#E1D3BC' };

// Built-in PDF fonts only cover Latin characters, so anything else is dropped rather than shown as boxes.
const latin = (s) => String(s ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022]/g, '').trim();
const exists = (f) => fs.existsSync(f);

function imagePath(url) {
  if (/^\/uploads\/[a-f0-9]{24}\.webp$/.test(url)) return path.join(config.uploadDir, url.slice(9).replace(/\.webp$/, '-md.webp'));
  if (/^\/assets\/[A-Za-z0-9._/-]+$/.test(url) && !url.includes('..')) return path.join(config.publicDir, url);
  return null;
}
async function jpeg(url, w, h) {
  const f = imagePath(url);
  if (!f || !exists(f)) return null;
  try { return await sharp(f, { density: 110 }).resize(w, h, { fit: 'cover', position: 'top' }).flatten({ background: '#F3EADB' }).jpeg({ quality: 82 }).toBuffer(); } catch { return null; }
}
const archPath = (x, y, w, h) => { const r = w / 2; return `M${x} ${y + h} L${x} ${y + r} A${r} ${r} 0 0 1 ${x + w} ${y + r} L${x + w} ${y + h} Z`; };

function sourceRows() {
  const rows = db.prepare(`SELECT * FROM products WHERE status = 'published' AND deleted_at IS NULL ORDER BY sort ASC, id DESC`).all();
  return withCategories(rows);
}
function currentKey() {
  const c = getContent();
  const rows = db.prepare(`SELECT id, updated_at, images, name, code FROM products WHERE status = 'published' AND deleted_at IS NULL ORDER BY id`).all();
  const cats = db.prepare('SELECT id, name, sort, active FROM categories ORDER BY id').all();
  const pc = db.prepare('SELECT product_id, category_id FROM product_categories ORDER BY product_id, category_id').all();
  return crypto.createHash('sha256').update(JSON.stringify([2, rows, cats, pc, c.brand, c.catalogue, c.legal.gstin, c.legal.legalName])).digest('hex');
}

async function build() {
  const site = getContent();
  const { brand, catalogue: cat, legal } = site;
  const products = sourceRows();
  const groups = [];
  const placed = new Set();
  for (const c of listCategories()) {
    const items = products.filter((p) => p.categories.some((x) => x.id === c.id) && !placed.has(p.id));
    items.forEach((p) => placed.add(p.id));
    if (items.length) groups.push({ name: c.name, items });
  }
  const rest = products.filter((p) => !placed.has(p.id));
  if (rest.length) groups.push({ name: groups.length ? 'More designs' : 'Our designs', items: rest });

  const tmp = AUTO + '.tmp';
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, autoFirstPage: false,
    info: { Title: latin(`${brand.name} ${brand.byline} wholesale catalogue`), Author: latin(brand.name), Subject: 'Wholesale catalogue' } });
  const out = fs.createWriteStream(tmp);
  doc.pipe(out);
  const W = 595.28, H = 841.89, M = 36;
  const name = latin(legal.legalName || `${brand.name} ${brand.byline}`);

  // ---- cover ----
  doc.addPage();
  doc.rect(0, 0, W, H).fill(C.dark);
  doc.rect(0, 0, W, H).fill(C.maroon).opacity(1);
  doc.lineWidth(1.5).strokeColor(C.gold);
  doc.path(archPath(88, 150, 420, 560)).stroke();
  doc.path(archPath(102, 164, 392, 546)).dash(2, { space: 5 }).stroke().undash();
  doc.fillColor(C.gold).font('Times-Bold').fontSize(54).text(latin(brand.name).toUpperCase(), 0, 290, { width: W, align: 'center', characterSpacing: 4 });
  doc.fillColor(C.ivory).font('Times-Italic').fontSize(20).text(latin(brand.byline), 0, 355, { width: W, align: 'center' });
  doc.moveTo(W / 2 - 40, 400).lineTo(W / 2 + 40, 400).strokeColor(C.gold).lineWidth(1).stroke();
  doc.fillColor('#FFFFFF').font('Times-Bold').fontSize(26).text(latin(cat.coverTitle || 'Wholesale Catalogue'), 150, 425, { width: W - 300, align: 'center' });
  doc.fillColor(C.gold).font('Helvetica').fontSize(11).text(latin(cat.coverSubtitle), 160, doc.y + 12, { width: W - 320, align: 'center' });
  doc.fillColor(C.ivory).font('Helvetica').fontSize(10)
    .text(new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), 0, 740, { width: W, align: 'center' });
  doc.fontSize(9).fillColor(C.gold).text(`${products.length} designs  |  Wholesale only  |  Minimum order applies`, 0, 758, { width: W, align: 'center' });

  // ---- product pages ----
  const cols = 3, gap = 14, cw = (W - M * 2 - gap * (cols - 1)) / cols, ih = Math.round(cw * 1.42), rowH = ih + 78;
  for (const g of groups) {
    for (let i = 0; i < g.items.length; i += 6) {
      doc.addPage();
      doc.rect(0, 0, W, 44).fill(C.maroon);
      doc.fillColor(C.gold).font('Times-Bold').fontSize(15).text(latin(brand.name).toUpperCase(), M, 15, { characterSpacing: 2, lineBreak: false });
      doc.fillColor(C.ivory).font('Helvetica').fontSize(10).text(latin(g.name), M, 17, { width: W - M * 2, align: 'right', lineBreak: false });
      const batch = g.items.slice(i, i + 6);
      const imgs = await Promise.all(batch.map((p) => jpeg(p.images[0], Math.round(cw * 3), Math.round(ih * 3))));
      for (let k = 0; k < batch.length; k++) {
        const p = batch[k], col = k % cols, row = Math.floor(k / cols);
        const x = M + col * (cw + gap), y = 64 + row * rowH;
        doc.save();
        doc.path(archPath(x, y, cw, ih)).clip();
        if (imgs[k]) doc.image(imgs[k], x, y, { width: cw, height: ih }); else doc.rect(x, y, cw, ih).fill('#EADFCF');
        doc.restore();
        doc.path(archPath(x, y, cw, ih)).lineWidth(0.8).strokeColor(C.gold).stroke();
        if (p.is_new) { doc.roundedRect(x + 8, y + 26, 34, 15, 7).fill(C.maroon); doc.fillColor(C.ivory).font('Helvetica-Bold').fontSize(7.5).text('NEW', x + 8, y + 30, { width: 34, align: 'center', lineBreak: false }); }
        let ty = y + ih + 8;
        doc.fillColor(C.maroon).font('Times-Bold').fontSize(10.5).text(latin(p.name), x, ty, { width: cw, height: 26, ellipsis: true });
        ty += doc.heightOfString(latin(p.name), { width: cw }) > 14 ? 28 : 15;
        doc.fillColor(C.goldD).font('Helvetica-Bold').fontSize(8).text(latin(p.code), x, ty, { width: cw, lineBreak: false });
        ty += 12;
        doc.fillColor(C.grey).font('Helvetica').fontSize(7.6);
        for (const line of [p.fabric, p.sizes && `Sizes: ${p.sizes}`, p.moq && `MOQ: ${p.moq}`].filter(Boolean)) {
          doc.text(latin(line), x, ty, { width: cw, height: 10, ellipsis: true, lineBreak: false }); ty += 10;
        }
      }
    }
  }

  // ---- closing page ----
  doc.addPage();
  doc.rect(0, 0, W, H).fill(C.maroon);
  doc.lineWidth(1.5).strokeColor(C.gold).path(archPath(238, 90, 120, 150)).stroke();
  doc.fillColor(C.gold).font('Times-Bold').fontSize(24).text('Order the easy way', 0, 300, { width: W, align: 'center' });
  doc.fillColor(C.ivory).font('Helvetica').fontSize(11).text(latin(cat.closingNote), 130, 340, { width: W - 260, align: 'center', lineGap: 3 });
  const lines = [latin(brand.address), brand.phone && `Phone: ${latin(brand.phone)}`, `WhatsApp: +${brand.whatsapp}`, brand.email && latin(brand.email), brand.hours && latin(brand.hours), legal.gstin && `GSTIN: ${legal.gstin}`, config.siteUrl.replace(/^https?:\/\//, '')].filter(Boolean);
  doc.fillColor(C.ivory).fontSize(11).text(lines.join('\n'), 100, 480, { width: W - 200, align: 'center', lineGap: 6 });
  doc.fillColor(C.gold).fontSize(9).text(name, 0, 780, { width: W, align: 'center' });

  // ---- page numbers on product pages ----
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count - 1; i++) {
    doc.switchToPage(i);
    doc.fillColor(C.grey).font('Helvetica').fontSize(8)
      .text(`${i}`, 0, H - 28, { width: W, align: 'center', lineBreak: false })
      .text(latin(`${brand.name} ${brand.byline}  |  Wholesale only`), M, H - 28, { lineBreak: false });
  }
  doc.end();
  await new Promise((res, rej) => { out.on('finish', res); out.on('error', rej); });
  await fsp.rename(tmp, AUTO);
  await fsp.writeFile(KEY, currentKey());
}

let building = null;
export function rebuild() {
  if (!building) building = build().finally(() => { building = null; });
  return building;
}

// Returns the file to serve. A custom upload always wins; the automatic PDF is rebuilt only when products or text changed.
export async function pdfFile() {
  if (exists(CUSTOM)) return { file: CUSTOM, source: 'custom' };
  const fresh = exists(AUTO) && exists(KEY) && fs.readFileSync(KEY, 'utf8') === currentKey();
  if (!fresh) await rebuild();
  return { file: AUTO, source: 'auto' };
}

export function status() {
  const stat = (f) => (exists(f) ? { size: fs.statSync(f).size, at: fs.statSync(f).mtime.toISOString() } : null);
  const auto = stat(AUTO);
  return { custom: stat(CUSTOM), auto, stale: !(auto && exists(KEY) && fs.readFileSync(KEY, 'utf8') === currentKey()),
    products: db.prepare(`SELECT COUNT(*) c FROM products WHERE status = 'published' AND deleted_at IS NULL`).get().c };
}

export async function saveCustom(buffer) {
  if (buffer.subarray(0, 5).toString() !== '%PDF-') throw Object.assign(new Error('That file is not a PDF.'), { status: 400 });
  const tmp = CUSTOM + '.tmp';
  await fsp.writeFile(tmp, buffer, { mode: 0o640 });
  await fsp.rename(tmp, CUSTOM);
}
export const removeCustom = () => fsp.rm(CUSTOM, { force: true });

// ---- signed, expiring download links (so the catalogue is given out only after the request form) ----
const sign = (v) => crypto.createHmac('sha256', config.sessionSecret).update('catalogue|' + v).digest('base64url');
export const makeToken = () => { const exp = Date.now() + 24 * 3600_000; return `${exp}.${sign(exp)}`; };
export function checkToken(t) {
  const [exp, sig] = String(t || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
