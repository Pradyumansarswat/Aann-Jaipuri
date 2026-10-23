import { html, raw, join, esc, img, waLink, WA_ICON, track, richText } from './render.js';

const paras = (text) => join(String(text).split(/\n\s*\n/).filter(Boolean), (p) => html`<p>${p}</p>`);

export function productMessage(brand, p) {
  return `Hello ${brand.name} ${brand.byline}, I would like wholesale rates and MOQ for design ${p.code} (${p.name}). Please share details.`;
}

export function productCard(p, brand) {
  const [a, b] = p.images;
  return html`<article class="pcard">
  <a class="pcard-media" href="/products/${p.slug}" tabindex="-1" aria-hidden="true">
    ${img(a, p.alts[0], { cls: 'p1', thumb: true, w: 600, h: 800 })}
    ${b ? img(b, '', { cls: 'p2', thumb: true, w: 600, h: 800 }) : ''}
    ${p.is_new ? html`<span class="tag">New</span>` : ''}
  </a>
  <div class="pcard-body">
    <h3><a href="/products/${p.slug}">${p.name}</a></h3>
    <p class="meta">${p.code}${p.fabric ? html`<span class="sep"></span>${p.fabric}` : ''}</p>
    <div class="pcard-actions">
      <a class="btn btn-wa btn-sm" href="${waLink(brand, productMessage(brand, p))}" target="_blank" rel="noopener noreferrer"${track('Enquire', { design: p.code, slug: p.slug })}>${WA_ICON}<span>Enquire</span></a>
      <a class="link" href="/products/${p.slug}">View details</a>
    </div>
  </div>
</article>`;
}

export const categoryTile = (c) => html`<a class="arch-tile" href="/products?category=${encodeURIComponent(c.slug)}">
  <span class="arch-frame">${img(c.image || '/assets/placeholder.svg', c.name, { thumb: true, w: 600, h: 800 })}</span>
  <span class="arch-text"><strong>${c.name}</strong><small>${c.tagline}</small></span>
</a>`;

export function homePage({ site, categories, featured }) {
  const { brand, home: h } = site;
  const slides = h.heroSlides;
  return html`
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="badge">${h.heroBadge}</p>
      <h1>${h.heroTitle} ${h.heroAccent ? html`<span>${h.heroAccent}</span>` : ''}</h1>
      <p class="lead">${h.heroText}</p>
      <div class="hero-cta">
        <a class="btn btn-wa" href="${waLink(brand, 'Hello, I visited your website and would like to enquire about wholesale kurti orders and catalogue rates.')}" target="_blank" rel="noopener noreferrer"${track('WhatsApp', { where: 'hero' })}>${WA_ICON}<span>${h.heroCta}</span></a>
        <a class="btn btn-ghost" href="/products">${h.heroCta2}</a>
      </div>
      <ul class="ticks">${join(h.heroPoints, (t) => html`<li>${t}</li>`)}</ul>
    </div>
    <div class="hero-arch" data-slider>
      ${join(slides, (s, i) => html`<div class="slide${i === 0 ? ' is-on' : ''}">${img(s.image, s.alt, { lazy: i > 0, priority: i === 0, w: 900, h: 1100 })}</div>`)}
    </div>
  </div>
</section>

<section class="ribbon" aria-label="What we make">
  <p class="ribbon-title">${h.strip}</p>
  <div class="marquee" aria-hidden="true"><div class="marquee-track">
    ${join([...h.marquee, ...h.marquee], (m) => html`<span>${m}</span>`)}
  </div></div>
</section>

<section class="section wrap">
  <header class="section-head">
    <p class="kicker">${h.catEyebrow}</p>
    <h2>${h.catTitle}</h2>
    <p>${h.catText}</p>
  </header>
  <div class="arch-grid">${join(categories, categoryTile)}</div>
  <p class="center"><a class="btn btn-maroon" href="/categories">All categories</a></p>
</section>

${featured.length ? html`<section class="section tint"><div class="wrap">
  <header class="section-head">
    <h2>${h.newTitle}</h2>
    <p>${h.newText}</p>
  </header>
  <div class="pgrid">${join(featured, (p) => productCard(p, brand))}</div>
  <p class="center"><a class="btn btn-maroon" href="/products">See the full collection</a></p>
</div></section>` : ''}

<section class="section wrap why">
  <header class="section-head left">
    <p class="kicker">${h.whyEyebrow}</p>
    <h2>${h.whyTitle}</h2>
    <p>${h.whyText}</p>
  </header>
  <ul class="why-list">${join(h.why, (w) => html`<li><h3>${w.title}</h3><p>${w.text}</p></li>`)}</ul>
</section>

<section class="section steps">
  <div class="wrap">
    <header class="section-head"><h2>${h.stepsTitle}</h2><p>${h.stepsText}</p></header>
    <ol class="step-list">${join(h.steps, (s, i) => html`<li><span class="num">${i + 1}</span><h3>${s.title}</h3><p>${s.text}</p></li>`)}</ol>
    <p class="center"><a class="btn btn-wa" href="${waLink(brand, 'Hello, I want to start a wholesale order. Please guide me with your current catalogue and MOQ.')}" target="_blank" rel="noopener noreferrer">${WA_ICON}<span>Start your enquiry on WhatsApp</span></a></p>
  </div>
</section>

${h.testimonials.length ? html`<section class="section wrap">
  <header class="section-head"><h2>${h.testiTitle}</h2></header>
  <div class="quotes">${join(h.testimonials, (t) => html`<figure><blockquote>${t.quote}</blockquote><figcaption><strong>${t.name}</strong>${t.role}</figcaption></figure>`)}</div>
</section>` : ''}

${h.gallery.length ? html`<section class="section wrap">
  <header class="section-head between"><h2>${h.galleryTitle}</h2>
    ${brand.instagramUrl ? html`<a class="btn btn-ghost-dark btn-sm" href="${brand.instagramUrl}" target="_blank" rel="noopener noreferrer">Follow ${brand.instagramHandle}</a>` : ''}</header>
  <div class="gallery">${join(h.gallery, (g) => html`<a href="${brand.instagramUrl || '/products'}"${brand.instagramUrl ? raw(' target="_blank" rel="noopener noreferrer"') : ''}>${img(g.image, g.alt, { thumb: true, w: 400, h: 400 })}</a>`)}</div>
</section>` : ''}

<section class="cta-band">
  <div class="wrap">
    <h2>${h.ctaTitle}</h2>
    <p>${h.ctaText}</p>
    <a class="btn btn-wa" href="${waLink(brand, 'Hello, please add my number to your wholesale broadcast list and share your latest kurti catalogue and rates.')}" target="_blank" rel="noopener noreferrer"${track('WhatsApp', { where: 'cta' })}>${WA_ICON}<span>${h.ctaButton}</span></a>
    <a class="btn btn-ghost" href="/catalogue"${track('Catalogue', { where: 'cta' })}>Download the PDF catalogue</a>
    <p class="fine">Minimum order applies. Strictly B2B wholesale.</p>
  </div>
</section>`;
}

export function productsPage({ site, result, categories, query }) {
  const { brand } = site;
  const { q, category, sort } = query;
  const href = (o) => {
    const p = new URLSearchParams();
    const m = { q, category, sort, ...o };
    for (const [k, v] of Object.entries(m)) if (v && !(k === 'sort' && v === 'recommended') && !(k === 'page' && +v === 1)) p.set(k, v);
    const s = p.toString();
    return '/products' + (s ? '?' + s : '');
  };
  const current = categories.find((c) => c.slug === category);
  return html`
<section class="page-head"><div class="wrap">
  <p class="crumbs"><a href="/">Home</a> / <span>Collection</span></p>
  <h1>${current ? current.name : 'Wholesale collection'}</h1>
  <p>${current ? current.description || current.tagline : 'Browse ready-to-dispatch designs. Wholesale rates are shared with retailers and resellers on WhatsApp.'}</p>
</div></section>
<section class="section-tight wrap">
  <form class="toolbar" method="get" action="/products" role="search">
    <label class="field grow"><span class="sr">Search designs</span>
      <input type="search" name="q" value="${q}" placeholder="Search by name, code, fabric or colour" maxlength="80"></label>
    <label class="field"><span class="sr">Category</span>
      <select name="category"><option value="">All categories</option>
      ${join(categories, (c) => html`<option value="${c.slug}"${c.slug === category ? raw(' selected') : ''}>${c.name}</option>`)}</select></label>
    <label class="field"><span class="sr">Sort</span>
      <select name="sort">${join([['recommended', 'Recommended'], ['newest', 'Newest first'], ['name', 'Name A to Z']], ([v, l]) =>
        html`<option value="${v}"${v === sort ? raw(' selected') : ''}>${l}</option>`)}</select></label>
    <button class="btn btn-maroon" type="submit">Search</button>
  </form>
  <nav class="chips" aria-label="Categories">
    <a href="${href({ category: '', page: 1 })}"${!category ? raw(' aria-current="true"') : ''}>All</a>
    ${join(categories, (c) => html`<a href="${href({ category: c.slug, page: 1 })}"${c.slug === category ? raw(' aria-current="true"') : ''}>${c.name}</a>`)}
  </nav>
  <p class="count" role="status">Showing <strong>${result.total}</strong> wholesale ${result.total === 1 ? 'design' : 'designs'}. Minimum order applies.
    <a class="link" href="${waLink(brand, 'Hello, I would like to book a live video call to select designs.')}" target="_blank" rel="noopener noreferrer">Book a live video selection</a></p>
  ${result.total ? html`<div class="pgrid">${join(result.products, (p) => productCard(p, brand))}</div>` : html`<div class="empty">
    <h2>No designs match that search</h2>
    <p>Try a different word or clear the filters. Looking for something specific? We make to order too.</p>
    <p><a class="btn btn-maroon" href="/products">Clear filters</a>
    <a class="btn btn-wa" href="${waLink(brand, `Hello, I could not find ${q || 'a design'} on your website. Can you share similar designs?`)}" target="_blank" rel="noopener noreferrer">${WA_ICON}<span>Ask us on WhatsApp</span></a></p></div>`}
  ${result.pages > 1 ? html`<nav class="pager" aria-label="Pages">
    ${result.page > 1 ? html`<a href="${href({ page: result.page - 1 })}" rel="prev">Previous</a>` : ''}
    ${join(Array.from({ length: result.pages }, (_, i) => i + 1), (n) => html`<a href="${href({ page: n })}"${n === result.page ? raw(' aria-current="page"') : ''}>${n}</a>`)}
    ${result.page < result.pages ? html`<a href="${href({ page: result.page + 1 })}" rel="next">Next</a>` : ''}
  </nav>` : ''}
</section>`;
}

export function enquiryForm({ productCode = '', note = '' } = {}) {
  return html`<form class="enquiry" method="post" action="/enquiry" data-enquiry novalidate>
  <h2>Send your requirement</h2>
  <p class="muted">Fill in your store details. We save your enquiry and you can continue the chat on WhatsApp.</p>
  <div class="grid2">
    <label class="field">Your name *<input name="name" required maxlength="80" autocomplete="name"></label>
    <label class="field">Shop or boutique name *<input name="shop" required maxlength="100" autocomplete="organization"></label>
    <label class="field">City and state *<input name="city" required maxlength="100" autocomplete="address-level2"></label>
    <label class="field">Phone or WhatsApp number<input name="phone" type="tel" maxlength="20" autocomplete="tel" inputmode="tel"></label>
  </div>
  <label class="field">Buyer type
    <select name="buyer_type">${join(['Retail boutique or store', 'Multi-brand showroom', 'Online seller or reseller', 'Regional wholesaler', 'International buyer'], (o) => html`<option>${o}</option>`)}</select></label>
  <label class="field">Your requirement *<textarea name="requirement" required rows="4" maxlength="1000" placeholder="Categories, approximate quantity, sizes, fabric">${note}</textarea></label>
  <input type="hidden" name="product_code" value="${productCode}">
  <div class="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
  <p class="form-msg" role="alert" hidden></p>
  <p class="muted consent">By sending this you agree to our <a href="/privacy">privacy policy</a>.</p>
  <button class="btn btn-maroon" type="submit">Send enquiry</button>
</form>`;
}

export function productPage({ site, p, related }) {
  const { brand } = site;
  const msg = productMessage(brand, p);
  return html`
<section class="page-head slim"><div class="wrap">
  <p class="crumbs"><a href="/">Home</a> / <a href="/products">Collection</a> / <span>${p.name}</span></p>
</div></section>
<section class="wrap detail">
  <div class="gallery-main" data-gallery>
    <div class="gm-frame"><img id="gm-img" src="${p.images[0]}" alt="${p.alts[0]}" width="900" height="1200" fetchpriority="high"></div>
    ${p.images.length > 1 ? html`<ul class="thumbs">${join(p.images, (src, i) => html`<li><a href="${src}" data-full="${src}" data-alt="${p.alts[i]}" aria-label="Show photo ${i + 1}"${i === 0 ? raw(' aria-current="true"') : ''}>${img(src, p.alts[i], { thumb: true, w: 120, h: 160 })}</a></li>`)}</ul>` : ''}
  </div>
  <div class="detail-info">
    ${p.is_new ? html`<p class="badge dark">New arrival</p>` : ''}
    <h1>${p.name}</h1>
    <p class="meta">Design code ${p.code}</p>
    ${p.categories.length ? html`<p class="chips-inline">${join(p.categories, (c) => html`<a href="/products?category=${c.slug}">${c.name}</a>`)}</p>` : ''}
    ${p.description ? html`<div class="prose">${paras(p.description)}</div>` : ''}
    <dl class="specs">
      ${p.fabric ? html`<div><dt>Fabric</dt><dd>${p.fabric}</dd></div>` : ''}
      ${p.sizes ? html`<div><dt>Sizes</dt><dd>${p.sizes}</dd></div>` : ''}
      ${p.colors ? html`<div><dt>Colours</dt><dd>${p.colors}</dd></div>` : ''}
      ${p.moq ? html`<div><dt>Minimum order</dt><dd>${p.moq}</dd></div>` : ''}
    </dl>
    <p class="muted">Wholesale rates are shared with verified retailers and resellers.</p>
    <div class="hero-cta">
      <a class="btn btn-wa" href="${waLink(brand, msg)}" target="_blank" rel="noopener noreferrer"${track('Enquire', { design: p.code, slug: p.slug })}>${WA_ICON}<span>Enquire on WhatsApp</span></a>
      <a class="btn btn-ghost-dark" href="#enquire">Send an enquiry form</a>
    </div>
  </div>
</section>
<section class="wrap section-tight" id="enquire">${enquiryForm({ productCode: p.code, note: `Interested in ${p.code} (${p.name}). ` })}</section>
${related.length ? html`<section class="section tint"><div class="wrap"><header class="section-head"><h2>More like this</h2></header>
  <div class="pgrid">${join(related, (r) => productCard(r, brand))}</div></div></section>` : ''}`;
}

export function categoriesPage({ site, categories }) {
  return html`
<section class="page-head"><div class="wrap">
  <p class="crumbs"><a href="/">Home</a> / <span>Categories</span></p>
  <h1>Wholesale categories</h1>
  <p>Choose a silhouette or craft to see matching designs, fabric details and set combinations.</p>
</div></section>
<section class="section-tight wrap">
  <div class="cat-list">${join(categories, (c) => html`<a class="cat-row" href="/products?category=${encodeURIComponent(c.slug)}">
    <span class="arch-frame small">${img(c.image || '/assets/placeholder.svg', c.name, { thumb: true, w: 300, h: 400 })}</span>
    <span><strong>${c.name}</strong><em>${c.tagline}</em><span class="desc">${c.description}</span>
      <span class="meta">${c.product_count} ${c.product_count === 1 ? 'design' : 'designs'}${c.moq ? html`<span class="sep"></span>${c.moq}` : ''}</span></span>
  </a>`)}</div>
</section>`;
}

export function aboutPage({ site }) {
  const { brand, about: a } = site;
  return html`
<section class="page-head"><div class="wrap">
  <p class="kicker light">${a.eyebrow}</p>
  <h1>${a.title}</h1>
  <p>${a.intro}</p>
  ${a.quote ? html`<blockquote class="pull">${a.quote}<cite>${a.quoteBy}</cite></blockquote>` : ''}
</div></section>
<section class="section wrap split">
  ${a.image ? html`<div class="arch-frame big">${img(a.image, brand.name, { thumb: true, w: 700, h: 900 })}</div>` : ''}
  <div class="prose"><h2>${a.visionTitle}</h2>${paras(a.visionText)}
    <ul class="why-list tight">${join(a.features, (f) => html`<li><h3>${f.title}</h3><p>${f.text}</p></li>`)}</ul></div>
</section>
${a.stats.length ? html`<section class="stats"><div class="wrap"><dl>${join(a.stats, (s) => html`<div><dt>${s.label}</dt><dd><span data-count="${s.value}">${s.value}</span>${s.suffix}</dd></div>`)}</dl></div></section>` : ''}
<section class="section wrap">
  <header class="section-head"><h2>${a.processTitle}</h2></header>
  <ol class="step-list">${join(a.process, (s, i) => html`<li><span class="num">${i + 1}</span><h3>${s.title}</h3><p>${s.text}</p></li>`)}</ol>
</section>
<section class="cta-band"><div class="wrap"><h2>Want to see the fabrics in person?</h2>
  <p>Visit our Jaipur showroom or ask for a live video walk-through.</p>
  <a class="btn btn-maroon-on" href="/contact">Contact the wholesale desk</a></div></section>`;
}

export function contactPage({ site }) {
  const { brand } = site;
  return html`
<section class="page-head"><div class="wrap">
  <p class="crumbs"><a href="/">Home</a> / <span>Contact</span></p>
  <h1>Wholesale enquiries and factory visits</h1>
  <p>Visit our Jaipur showroom to touch and feel the fabrics, or message us for catalogues and rates.</p>
</div></section>
<section class="section-tight wrap contact-grid">
  <div class="contact-info">
    <a class="btn btn-wa" href="${waLink(brand)}" target="_blank" rel="noopener noreferrer">${WA_ICON}<span>Chat on WhatsApp</span></a>
    <dl class="specs">
      <div><dt>Showroom and factory</dt><dd>${brand.address}</dd></div>
      ${brand.phone ? html`<div><dt>Wholesale helpline</dt><dd><a href="tel:${brand.phone.replace(/[^\d+]/g, '')}">${brand.phone}</a></dd></div>` : ''}
      ${brand.email ? html`<div><dt>Email</dt><dd><a href="mailto:${brand.email}">${brand.email}</a></dd></div>` : ''}
      <div><dt>Business hours</dt><dd>${brand.hours}</dd></div>
      ${brand.instagramUrl ? html`<div><dt>Instagram</dt><dd><a href="${brand.instagramUrl}" target="_blank" rel="noopener noreferrer">${brand.instagramHandle}</a></dd></div>` : ''}
    </dl>
  </div>
  <div>${enquiryForm()}</div>
</section>
${brand.mapEmbed ? html`<section class="wrap map"><iframe title="Map to our Jaipur showroom" src="${brand.mapEmbed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></section>` : ''}`;
}

export function thanksPage({ site, waUrl }) {
  return html`<section class="page-head"><div class="wrap narrow center">
  <h1>Thank you, we have your enquiry</h1>
  <p>Our wholesale team will contact you shortly. For the fastest reply, continue on WhatsApp.</p>
  <p><a class="btn btn-wa" href="${waUrl}" target="_blank" rel="noopener noreferrer">${WA_ICON}<span>Continue on WhatsApp</span></a>
  <a class="btn btn-ghost-dark" href="/products">Back to the collection</a></p></div></section>`;
}

export function notFoundPage() {
  return html`<section class="page-head"><div class="wrap narrow center">
  <h1>We could not find that page</h1>
  <p>The link may be old or the design may have sold out. Try the collection or the home page.</p>
  <p><a class="btn btn-maroon" href="/products">Browse the collection</a> <a class="btn btn-ghost-dark" href="/">Go home</a></p></div></section>`;
}

export function formErrorPage(msg) {
  return html`<section class="page-head"><div class="wrap narrow center">
  <h1>Please check your details</h1><p>${msg}</p>
  <p><a class="btn btn-maroon" href="/contact">Back to the form</a></p></div></section>`;
}

export function legalPage({ site, title, text }) {
  return html`<section class="page-head"><div class="wrap"><p class="crumbs"><a href="/">Home</a> / <span>${title}</span></p><h1>${title}</h1></div></section>
<section class="section-tight wrap"><article class="prose legal">${richText(text, site)}</article></section>`;
}

export function cataloguePage({ site, status }) {
  const { brand, catalogue: c } = site;
  const form = html`<form class="enquiry" method="post" action="/catalogue/request" data-enquiry data-kind="catalogue" novalidate>
  <h2>Get the catalogue</h2>
  <p class="muted">Tell us about your shop. The download starts on the next screen, and we send a copy by email if you add your address.</p>
  <div class="grid2">
    <label class="field">Your name *<input name="name" required maxlength="80" autocomplete="name"></label>
    <label class="field">Shop or boutique name *<input name="shop" required maxlength="100" autocomplete="organization"></label>
    <label class="field">City and state *<input name="city" required maxlength="100" autocomplete="address-level2"></label>
    <label class="field">WhatsApp or phone number<input name="phone" type="tel" maxlength="20" autocomplete="tel" inputmode="tel"></label>
  </div>
  <label class="field">Email address<input name="email" type="email" maxlength="120" autocomplete="email"></label>
  <label class="field">Buyer type
    <select name="buyer_type">${join(['Retail boutique or store', 'Multi-brand showroom', 'Online seller or reseller', 'Regional wholesaler', 'International buyer'], (o) => html`<option>${o}</option>`)}</select></label>
  <div class="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
  <p class="form-msg" role="alert" hidden></p>
  <p class="muted consent">Please give a phone number or an email so we can send updates. By continuing you agree to our <a href="/privacy">privacy policy</a>.</p>
  <button class="btn btn-maroon" type="submit">Download the catalogue</button>
</form>`;
  return html`
<section class="page-head"><div class="wrap">
  <p class="crumbs"><a href="/">Home</a> / <span>Catalogue</span></p>
  <h1>${c.title}</h1><p>${c.text}</p></div></section>
<section class="section-tight wrap contact-grid">
  <div class="contact-info">
    <ul class="why-list tight">
      <li><h3>${status.products} designs inside</h3><p>Fabrics, sizes, colours and minimum orders for every design, grouped by category.</p></li>
      <li><h3>Always current</h3><p>The PDF updates as we add new arrivals.</p></li>
      <li><h3>Rates on WhatsApp</h3><p>Wholesale rates are shared once you message us.</p></li>
    </ul>
    <p><a class="btn btn-wa" href="${waLink(brand, 'Hello, please share your latest wholesale catalogue and rates.')}" target="_blank" rel="noopener noreferrer"${track('WhatsApp', { where: 'catalogue' })}>${WA_ICON}<span>Ask on WhatsApp instead</span></a></p>
  </div>
  <div>${c.requireDetails ? form : html`<div class="enquiry"><h2>Your catalogue is ready</h2>
    <p class="muted">Free to download. PDF, ${status.products} designs.</p>
    <p><a class="btn btn-maroon" href="/catalogue.pdf" download${track('Catalogue', { where: 'download' })}>Download the PDF</a></p></div>`}</div>
</section>`;
}

export function catalogueThanksPage({ site, downloadUrl, waUrl, emailed }) {
  return html`<section class="page-head"><div class="wrap narrow center">
  <h1>Your catalogue is ready</h1>
  <p>${emailed ? 'We are also emailing you a copy. ' : ''}The link works for 24 hours.</p>
  <p><a class="btn btn-maroon" href="${downloadUrl}" download>Download the PDF</a>
  <a class="btn btn-wa" href="${waUrl}" target="_blank" rel="noopener noreferrer">${WA_ICON}<span>Get rates on WhatsApp</span></a></p></div></section>`;
}
