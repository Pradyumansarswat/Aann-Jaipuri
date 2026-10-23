// Single source of truth for CMS-editable site content.
// The admin UI renders its forms from SECTIONS, and the server validates saves with a validator built from it.
import { z } from 'zod';
import { db } from '../models/database.js';

const t = (key, label, extra = {}) => ({ key, label, type: 'text', max: 160, ...extra });
const ta = (key, label, extra = {}) => ({ key, label, type: 'textarea', max: 600, ...extra });
const img = (key, label, extra = {}) => ({ key, label, type: 'image', ...extra });

const bool = (key, label, extra = {}) => ({ key, label, type: 'bool', ...extra });

export const SECTIONS = {
  brand: {
    label: 'Brand & contact',
    help: 'Name, WhatsApp number, address and social links shown across the whole site.',
    fields: [
      t('name', 'Brand name', { required: true, max: 40 }),
      t('byline', 'Line under the logo', { max: 40 }),
      t('logoLetter', 'Logo letter', { max: 2, required: true }),
      img('logoImage', 'Logo image'),
      ta('about', 'Footer description', { max: 300 }),
      t('whatsapp', 'WhatsApp number (country code + number, digits only)', {
        type: 'digits', required: true,
        help: 'Example for India: 919876543210. Every Enquire button uses this number.'
      }),
      t('phone', 'Phone shown to visitors', { max: 30 }),
      t('email', 'Email shown to visitors', { type: 'email' }),
      ta('address', 'Showroom / factory address', { max: 300 }),
      t('hours', 'Business hours', { max: 120 }),
      t('instagramHandle', 'Instagram handle', { max: 40 }),
      t('instagramUrl', 'Instagram profile URL', { type: 'url' }),
      t('mapEmbed', 'Google Maps embed URL', {
        type: 'mapurl',
        help: 'In Google Maps choose Share, Embed a map, and copy only the src="..." address.'
      }),
      t('announcement', 'Top announcement bar text', { max: 160 }),
      t('announcementCta', 'Announcement button text', { max: 60 }),
      ta('defaultMessage', 'Default WhatsApp message', { max: 300 }),
    ],
  },
  seo: {
    label: 'Search & sharing',
    help: 'How the site looks on Google and when a link is shared on WhatsApp.',
    fields: [
      t('title', 'Home page title', { required: true, max: 70 }),
      ta('description', 'Description', { max: 200, required: true }),
      t('keywords', 'Keywords (comma separated)', { max: 300 }),
      img('ogImage', 'Share image'),
    ],
  },
  home: {
    label: 'Home page',
    help: 'Everything on the home page, top to bottom.',
    fields: [
      {
        key: 'heroSlides', label: 'Hero slides (background images)', type: 'list', max: 6, fields: [
          img('image', 'Image', { required: true }), t('alt', 'Describe the image', { max: 120 })]
      },
      t('heroBadge', 'Hero badge', { max: 80 }),
      t('heroTitle', 'Hero headline', { required: true, max: 120 }),
      t('heroAccent', 'Hero headline, second line', { max: 80 }),
      ta('heroText', 'Hero paragraph', { max: 360 }),
      t('heroCta', 'Hero main button text', { max: 40 }),
      t('heroCta2', 'Hero second button text', { max: 40 }),
      { key: 'heroPoints', label: 'Hero ticks', type: 'strings', max: 5, itemMax: 60 },
      t('strip', 'Brand strip text', { max: 120 }),
      { key: 'marquee', label: 'Scrolling ribbon items', type: 'strings', max: 14, itemMax: 50 },
      t('catEyebrow', 'Categories small heading', { max: 50 }),
      t('catTitle', 'Categories heading', { max: 80 }),
      ta('catText', 'Categories paragraph', { max: 240 }),
      t('newTitle', 'New arrivals heading', { max: 80 }),
      t('newText', 'New arrivals paragraph', { max: 200 }),
      t('whyEyebrow', 'Why us small heading', { max: 50 }),
      t('whyTitle', 'Why us heading', { max: 80 }),
      ta('whyText', 'Why us paragraph', { max: 240 }),
      {
        key: 'why', label: 'Why us points', type: 'list', max: 8, fields: [
          t('title', 'Title', { required: true, max: 60 }), ta('text', 'Text', { max: 240 })]
      },
      t('stepsTitle', 'How ordering works heading', { max: 80 }),
      ta('stepsText', 'How ordering works paragraph', { max: 240 }),
      {
        key: 'steps', label: 'Ordering steps', type: 'list', max: 6, fields: [
          t('title', 'Title', { required: true, max: 60 }), ta('text', 'Text', { max: 240 })]
      },
      t('testiTitle', 'Testimonials heading', { max: 80 }),
      {
        key: 'testimonials', label: 'Testimonials', type: 'list', max: 9, fields: [
          ta('quote', 'Quote', { required: true, max: 360 }), t('name', 'Name', { required: true, max: 60 }),
          t('role', 'Business and city', { max: 80 })]
      },
      t('galleryTitle', 'Instagram strip heading', { max: 80 }),
      {
        key: 'gallery', label: 'Instagram strip images', type: 'list', max: 8, fields: [
          img('image', 'Image', { required: true }), t('alt', 'Describe the image', { max: 120 })]
      },
      t('ctaTitle', 'Final call to action heading', { max: 100 }),
      ta('ctaText', 'Final call to action paragraph', { max: 240 }),
      t('ctaButton', 'Final call to action button', { max: 60 }),
    ],
  },
  catalogue: {
    label: 'Catalogue PDF',
    help: 'Text for the catalogue page and the PDF cover. The PDF itself is built automatically from your published products (manage it under Catalogue in the menu).',
    fields: [
      t('title', 'Catalogue page heading', { required: true, max: 100 }),
      ta('text', 'Catalogue page text', { max: 400 }),
      bool('requireDetails', 'Ask visitors for their shop details before downloading', { help: 'Recommended. Every download becomes an enquiry you can follow up on.' }),
      t('coverTitle', 'PDF cover title', { max: 60 }),
      t('coverSubtitle', 'PDF cover subtitle', { max: 100 }),
      ta('closingNote', 'PDF last page note', { max: 300 }),
    ],
  },
  legal: {
    label: 'Legal pages and GST',
    help: 'Privacy policy, terms and your GST number. In the texts you can use {{brand}}, {{legalName}}, {{email}}, {{phone}}, {{address}} and {{date}}. Start a line with ## for a heading and - for a bullet.',
    fields: [
      t('legalName', 'Registered business name', { max: 120, help: 'Shown in the footer and the legal pages. Leave blank to use the brand name.' }),
      t('gstin', 'GST number (GSTIN)', { type: 'gstin', max: 15, help: 'Shown in the footer when filled in. Leave blank to hide.' }),
      t('updated', 'Legal pages last updated', { max: 40 }),
      ta('privacy', 'Privacy policy', { max: 15000, rows: 14 }),
      ta('terms', 'Terms of use', { max: 15000, rows: 14 }),
    ],
  },
  about: {
    label: 'About page',
    help: 'Your story, numbers and manufacturing process.',
    fields: [
      t('eyebrow', 'Small heading', { max: 60 }),
      t('title', 'Page heading', { required: true, max: 120 }),
      ta('intro', 'Intro paragraph', { max: 400 }),
      ta('quote', 'Pull quote', { max: 240 }),
      t('quoteBy', 'Quote attribution', { max: 60 }),
      img('image', 'Story image'),
      t('visionTitle', 'Story heading', { max: 100 }),
      ta('visionText', 'Story text (blank line = new paragraph)', { max: 1500 }),
      {
        key: 'features', label: 'Quality promises', type: 'list', max: 6, fields: [
          t('title', 'Title', { required: true, max: 60 }), ta('text', 'Text', { max: 200 })]
      },
      {
        key: 'stats', label: 'Numbers', type: 'list', max: 4, fields: [
          t('value', 'Number (digits only)', { required: true, max: 8, type: 'digits-short' }),
          t('suffix', 'After the number (for example +)', { max: 3 }), t('label', 'Label', { required: true, max: 50 })]
      },
      t('processTitle', 'Process heading', { max: 80 }),
      {
        key: 'process', label: 'Manufacturing stages', type: 'list', max: 8, fields: [
          t('title', 'Title', { required: true, max: 60 }), ta('text', 'Text', { max: 240 })]
      },
    ],
  },
};

// ---------------- validators generated from the schema ----------------
const IMG = /^\/(uploads|assets\/seed)\/[A-Za-z0-9._-]+$/;
function fieldValidator(f) {
  const req = f.required;
  const str = (max) => z.string().trim().max(max);
  switch (f.type) {
    case 'image':
      return z.string().trim().max(200).refine((v) => v === '' || IMG.test(v), 'Choose an image from the library or upload one.')
        .refine((v) => !req || v !== '', 'Required');
    case 'digits':
      return z.string().trim().regex(/^\d{10,15}$/, 'Use digits only with country code, e.g. 919876543210');
    case 'digits-short':
      return z.string().trim().regex(/^\d{1,6}$/, 'Digits only');
    case 'email':
      return z.string().trim().max(120).refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email');
    case 'url':
      return z.string().trim().max(300).refine((v) => v === '' || /^https:\/\/[^\s"'<>]+$/.test(v), 'Must start with https://');
    case 'mapurl':
      return z.string().trim().max(1500).refine((v) => v === '' || /^https:\/\/www\.google\.com\/maps\/embed\?[^\s"'<>]+$/.test(v),
        'Must be a Google Maps embed link (https://www.google.com/maps/embed?...)');
    case 'bool':
      return z.boolean();
    case 'gstin':
      return z.string().trim().transform((v) => v.toUpperCase()).refine((v) => v === '' || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), 'Enter a valid 15-character GSTIN, for example 08ABCDE1234F1Z5');
    case 'strings':
      return z.array(str(f.itemMax || 100).min(1)).max(f.max || 10);
    case 'list': {
      const shape = Object.fromEntries(f.fields.map((x) => [x.key, fieldValidator(x)]));
      return z.array(z.object(shape).strict()).max(f.max || 10);
    }
    default: {
      const v = str(f.max || 200);
      return req ? v.min(1, 'Required') : v;
    }
  }
}
export const validators = Object.fromEntries(
  Object.entries(SECTIONS).map(([k, s]) => [k, z.object(Object.fromEntries(s.fields.map((f) => [f.key, fieldValidator(f)]))).strict()]));

// ---------------- defaults (carried over from the original site) ----------------
const S = '/assets/seed/';
export const DEFAULTS = {
  brand: {
    name: 'AANN', byline: 'by Padmavati', logoLetter: 'A', logoImage: '',
    about: "Jaipur's B2B manufacturer of authentic Sanganeri block print kurtis, cotton kurta sets, festive Anarkalis and ethnic co-ords. Wholesale enquiries only.",
    whatsapp: '919999999999', phone: '+91 99999 99999', email: 'wholesale@aannbypadmavati.com',
    address: 'AANN by Padmavati, Sitapura Industrial Area / Sanganer Textile Hub, Jaipur, Rajasthan 302022',
    hours: 'Monday to Saturday, 10:00 AM to 7:30 PM IST',
    instagramHandle: '@aann_by_padmavati', instagramUrl: 'https://instagram.com/aann_by_padmavati',
    mapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d113911.20573097582!2d75.72051791240022!3d26.848692971283235!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x396db5f91628b921%3A0x49b008949e84870b!2sJaipur%2C%20Rajasthan!5e0!3m2!1sen!2sin',
    announcement: 'Direct from our Jaipur factory. Strictly wholesale and B2B orders only.',
    announcementCta: 'Get the latest catalogue',
    defaultMessage: 'Hello AANN by Padmavati, I am a retailer interested in wholesale Jaipuri kurtis. Please share your catalogue and wholesale rates.',
  },
  seo: {
    title: 'AANN by Padmavati | Wholesale Jaipuri Kurtis Manufacturer in Jaipur',
    description: 'Authentic Jaipuri kurtis made for retailers. Manufacturer and wholesaler of block print, cotton, rayon and embroidered ethnic wear, direct from Jaipur.',
    keywords: 'wholesale Jaipuri kurtis, kurti manufacturer Jaipur, block print kurtis wholesale, B2B ethnic wear, AANN by Padmavati',
    ogImage: S + 'og.svg',
  },
  home: {
    heroSlides: [
      { image: S + 'hero-1.svg', alt: 'Block print kurtis framed by jharokha arches' },
      { image: S + 'hero-2.svg', alt: 'Indigo Bagru prints' },
      { image: S + 'hero-3.svg', alt: 'Festive Anarkali prints' },
    ],
    heroBadge: "Jaipur's B2B kurti house",
    heroTitle: 'Authentic Jaipuri kurtis,', heroAccent: 'made for retailers',
    heroText: 'We supply boutiques, multi-brand outlets and resellers with hand-blocked Sanganeri prints, pure 60x60 cottons and festive ethnic sets, direct from our Jaipur manufacturing unit.',
    heroCta: 'Chat on WhatsApp', heroCta2: 'View the collection',
    heroPoints: ['Wholesale enquiries welcome', 'Set-to-set and assorted bulk', 'Pan-India dispatch'],
    strip: 'Direct from Jaipur. Wholesale only. Bulk orders.',
    marquee: ['Pure 60x60 cotton kurtis', 'Sanganeri block print', 'Heavy rayon slub', 'Kurti with pant and dupatta sets',
      'Festive Anarkali suits', 'Ethnic co-ord sets', 'Handwork and gota patti', 'Plus size up to 5XL'],
    catEyebrow: 'Curated for boutiques', catTitle: 'Signature wholesale categories',
    catText: 'High-turnover silhouettes made with colour-fast dyes and shrinkage-tested fabrics.',
    newTitle: 'New season arrivals', newText: 'Ready stock for immediate dispatch. Message us for the catalogue and rates.',
    whyEyebrow: 'The AANN advantage', whyTitle: 'Why 1,200+ retailers partner with us',
    whyText: 'Built to give boutique owners, regional wholesalers and online sellers healthy margins and repeat customers.',
    why: [
      { title: 'Manufacturer direct', text: 'In-house cutting, stitching and finishing in Jaipur with no middlemen markups.' },
      { title: 'High-margin bulk rates', text: 'Factory rates structured so retailers keep strong retail profitability.' },
      { title: 'Grade-A fabric', text: 'Certified 60x60 cambric cotton, heavy 14kg rayon and triple-checked stitching.' },
      { title: '24 to 48 hour dispatch', text: 'Ready inventory across all core designs with trusted transport and courier partners.' },
      { title: 'Custom and private label', text: 'Make-to-order bulk production and custom brand tagging for large volume buyers.' },
      { title: 'Simple B2B process', text: 'No portals to learn. Our Jaipur sales team assists you directly on WhatsApp.' },
    ],
    stepsTitle: 'How wholesale ordering works', stepsText: 'Personal help from our Jaipur sales team, directly on WhatsApp.',
    steps: [
      { title: 'Browse the collection', text: 'Explore by fabric or silhouette. Shortlist design codes or ask for the complete PDF lookbook.' },
      { title: 'Message us on WhatsApp', text: 'Tap Enquire on any design. We share wholesale rates, live video previews and MOQ details.' },
      { title: 'Confirm and dispatch', text: 'Receive your GST invoice, confirm your sets and get tracking details within 24 to 48 hours.' },
    ],
    testiTitle: 'What boutique and store owners say',
    testimonials: [
      { quote: 'We have sourced Sanganeri cotton kurta sets from AANN by Padmavati for 3 years. Zero colour bleeding complaints and our boutique clients love the fit.', name: 'Meenakshi Sharma', role: 'Owner, Rivaayat Boutique, Ahmedabad' },
      { quote: 'Their WhatsApp video call selection makes restocking so easy. Accurate sizing from M to XXL and parcels always reach Hyderabad on time.', name: 'Rajeshwar Rao', role: 'Ethnic wear wholesaler, Secunderabad' },
      { quote: 'True 60x60 cambric cotton at genuine Jaipur factory rates. Their festive Anarkali and co-ord sets sold out at our exhibition within two days.', name: 'Sneha Kulkarni', role: 'Founder, Saanjh Studio, Pune' },
    ],
    galleryTitle: 'Live dispatch and new drops',
    gallery: [1, 2, 3, 4, 5, 6].map((i) => ({ image: `${S}gallery-${i}.svg`, alt: 'Jaipuri block print fabric' })),
    ctaTitle: 'Ready to stock fast-selling Jaipuri kurtis?',
    ctaText: 'Message us your shop name and city to receive daily broadcast updates, PDF catalogues and factory wholesale rates.',
    ctaButton: 'Get the wholesale catalogue on WhatsApp',
  },
  catalogue: {
    title: 'Download our wholesale catalogue',
    text: 'Get the latest designs, fabrics, sizes and minimum orders in one PDF. Tell us a little about your shop and the catalogue is ready to download straight away. We will also send you updates on new arrivals if you would like.',
    requireDetails: true,
    coverTitle: 'Wholesale Catalogue', coverSubtitle: 'Authentic Jaipuri kurtis, direct from our factory',
    closingNote: 'Rates, minimum orders and live video selection are available on WhatsApp. Strictly wholesale. Minimum order applies.',
  },
  legal: {
    legalName: '', gstin: '', updated: 'October 2026',
    privacy: `## Who we are
{{legalName}} ("we", "us") is a Jaipur-based manufacturer and wholesaler of kurtis. This policy explains what personal information this website collects, why, and the choices you have. Wholesale customers only: this website is not meant for children.

## What we collect
- Enquiry form: your name, shop or boutique name, city, phone or WhatsApp number (optional), buyer type and the message you write.
- Catalogue request: the same details plus your email address if you give one.
- WhatsApp: if you choose to continue on WhatsApp, the conversation takes place on WhatsApp (Meta) under its own privacy policy.
- Technical data: our hosting servers keep short-lived technical logs (such as IP address and browser type) for security and fault-finding.
- Visitor statistics: we count page views and clicks on enquiry buttons to learn which designs interest buyers. This does not use advertising cookies or follow you across other sites.
- Cookies: visitors receive no cookies. A login cookie is used only for our staff signing in to the website manager.

## Why we use it
- To reply to your enquiry, send you the catalogue and rates, and manage wholesale orders.
- To keep the website secure and working.
- To understand which products are popular.
We do not sell your information and we do not use it for third-party advertising.

## Who sees it
Only our team. We use trusted service providers to run the website, such as hosting, email delivery and privacy-friendly analytics, and they may process data for us under their own terms. We may disclose information if the law requires it.

## How long we keep it
We keep enquiry details for as long as needed to deal with your request and our business relationship, and delete them when you ask us to or when they are no longer needed.

## Your choices
You may ask us to show you the information we hold about you, correct it, or delete it, and you may withdraw your consent at any time. Write to us at {{email}} or call {{phone}}. We will respond within a reasonable time, as required by applicable Indian law, including the Digital Personal Data Protection Act, 2023.

## Security
We protect the website with encryption in transit, restricted staff access and regular updates. No system is completely secure, so please do not send sensitive personal information such as bank or card details through the enquiry form.

## Changes and contact
We may update this policy and will change the date below when we do. Questions or complaints: {{legalName}}, {{address}}, {{email}}.

Last updated: {{date}}`,
    terms: `## About this website
This website is the wholesale catalogue of {{legalName}} ("we", "us"), {{address}}. By using it you agree to these terms.

## Wholesale only
Our designs are offered to retailers, boutiques, resellers and other business buyers. A minimum order applies and may differ by design or category.

## Products, prices and availability
- Photos and colours on screen may differ slightly from the actual fabric, print and finish. Hand block printing means small natural variations are normal.
- Designs, fabrics, sizes and stock change often, and a design shown may be sold out.
- Wholesale prices are not published on the website. Rates are shared on request by WhatsApp, phone or email and may change without notice.
- Nothing on this website is a binding offer. An order is confirmed only when we confirm it in writing (including by WhatsApp or email) and the agreed payment terms are met.

## Orders, payment and dispatch
Order quantities, payment terms, dispatch timelines, returns for manufacturing defects and transport arrangements are agreed with you at the time of your order and set out in our invoice.

## Intellectual property
Photographs, designs, text and the brand name on this website belong to us or our licensors. You may share product images with us or use them to promote our products you have purchased, but you may not copy the website, resell the images or present our designs as your own.

## Acceptable use
Do not misuse the website, attempt to disrupt or break into it, send spam or false enquiries, or use automated tools to copy its content.

## Liability
We try to keep the information accurate but provide the website "as is". To the extent permitted by law, we are not liable for losses arising from using the website or relying on its content, including temporary unavailability.

## Privacy
Our Privacy Policy explains how we handle your information.

## Governing law
These terms are governed by the laws of India. Courts at Jaipur, Rajasthan have jurisdiction.

## Contact
{{legalName}}, {{address}}, {{email}}, {{phone}}.

Last updated: {{date}}`,
  },
  about: {
    eyebrow: 'Our story, Jaipur, Rajasthan',
    title: 'Rooted in heritage craft, built for modern retail',
    intro: "AANN by Padmavati bridges centuries-old Rajasthani textile artistry with disciplined, scale-ready garment manufacturing for India's growing fashion retailers.",
    quote: "Every block print and stitch carries the signature warmth of Jaipur's master karigars.", quoteBy: 'House of Padmavati',
    image: S + 'about.svg',
    visionTitle: 'Empowering boutiques and apparel buyers',
    visionText: 'Born in the textile hub of Jaipur, AANN by Padmavati was set up with one purpose: to give independent boutique owners, multi-brand ethnic outlets and resellers direct access to authentic Jaipuri kurtis without inconsistent sizing or middleman markups.\n\nFrom sourcing pure 60x60 grey fabric and partnering with hereditary Sanganer and Bagru block-printers, to computerised pattern grading and multi-stage quality checks, our whole value chain is built for retail success.',
    features: [
      { title: '100% colour-fast', text: 'Pre-shrunk and cured natural and azo-free pigments.' },
      { title: 'Standardised sizing', text: 'True-to-measure specs from M (38) up to 5XL (50).' },
    ],
    stats: [
      { value: '14', suffix: '+', label: 'Years of experience' }, { value: '2500', suffix: '+', label: 'Exclusive kurti designs' },
      { value: '1200', suffix: '+', label: 'Retailers and boutiques served' }, { value: '180', suffix: '+', label: 'Cities delivered across India' },
    ],
    processTitle: 'From loom to storefront: our 5-stage process',
    process: [
      { title: 'Mill fabric sourcing', text: 'High-thread-count 60x60 cambric cotton, mulmul and Liva-grade rayon slub.' },
      { title: 'Sanganeri printing', text: 'Traditional hand-block and precision screen printing, washed for colour permanency.' },
      { title: 'Precision stitching', text: 'Interlock finishing, reinforced seams and accurate armhole and bust grading across sizes.' },
      { title: 'Handwork and adda', text: 'Artisanal gota patti, mirror work, zari embroidery and kantha necklines.' },
      { title: 'QC and set packing', text: 'Steam ironing, thread checking, individual poly-packaging and size tagging.' },
    ],
  },
};

// ---------------- read/write with in-memory cache ----------------
let cache = null;
export function getContent() {
  if (cache) return cache;
  const out = structuredClone(DEFAULTS);
  for (const row of db.prepare('SELECT section, data FROM content').all()) {
    if (!validators[row.section]) continue;
    try {
      const parsed = validators[row.section].safeParse({ ...out[row.section], ...JSON.parse(row.data) });
      if (parsed.success) out[row.section] = parsed.data;
    } catch { /* ignore corrupt row, fall back to defaults */ }
  }
  cache = out;
  return out;
}
export function saveSection(section, data) {
  db.prepare(`INSERT INTO content (section, data, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(section) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
    .run(section, JSON.stringify(data));
  cache = null;
}
export function resetSection(section) {
  db.prepare('DELETE FROM content WHERE section = ?').run(section);
  cache = null;
}
export function bustContentCache() { cache = null; }
