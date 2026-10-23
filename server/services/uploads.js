import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { config } from '../config.js';
import { db } from '../models/database.js';

sharp.cache(false);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 8, fields: 5, parts: 20 },
});

// Accept only real JPEG / PNG / WebP by inspecting the bytes (not the file name or the browser-supplied type).
function sniff(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

// Re-encodes every upload to WebP (max 1600px) plus a 640px thumbnail. This strips EXIF/GPS data,
// removes any hidden payloads and keeps pages fast even when someone uploads a 6 MB phone photo.
export async function saveImage(file) {
  if (!sniff(file.buffer)) throw Object.assign(new Error('Only JPG, PNG or WebP images are allowed.'), { status: 400 });
  const id = crypto.randomBytes(12).toString('hex');
  const base = sharp(file.buffer, { limitInputPixels: 60_000_000 }).rotate();
  const full = await base.clone().resize({ width: 1600, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const thumb = await base.clone().resize({ width: 640, height: 800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  const name = `${id}.webp`;
  await fs.writeFile(path.join(config.uploadDir, name), full, { flag: 'wx', mode: 0o640 });
  await fs.writeFile(path.join(config.uploadDir, `${id}-md.webp`), thumb, { flag: 'wx', mode: 0o640 });
  const original = String(file.originalname || '').replace(/[^\w. -]/g, '').slice(0, 80);
  const info = db.prepare('INSERT INTO media (filename, original, mime, size) VALUES (?,?,?,?)').run(name, original, 'image/webp', full.length);
  return { id: Number(info.lastInsertRowid), url: `/uploads/${name}`, thumb: `/uploads/${id}-md.webp` };
}

export async function deleteImageFiles(filename) {
  const safe = path.basename(filename);
  for (const f of [safe, safe.replace(/\.webp$/, '-md.webp')]) {
    await fs.rm(path.join(config.uploadDir, f), { force: true });
  }
}

export const thumbOf = (url) => (/^\/uploads\/[a-f0-9]{24}\.webp$/.test(url || '') ? url.replace(/\.webp$/, '-md.webp') : url);
