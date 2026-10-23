import fs from 'node:fs';
import { db, slugify } from '../models/database.js';

const S = '/assets/seed/';
const CATS = [
  ['Cotton Kurtis', 'Pure 60x60 cambric and mulmul', 'All-season breathable Jaipuri cotton kurtis with zero shrinkage and high repeat demand.', 'Set of 4 (M, L, XL, XXL)'],
  ['Rayon Kurtis', 'Heavy 14kg Liva-grade rayon slub', 'Rich drape and vibrant foil and pigment prints, ideal for daily and office wear retail.', 'Set of 4 (M to XXL)'],
  ['Anarkali', 'Full-flared kalidar silhouettes', '16-kali and 24-kali traditional Jaipuri Anarkalis with gota patti and dori work.', 'Set of 4 sizes'],
  ['Straight Cut', 'Everyday boutique staples', 'Clean-tailored straight kurtis with kantha work, wooden buttons and smart necklines.', 'Set of 4 (M to XXL)'],
  ['Kurti with Pant Sets', '2-piece and 3-piece complete sets', 'Coordinated kurta, comfortable afghani or straight pants and full-length printed malmal dupattas.', 'Set of 4 sizes'],
  ['Co-ord Sets', 'Contemporary ethnic fusion', 'Fast-moving printed ethnic co-ord sets for modern boutiques and online stores.', 'Set of 4 (M to XXL)'],
  ['Block Print', 'Authentic Sanganeri, Bagru and Dabu', "Handcrafted heritage motifs stamped by Jaipur's traditional artisan families.", 'Set of 4 sizes'],
  ['Embroidered', 'Zari, mirror, sequin and thread work', 'Intricate yoke and sleeve embroidery on premium cotton, muslin and chanderi.', 'Set of 4 sizes'],
  ['Party Wear', 'Festive muslin, Roman silk and chanderi', 'Boutique-grade occasion wear with heavy handwork for festive and wedding stock.', 'Set of 4 sizes'],
  ['Plus Size', 'True comfort grading, 3XL to 5XL', 'Specially contoured armhole and bust grading in best-selling Jaipuri prints.', 'Set of 3 (3XL, 4XL, 5XL)'],
];

export function seedIfEmpty() {
  if (db.prepare(`SELECT 1 FROM content WHERE section = '_seeded'`).get()) return;
  const ids = {};
  db.transaction(() => {
    const insCat = db.prepare('INSERT INTO categories (slug, name, tagline, description, moq, image, sort, active, on_home) VALUES (?,?,?,?,?,?,?,1,?)');
    CATS.forEach(([name, tagline, description, moq], i) => {
      const slug = slugify(name);
      ids[name] = Number(insCat.run(slug, name, tagline, description, moq, `${S}cat-${slug}.svg`, (i + 1) * 10, i < 6 ? 1 : 0).lastInsertRowid);
    });
    const insP = db.prepare(`INSERT INTO products (code, slug, name, description, fabric, sizes, colors, moq, images, is_new, is_featured, status, sort)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'published',?)`);
    const link = db.prepare('INSERT INTO product_categories (product_id, category_id) VALUES (?,?)');
    for (const p of JSON.parse(fs.readFileSync(new URL('../seed-products.json', import.meta.url), 'utf8'))) {
      const code = p.code.toLowerCase();
      const desc = `${p.name} in ${p.fabric.toLowerCase()}. Available in ${p.colors.toLowerCase()}. Ready stock for wholesale orders.`;
      const pid = Number(insP.run(p.code, slugify(`${p.name} ${p.code}`), p.name, desc, p.fabric, p.sizes, p.colors, p.moq,
        JSON.stringify([`${S}${code}-a.svg`, `${S}${code}-b.svg`]), +p.is_new, +p.is_new, p.sort).lastInsertRowid);
      for (const c of p.categories) if (ids[c]) link.run(pid, ids[c]);
    }
    db.prepare(`INSERT INTO content (section, data) VALUES ('_seeded', '1')`).run();
  })();
  console.log('[seed] Loaded starter categories and designs. Replace them from the CMS at /admin.');
}
