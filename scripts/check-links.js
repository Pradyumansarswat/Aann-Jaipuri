// Crawls the running site and reports any broken internal link, image, script, stylesheet or font.
// Usage: npm run check-links [-- http://localhost:3000]
const base = (process.argv[2] || process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const seen = new Map(), queue = ['/'], broken = [], external = new Set();
const attr = /\b(?:href|src|data-full)=["']([^"']+)["']/g;
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

async function check(path, from) {
  if (seen.has(path)) return;
  const res = await fetch(base + path, { redirect: 'follow' }).catch(() => null);
  seen.set(path, res?.status ?? 0);
  if (!res || res.status >= 400) { broken.push({ path, status: res?.status ?? 'no response', from }); return; }
  if (!(res.headers.get('content-type') || '').includes('text/html')) { await res.arrayBuffer(); return; }
  const html = await res.text();
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(attr)) {
    const u = decode(m[1]);
    if (/^(mailto:|tel:|javascript:|data:)/.test(u)) continue;
    if (u.startsWith('#')) { if (u.length > 1 && !ids.has(u.slice(1))) broken.push({ path: u, status: 'missing anchor', from: path }); continue; }
    if (/^https?:\/\//.test(u)) { if (!u.startsWith(base)) { external.add(u.split('?')[0]); continue; } queue.push(u.slice(base.length) || '/'); continue; }
    const abs = new URL(u, base + path);
    if (abs.pathname.startsWith('/admin') || abs.pathname === '/api') continue;
    queue.push(abs.pathname + abs.search);
  }
}
while (queue.length) { const p = queue.shift(); const clean = p.split('#')[0]; await check(clean, 'crawl'); }
console.log(`Checked ${seen.size} internal URLs on ${base}`);
if (external.size) console.log(`External links (not tested, open in a browser to confirm):\n  ${[...external].join('\n  ')}`);
if (broken.length) { console.error(`\n${broken.length} BROKEN:`); for (const b of broken) console.error(`  ${b.status}  ${b.path}  (found on ${b.from})`); process.exit(1); }
console.log('No broken internal links.');
