import { z } from 'zod';
import ExcelJS from 'exceljs';
import multer from 'multer';
import { Readable } from 'node:stream';
import { db, audit, uniqueSlug } from '../../models/database.js';
import { requireOwner } from '../../middleware/authentication.js';
import { fail, validateBody, validateId } from '../../middleware/request-validation.js';
import { withCategories, photosOf } from '../../models/products.js';
import { bool, imageField } from './schemas.js';
import { TRASH_DAYS } from '../../controllers/trash-controller.js';

export function registerProductRoutes(admin) {
  const spreadsheetUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  });
  const photo = z.object({ url: imageField.refine((v) => v !== ''), alt: z.string().trim().max(160).default('') }).strict();
  const productSchema = z.object({
    code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, dot, dash or underscore only'),
    name: z.string().trim().min(2).max(120), description: z.string().trim().max(2000).default(''),
    fabric: z.string().trim().max(160).default(''), sizes: z.string().trim().max(160).default(''),
    colors: z.string().trim().max(160).default(''), moq: z.string().trim().max(160).default(''),
    photos: z.array(photo).max(8).default([]),
    categories: z.array(z.coerce.number().int().positive()).max(20).default([]),
    is_new: bool.default(false), is_featured: bool.default(false),
    status: z.enum(['published', 'draft']).default('published'),
    sort: z.coerce.number().int().min(0).max(9999).default(100),
  }).strict();
  
  function setCategories(productId, ids) {
    db.prepare('DELETE FROM product_categories WHERE product_id = ?').run(productId);
    const ins = db.prepare('INSERT OR IGNORE INTO product_categories (product_id, category_id) SELECT ?, id FROM categories WHERE id = ?');
    for (const c of new Set(ids)) ins.run(productId, c);
  }
  const codeProblem = (code, ignoreId = 0) => {
    const hit = db.prepare('SELECT id, deleted_at FROM products WHERE code = ? AND id != ?').get(code, ignoreId);
    if (!hit) return null;
    return hit.deleted_at ? `Design code ${code} belongs to a deleted product in the Trash. Restore it or choose another code.` : `Design code ${code} already exists.`;
  };
  const insertProduct = (d) => {
    const info = db.prepare(`INSERT INTO products (code, slug, name, description, fabric, sizes, colors, moq, images, is_new, is_featured, status, sort)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(d.code, uniqueSlug('products', `${d.name} ${d.code}`), d.name, d.description, d.fabric, d.sizes,
      d.colors, d.moq, JSON.stringify(d.photos), +d.is_new, +d.is_featured, d.status, d.sort);
    setCategories(Number(info.lastInsertRowid), d.categories);
    return Number(info.lastInsertRowid);
  };
  
  admin.get('/products', (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80).replace(/[\\%_]/g, (c) => '\\' + c);
    const status = ['published', 'draft'].includes(req.query.status) ? req.query.status : '';
    const where = ['deleted_at IS NULL'], args = [];
    if (q) { where.push(`(name LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\')`); args.push(`%${q}%`, `%${q}%`); }
    if (status) { where.push('status = ?'); args.push(status); }
    const rows = db.prepare(`SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY sort ASC, id DESC LIMIT 500`).all(...args);
    res.json({ products: withCategories(rows) });
  });
  admin.get('/products/next-code', (req, res) => {
    const prefix = String(req.query.prefix ?? 'AANN-').slice(0, 12);
    if (!/^[A-Za-z0-9._-]*$/.test(prefix)) return fail(res, 400, 'Invalid prefix.');
    let max = 0;
    for (const { code } of db.prepare('SELECT code FROM products').all()) {
      const m = code.toLowerCase().startsWith(prefix.toLowerCase()) && /^\d+$/.test(code.slice(prefix.length)) ? Number(code.slice(prefix.length)) : 0;
      if (m > max) max = m;
    }
    res.json({ next: max + 1 });
  });
  admin.post('/products/import/preview', (req, res, next) => spreadsheetUpload.single('file')(req, res, (err) => {
    if (err) return fail(res, 400, err.code === 'LIMIT_FILE_SIZE' ? 'Spreadsheet must be under 2 MB.' : 'Upload one .xlsx or .csv spreadsheet.');
    next();
  }), async (req, res) => {
    const file = req.file;
    if (!file) return fail(res, 400, 'Choose an .xlsx or .csv spreadsheet.');
    const extension = file.originalname.toLowerCase().split('.').pop();
    if (!['xlsx', 'csv'].includes(extension)) return fail(res, 400, 'Only .xlsx and .csv spreadsheets are supported.');

    try {
      const workbook = new ExcelJS.Workbook();
      if (extension === 'xlsx') await workbook.xlsx.load(file.buffer);
      else await workbook.csv.read(Readable.from([file.buffer.toString('utf8')]));
      const worksheet = workbook.worksheets[0];
      if (!worksheet || worksheet.rowCount < 2) return fail(res, 400, 'The spreadsheet needs a header row and at least one product row.');
      if (worksheet.rowCount > 61 || worksheet.columnCount > 12) return fail(res, 400, 'Import up to 60 products with no more than 12 columns.');

      const headers = new Map();
      worksheet.getRow(1).eachCell((cell, column) => {
        const key = String(cell.value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_-]+/g, '');
        if (key) headers.set(key, column);
      });
      const column = (...names) => names.map((name) => headers.get(name)).find(Boolean);
      const codeColumn = column('code', 'designcode');
      const nameColumn = column('name', 'productname');
      if (!codeColumn || !nameColumn) return fail(res, 400, 'Include required columns named "code" and "name".');

      const text = (cell) => {
        const value = cell?.value;
        if (value == null) return '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('').trim();
        if (value.formula || value.sharedFormula) throw new Error('Formulas are not supported. Replace formulas with their values.');
        if (value.text != null) return String(value.text).trim();
        throw new Error('Use plain text or numbers in the product detail cells.');
      };
      const optionalColumn = (...names) => column(...names);
      const columns = {
        code: codeColumn, name: nameColumn,
        description: optionalColumn('description'),
        fabric: optionalColumn('fabric'),
        sizes: optionalColumn('sizes'),
        colors: optionalColumn('colors', 'colours', 'color', 'colour'),
        moq: optionalColumn('moq', 'minimumorder'),
        categories: optionalColumn('categories', 'category'),
      };
      const items = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const item = Object.fromEntries(Object.entries(columns).map(([key, col]) => [key, col ? text(row.getCell(col)) : '']));
        if (Object.values(item).some(Boolean)) items.push({ ...item, row: rowNumber });
      });
      if (!items.length) return fail(res, 400, 'No product details found below the header row.');
      if (items.length > 60) return fail(res, 400, 'Import up to 60 products at a time.');
      res.json({ items });
    } catch (error) {
      res.status(400).json({ error: `Could not read the spreadsheet: ${error.message}` });
    }
  });
  admin.get('/products/trash', (req, res) => {
    const rows = db.prepare('SELECT * FROM products WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all();
    res.json({ products: withCategories(rows).map((p) => ({ ...p, purge_on: new Date(new Date(p.deleted_at.replace(' ', 'T') + 'Z').getTime() + TRASH_DAYS * 864e5).toISOString() })) });
  });
  admin.get('/products/:id', validateId, (req, res) => {
    const row = db.prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL').get(req.id);
    if (!row) return fail(res, 404, 'Product not found.');
    const p = withCategories([row])[0];
    res.json({ product: { ...p, photos: photosOf(row), images: undefined, alts: undefined, categories: p.categories.map((c) => c.id) } });
  });
  admin.post('/products', validateBody(productSchema), (req, res) => {
    const d = req.data;
    const problem = codeProblem(d.code);
    if (problem) return fail(res, 409, problem);
    const newId = insertProduct(d);
    audit(req, 'product_created', d.code);
    res.status(201).json({ id: newId });
  });
  // Bulk add: one product per uploaded photo, created in one go (all or nothing).
  admin.post('/products/bulk', validateBody(z.object({ items: z.array(productSchema).min(1).max(60) }).strict()), (req, res) => {
    const seen = new Set(), errors = [];
    for (const d of req.data.items) {
      const k = d.code.toLowerCase();
      const problem = seen.has(k) ? `Design code ${d.code} is used twice in this batch.` : codeProblem(d.code);
      if (problem) errors.push(problem);
      seen.add(k);
    }
    if (errors.length) return fail(res, 409, errors.slice(0, 3).join(' ') + (errors.length > 3 ? ` (and ${errors.length - 3} more)` : ''));
    const ids = db.transaction(() => req.data.items.map(insertProduct))();
    audit(req, 'products_bulk_created', `${ids.length} products`);
    res.status(201).json({ created: ids.length, ids });
  });
  admin.put('/products/:id', validateId, validateBody(productSchema), (req, res) => {
    const d = req.data;
    const problem = codeProblem(d.code, req.id);
    if (problem) return fail(res, 409, problem);
    const r = db.prepare(`UPDATE products SET code=?, name=?, description=?, fabric=?, sizes=?, colors=?, moq=?, images=?, is_new=?, is_featured=?,
      status=?, sort=?, updated_at=datetime('now') WHERE id=? AND deleted_at IS NULL`).run(d.code, d.name, d.description, d.fabric, d.sizes, d.colors, d.moq,
      JSON.stringify(d.photos), +d.is_new, +d.is_featured, d.status, d.sort, req.id);
    if (!r.changes) return fail(res, 404, 'Product not found.');
    setCategories(req.id, d.categories);
    audit(req, 'product_updated', d.code);
    res.json({ ok: true });
  });
  admin.patch('/products/:id', validateId, validateBody(z.object({ status: z.enum(['published', 'draft']), is_new: bool, is_featured: bool }).partial().strict()), (req, res) => {
    const d = req.data, sets = [], args = [];
    for (const [k, v] of Object.entries(d)) { sets.push(`${k} = ?`); args.push(typeof v === 'boolean' ? +v : v); }
    if (!sets.length) return fail(res, 400, 'Nothing to update.');
    const r = db.prepare(`UPDATE products SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`).run(...args, req.id);
    if (!r.changes) return fail(res, 404, 'Product not found.');
    audit(req, 'product_toggled', `${req.id} ${JSON.stringify(d)}`);
    res.json({ ok: true });
  });
  // Delete = move to Trash. It can be restored for 30 days.
  admin.delete('/products/:id', validateId, (req, res) => {
    const r = db.prepare(`UPDATE products SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`).run(req.id);
    if (!r.changes) return fail(res, 404, 'Product not found.');
    audit(req, 'product_trashed', String(req.id));
    res.json({ ok: true });
  });
  admin.post('/products/:id/restore', validateId, (req, res) => {
    const r = db.prepare(`UPDATE products SET deleted_at = NULL, status = 'draft', updated_at = datetime('now') WHERE id = ? AND deleted_at IS NOT NULL`).run(req.id);
    if (!r.changes) return fail(res, 404, 'Product not found in the Trash.');
    audit(req, 'product_restored', String(req.id));
    res.json({ ok: true });
  });
  admin.delete('/products/:id/forever', requireOwner, validateId, (req, res) => {
    const r = db.prepare('DELETE FROM products WHERE id = ? AND deleted_at IS NOT NULL').run(req.id);
    if (!r.changes) return fail(res, 404, 'Product not found in the Trash.');
    audit(req, 'product_purged', String(req.id));
    res.json({ ok: true });
  });
}
