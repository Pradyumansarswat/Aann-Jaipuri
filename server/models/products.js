import { db } from './database.js';

const PLACEHOLDER = '/assets/placeholder.svg';

// Photos are stored as [{url, alt}] (older rows may be plain strings). Always returns parallel `images` and `alts` arrays.
export function photosOf(r) {
  let list = [];
  try { list = JSON.parse(r.images); } catch { /* ignore */ }
  if (!Array.isArray(list)) list = [];
  return list.map((x) => (typeof x === 'string' ? { url: x, alt: '' } : { url: String(x?.url || ''), alt: String(x?.alt || '') })).filter((x) => x.url);
}
export function shapeProduct(r) {
  const photos = photosOf(r);
  const images = photos.length ? photos.map((x) => x.url) : [PLACEHOLDER];
  const alts = photos.length ? photos.map((x) => x.alt || r.name) : [r.name];
  return { ...r, images, alts, is_new: !!r.is_new, is_featured: !!r.is_featured };
}

export function categoriesFor(productIds) {
  if (!productIds.length) return new Map();
  const rows = db.prepare(`SELECT pc.product_id pid, c.id, c.slug, c.name FROM product_categories pc
    JOIN categories c ON c.id = pc.category_id WHERE pc.product_id IN (${productIds.map(() => '?').join(',')})
    ORDER BY c.sort, c.name`).all(...productIds);
  const map = new Map();
  for (const r of rows) (map.get(r.pid) || map.set(r.pid, []).get(r.pid)).push({ id: r.id, slug: r.slug, name: r.name });
  return map;
}

export function withCategories(rows) {
  const products = rows.map(shapeProduct);
  const map = categoriesFor(products.map((p) => p.id));
  return products.map((p) => ({ ...p, categories: map.get(p.id) || [] }));
}

export const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);

export function listCategories({ activeOnly = true, homeOnly = false } = {}) {
  const where = [activeOnly && 'c.active = 1', homeOnly && 'c.on_home = 1'].filter(Boolean).join(' AND ');
  return db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM product_categories pc JOIN products p ON p.id = pc.product_id
      WHERE pc.category_id = c.id AND p.status = 'published' AND p.deleted_at IS NULL) AS product_count
    FROM categories c ${where ? 'WHERE ' + where : ''} ORDER BY c.sort, c.name`).all();
}

const ORDERS = {
  recommended: 'p.sort ASC, p.id DESC',
  newest: 'p.created_at DESC, p.id DESC',
  name: 'p.name COLLATE NOCASE ASC',
};

export function searchProducts({ q = '', category = '', sort = 'recommended', page = 1, limit = 12 }) {
  const where = [`p.status = 'published' AND p.deleted_at IS NULL`];
  const args = [];
  if (category) {
    where.push('EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = p.id AND c.slug = ? AND c.active = 1)');
    args.push(category);
  }
  if (q) {
    const like = `%${likeEscape(q)}%`;
    where.push(`(p.name LIKE ? ESCAPE '\\' OR p.code LIKE ? ESCAPE '\\' OR p.fabric LIKE ? ESCAPE '\\' OR p.colors LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')`);
    args.push(like, like, like, like, like);
  }
  const whereSql = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) c FROM products p WHERE ${whereSql}`).get(...args).c;
  const pages = Math.max(1, Math.ceil(total / limit));
  const pg = Math.min(Math.max(1, page), pages);
  const rows = db.prepare(`SELECT p.* FROM products p WHERE ${whereSql} ORDER BY ${ORDERS[sort] || ORDERS.recommended} LIMIT ? OFFSET ?`)
    .all(...args, limit, (pg - 1) * limit);
  return { products: withCategories(rows), total, pages, page: pg };
}

export function getProductBySlug(slug) {
  const row = db.prepare(`SELECT * FROM products WHERE slug = ? AND status = 'published' AND deleted_at IS NULL`).get(slug);
  return row ? withCategories([row])[0] : null;
}

export function featuredProducts(limit = 8) {
  const rows = db.prepare(`SELECT * FROM products WHERE status = 'published' AND deleted_at IS NULL
    ORDER BY is_new DESC, is_featured DESC, sort ASC, id DESC LIMIT ?`).all(limit);
  return withCategories(rows);
}

export function relatedProducts(product, limit = 4) {
  const ids = product.categories.map((c) => c.id);
  if (!ids.length) return [];
  const rows = db.prepare(`SELECT DISTINCT p.* FROM products p JOIN product_categories pc ON pc.product_id = p.id
    WHERE p.status = 'published' AND p.deleted_at IS NULL AND p.id != ? AND pc.category_id IN (${ids.map(() => '?').join(',')})
    ORDER BY p.sort ASC, p.id DESC LIMIT ?`).all(product.id, ...ids, limit);
  return withCategories(rows);
}

// ---------------- first-party, cookie-less statistics (no IPs or personal data stored) ----------------
const today = () => new Date().toISOString().slice(0, 10);
export function countView(productId) {
  db.prepare(`INSERT INTO product_stats (product_id, day, views) VALUES (?, ?, 1)
    ON CONFLICT(product_id, day) DO UPDATE SET views = views + 1`).run(productId, today());
}
export function countEnquiryClick(productId) {
  db.prepare(`INSERT INTO product_stats (product_id, day, enquiries) VALUES (?, ?, 1)
    ON CONFLICT(product_id, day) DO UPDATE SET enquiries = enquiries + 1`).run(productId, today());
}
export function topDesigns(days = 30, limit = 8) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const rows = db.prepare(`SELECT p.id, p.code, p.name, p.slug, p.images, SUM(s.views) views, SUM(s.enquiries) enquiries
    FROM product_stats s JOIN products p ON p.id = s.product_id
    WHERE s.day >= ? AND p.deleted_at IS NULL GROUP BY p.id ORDER BY views DESC, enquiries DESC LIMIT ?`).all(since, limit);
  const totals = db.prepare('SELECT COALESCE(SUM(views),0) views, COALESCE(SUM(enquiries),0) enquiries FROM product_stats WHERE day >= ?').get(since);
  return { days, totals, designs: rows.map((r) => ({ ...r, image: shapeProduct(r).images[0], images: undefined })) };
}
