// Tiny server-side templating. Every interpolated value is HTML-escaped unless wrapped in raw().
import { config } from '../config.js';
import { thumbOf } from '../services/uploads.js';

class Raw { constructor(s) { this.s = s; } }
export const raw = (s) => new Raw(String(s));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => {
    const part = Array.isArray(v) ? v.map((x) => (x instanceof Raw ? x.s : esc(x))).join('')
      : v instanceof Raw ? v.s : esc(v);
    out += part + strings[i + 1];
  });
  return new Raw(out);
}
export const join = (arr, fn) => raw(arr.map((x, i) => { const r = fn(x, i); return r instanceof Raw ? r.s : esc(r); }).join(''));

export const waLink = (brand, message) =>
  `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(message || brand.defaultMessage)}`;

export const WA_ICON = raw('<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.3 15l-.3-.19-3.1.82.83-3.03-.2-.31A8.1 8.1 0 0 1 12.04 3.8Zm-3 3.9c-.2 0-.5.07-.77.36-.26.3-1 1-1 2.4s1.03 2.8 1.17 3c.15.2 2 3.2 4.95 4.35 2.45.96 2.95.77 3.48.72.53-.05 1.7-.7 1.94-1.37.24-.68.24-1.26.17-1.38-.07-.12-.27-.2-.56-.34-.3-.15-1.7-.84-1.97-.94-.26-.1-.46-.14-.65.15-.2.3-.75.94-.92 1.13-.17.2-.34.22-.63.07-.3-.14-1.23-.45-2.34-1.44-.87-.77-1.45-1.72-1.62-2.01-.17-.3-.02-.45.13-.6.13-.13.3-.34.43-.5.15-.17.2-.3.3-.48.1-.2.05-.37-.02-.52-.08-.15-.65-1.58-.9-2.16-.23-.55-.47-.48-.65-.49h-.55Z"/></svg>');

export const img = (src, alt, { cls = '', lazy = true, thumb = false, priority = false, w, h } = {}) =>
  html`<img src="${thumb ? thumbOf(src) : src}" alt="${alt || ''}"${cls ? raw(` class="${esc(cls)}"`) : ''}${w ? raw(` width="${+w}" height="${+h}"`) : ''}${priority ? raw(' fetchpriority="high"') : lazy ? raw(' loading="lazy" decoding="async"') : ''}>`;

const NAV = [
  ['/', 'Home'], ['/products', 'Collection'], ['/categories', 'Categories'], ['/catalogue', 'Catalogue'], ['/about', 'About us'], ['/contact', 'Contact'],
];

// data-track attributes feed the click counters in site.js (first-party stats and Plausible/Umami events).
export const track = (name, props = {}) => raw(` data-track="${esc(name)}"` + Object.entries(props).map(([k, v]) => ` data-track-${esc(k)}="${esc(v)}"`).join(''));

const TOKENS = (site) => ({
  brand: `${site.brand.name} ${site.brand.byline}`.trim(), legalName: site.legal.legalName || `${site.brand.name} ${site.brand.byline}`.trim(),
  email: site.brand.email || 'our contact page', phone: site.brand.phone || '', address: site.brand.address, date: site.legal.updated || '',
});
// Turns the CMS legal text into safe HTML: "## " headings, "- " bullets, blank-line paragraphs. Everything is escaped.
export function richText(text, site) {
  const t = TOKENS(site);
  const filled = String(text).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in t ? t[k] : m));
  const blocks = filled.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return raw(blocks.map((b) => {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    const out = []; let list = [];
    const flush = () => { if (list.length) { out.push(`<ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`); list = []; } };
    for (const l of lines) {
      if (l.startsWith('## ')) { flush(); out.push(`<h2>${esc(l.slice(3))}</h2>`); }
      else if (l.startsWith('- ')) list.push(l.slice(2));
      else { flush(); out.push(`<p>${esc(l)}</p>`); }
    }
    flush();
    return out.join('');
  }).join(''));
}

export function layout({ site, req, title, description, image, path = '/', body, jsonLd, noindex = false, scripts = ['/assets/js/site.js'] }) {
  const { brand, seo } = site;
  const canonical = config.siteUrl + path;
  const ogImage = config.siteUrl + (image || seo.ogImage || '/assets/seed/og.svg');
  const fullTitle = title ? `${title} | ${brand.name} ${brand.byline}` : seo.title;
  const desc = description || seo.description;
  const active = (p) => (p === '/' ? path === '/' : path.startsWith(p));
  return '<!doctype html>' + html`<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title>
<meta name="description" content="${desc}">
${seo.keywords && !title ? raw(`<meta name="keywords" content="${esc(seo.keywords)}">`) : ''}
${noindex ? raw('<meta name="robots" content="noindex, nofollow">') : raw(`<link rel="canonical" href="${esc(canonical)}">`)}
<meta name="theme-color" content="#5C1624">
<meta property="og:type" content="${jsonLd?.['@type'] === 'Product' ? 'product' : 'website'}">
<meta property="og:site_name" content="${brand.name} ${brand.byline}">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/fraunces-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/hanken-grotesk.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css?v=2">
${jsonLd ? raw(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`) : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${brand.announcement ? html`<div class="announce"><p>${brand.announcement}
  ${brand.announcementCta ? html` <a href="/catalogue">${brand.announcementCta}</a>` : ''}</p></div>` : ''}
<header class="site-header" id="top">
  <div class="wrap bar">
    <a class="logo" href="/" aria-label="${brand.name} ${brand.byline}, home">
      ${brand.logoImage ? html`<img class="logo-image" src="${brand.logoImage}" alt="" aria-hidden="true">` : html`<span class="logo-mark" aria-hidden="true">${brand.logoLetter}</span>`}
      <span class="logo-text"><b>${brand.name}</b><small>${brand.byline}</small></span>
    </a>
    <nav class="nav" id="nav" aria-label="Main">
      ${join(NAV, ([href, label]) => html`<a href="${href}"${active(href) ? raw(' aria-current="page"') : ''}>${label}</a>`)}
    </nav>
    <div class="bar-actions">
      <a class="btn btn-wa btn-sm" href="${waLink(brand)}" target="_blank" rel="noopener noreferrer">${WA_ICON}<span>WhatsApp</span></a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
<main id="main">${body}</main>
<footer class="site-footer">
  <div class="jaali" aria-hidden="true"></div>
  <div class="wrap foot-grid">
    <div>
      <p class="foot-brand"><b>${brand.name}</b> ${brand.byline}</p>
      <p>${brand.about}</p>
      <p class="muted">Strictly wholesale enquiries.</p>
      ${site.legal.gstin ? html`<p class="gst">GSTIN: <strong>${site.legal.gstin}</strong></p>` : ''}
    </div>
    <div>
      <h2>Explore</h2>
      <ul>${join(NAV, ([href, label]) => html`<li><a href="${href}">${label}</a></li>`)}</ul>
    </div>
    <div>
      <h2>Wholesale desk</h2>
      <address>
        ${brand.address}<br>
        ${brand.phone ? html`<a href="tel:${brand.phone.replace(/[^\d+]/g, '')}">${brand.phone}</a><br>` : ''}
        ${brand.email ? html`<a href="mailto:${brand.email}">${brand.email}</a><br>` : ''}
        ${brand.hours}
      </address>
      <p class="foot-links">
        <a href="${waLink(brand)}" target="_blank" rel="noopener noreferrer">WhatsApp us</a>
        ${brand.instagramUrl ? html` <a href="${brand.instagramUrl}" target="_blank" rel="noopener noreferrer">Instagram ${brand.instagramHandle}</a>` : ''}
      </p>
    </div>
  </div>
  <div class="wrap copy"><p>&copy; ${new Date().getFullYear()} ${site.legal.legalName || `${brand.name} ${brand.byline}`}, Jaipur. All rights reserved. Wholesale only. Minimum order applies.</p>
    <p class="legal-links"><a href="/privacy">Privacy policy</a> <a href="/terms">Terms of use</a> <a href="/catalogue">Catalogue</a></p></div>
</footer>
<a class="wa-float" href="${waLink(brand)}" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">${WA_ICON}</a>
${join(scripts, (s) => raw(`<script src="${esc(s)}?v=2" defer></script>`))}
${config.analytics ? (config.analytics.provider === 'plausible'
  ? raw(`<script defer data-domain="${esc(config.analytics.site)}" src="${esc(config.analytics.src)}"></script>`)
  : raw(`<script defer src="${esc(config.analytics.src)}" data-website-id="${esc(config.analytics.site)}" data-do-not-track="true"></script>`)) : ''}
</body>
</html>`.s;
}
