import { z } from 'zod';
import { db, audit, uniqueSlug } from '../../models/database.js';
import { fail, validateBody, validateId } from '../../middleware/request-validation.js';
import { bool, imageField } from './schemas.js';

export function registerCategoryRoutes(admin) {
  const bool = z.union([z.boolean(), z.number()]).transform(Boolean);
  const catSchema = z.object({
    name: z.string().trim().min(2).max(60), tagline: z.string().trim().max(120).default(''),
    description: z.string().trim().max(400).default(''), moq: z.string().trim().max(100).default(''),
    image: imageField.default(''), sort: z.coerce.number().int().min(0).max(9999).default(0),
    active: bool.default(true), on_home: bool.default(true),
  }).strict();
  
  admin.get('/categories', (req, res) => res.json({ categories: db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM product_categories WHERE category_id = c.id) AS product_count FROM categories c ORDER BY sort, name`).all() }));
  admin.post('/categories', validateBody(catSchema), (req, res) => {
    const d = req.data;
    const info = db.prepare('INSERT INTO categories (slug, name, tagline, description, moq, image, sort, active, on_home) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(uniqueSlug('categories', d.name), d.name, d.tagline, d.description, d.moq, d.image, d.sort, +d.active, +d.on_home);
    audit(req, 'category_created', d.name);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });
  admin.put('/categories/:id', validateId, validateBody(catSchema), (req, res) => {
    const d = req.data;
    const r = db.prepare('UPDATE categories SET name=?, tagline=?, description=?, moq=?, image=?, sort=?, active=?, on_home=? WHERE id=?')
      .run(d.name, d.tagline, d.description, d.moq, d.image, d.sort, +d.active, +d.on_home, req.id);
    if (!r.changes) return fail(res, 404, 'Category not found.');
    audit(req, 'category_updated', d.name);
    res.json({ ok: true });
  });
  admin.delete('/categories/:id', validateId, (req, res) => {
    const r = db.prepare('DELETE FROM categories WHERE id = ?').run(req.id);
    if (!r.changes) return fail(res, 404, 'Category not found.');
    audit(req, 'category_deleted', String(req.id));
    res.json({ ok: true });
  });
}
