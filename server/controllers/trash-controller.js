import { db } from '../models/database.js';

export const TRASH_DAYS = 30;

export function purgeOld() {
  const products = db.prepare(`DELETE FROM products WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)`).run(`-${TRASH_DAYS} days`);
  db.prepare(`DELETE FROM product_stats WHERE day < date('now', '-400 days')`).run();
  return products.changes;
}
