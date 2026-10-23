import { db, audit } from '../../models/database.js';
import { limits } from '../../middleware/security.js';
import { validateId, fail } from '../../middleware/request-validation.js';
import { upload, saveImage, deleteImageFiles } from '../../services/uploads.js';

export function registerMediaRoutes(admin) {
  admin.post('/upload', limits.upload, (req, res, next) => upload.array('files', 8)(req, res, (err) => {
    if (err) return fail(res, 400, err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be under 8 MB.' : 'Upload failed. Send up to 8 images.');
    next();
  }), async (req, res) => {
    if (!req.files?.length) return fail(res, 400, 'Choose at least one image.');
    const out = [], errors = [];
    for (const f of req.files) {
      try { out.push(await saveImage(f)); } catch (e) { errors.push(`${f.originalname}: ${e.status ? e.message : 'could not be processed as an image.'}`); }
    }
    if (out.length) audit(req, 'upload', `${out.length} image(s)`);
    res.status(out.length ? 200 : 400).json({ files: out, errors, error: out.length ? undefined : errors.join(' ') });
  });
  
  const usedImages = () => {
    const blob = [db.prepare('SELECT images FROM products').all().map((r) => r.images).join(' '),
      db.prepare('SELECT image FROM categories').all().map((r) => r.image).join(' '),
      db.prepare('SELECT data FROM content').all().map((r) => r.data).join(' ')].join(' ');
    return (name) => blob.includes(name);
  };
  admin.get('/media', (req, res) => {
    const used = usedImages();
    const rows = db.prepare('SELECT * FROM media ORDER BY id DESC LIMIT 300').all();
    res.json({ files: rows.map((m) => ({ id: m.id, url: `/uploads/${m.filename}`, thumb: `/uploads/${m.filename.replace(/\.webp$/, '-md.webp')}`,
      name: m.original, size: m.size, created: m.created_at, used: used(m.filename) })) });
  });
  admin.delete('/media/:id', validateId, async (req, res) => {
    const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.id);
    if (!m) return fail(res, 404, 'Image not found.');
    if (usedImages()(m.filename)) return fail(res, 409, 'This image is in use. Remove it from the product, category or page first.');
    db.prepare('DELETE FROM media WHERE id = ?').run(m.id);
    await deleteImageFiles(m.filename);
    audit(req, 'media_deleted', m.filename);
    res.json({ ok: true });
  });
}
