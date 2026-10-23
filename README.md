# AANN by Padmavati: Jaipuri kurtis wholesale site

A complete website for a Jaipuri kurti wholesaler: public storefront, secure backend, and a CMS (site manager) at `/admin` that controls everything visitors see.

## Start in 3 steps

```bash
npm install
npm run setup      # creates .env with random secrets and prints your admin password once
npm start          # open http://localhost:3000  (CMS at /admin)
```

Needs Node.js 20.19 or newer. On first start the site loads 10 starter designs and 10 categories so it is never empty.

## First things to do in the CMS (`/admin`)

1. **Brand and contact**: set your real WhatsApp number (country code + number, digits only, e.g. `919876543210`), phone, email, address and Instagram. Until you do, the dashboard shows a warning.
2. **Categories and Products**: edit or delete the starter ones and add your own with real photos.
3. **Home page / About page**: replace the starter text, numbers and testimonials with your real ones.
4. **Password and security**: change the generated password, then delete `ADMIN_PASSWORD` from `.env`.

The starter product pictures are generated illustrations. Replace them with your own photos (upload in the product editor; photos are resized and converted to fast WebP automatically).

## What the CMS controls

| Area | You can change |
| --- | --- |
| Products | Add, edit, delete, hide (draft), mark New or Featured, import up to 60 products from Excel, up to 8 photos, categories, fabric, sizes, colours, MOQ, order |
| Categories | Name, tagline, description, image, MOQ, visibility, show on home |
| Home page | Hero slides and text, ribbon, section headings, why-us points, ordering steps, testimonials, Instagram strip, final call to action |
| About page | Story, quote, numbers, quality promises, manufacturing process |
| Brand and contact | Name, logo letter, WhatsApp, phone, email, address, hours, map, announcement bar |
| Search and sharing | Google title and description, WhatsApp/social share image |
| Enquiries | Every contact-form enquiry is saved here with status, WhatsApp shortcut, CSV download |
| Images | Library of uploaded photos |

Changes go live instantly.

## Security

- **Secrets never reach the browser.** Session secret, admin credentials and SMTP password live only in `.env` on the server. The WhatsApp number is public by nature and is managed in the CMS.
- Admin passwords hashed with scrypt; sign-in lockout after 5 failed tries; rate limits on every public and admin endpoint.
- Server-side sessions in the database: random token, HMAC-hashed at rest, `HttpOnly`, `SameSite=Strict`, `Secure` in production; 2-hour idle and 12-hour absolute expiry.
- CSRF protection (per-session token plus same-origin check) on every change.
- Strict Content-Security-Policy with no inline scripts or styles, HSTS, no framing, no sniffing, locked-down permissions policy.
- All input validated with schemas; SQL is parameterised; all output is HTML-escaped; links and map URLs in the CMS are restricted to safe patterns.
- Uploads: real image bytes verified (not file names), re-encoded to WebP (this removes hidden code and GPS data), random file names, SVG not accepted.
- Enquiry form: honeypot, per-IP limits, header-injection-safe email notifications, spreadsheet-formula-safe CSV export.
- Admin actions are written to an activity log (visible on the dashboard).

## Added in version 2

**Admin safety**
- **Two-factor sign-in:** CMS, Password and security. Works with Google Authenticator, Microsoft Authenticator, Authy and 1Password. You get 8 one-time recovery codes. Secrets are encrypted in the database, codes cannot be replayed, and wrong codes lock sign-in for 15 minutes after 5 tries.
- **Users and roles:** CMS, Users (owners only). *Owner* manages everything including users; *Editor* manages products, pages and enquiries. Each person gets their own login, and every action is in the activity log.
- **Trash:** deleting a product moves it to Trash for 30 days. Restore it as a draft, or (owner) delete it for good. Its design code stays reserved while it is in Trash.

**Faster catalogue work**
- **Alt text per photo** in the product editor (helps Google Images and screen readers).
- **Bulk add:** CMS, Bulk add. Drop up to 60 photos, set shared details once, check names/codes/alt text, create them all as drafts or published. Codes auto-number from your prefix.
- **Excel product import:** Upload an `.xlsx` workbook or `.csv` exported from Excel with `code` and `name` columns. Optional columns are `description`, `fabric`, `sizes`, `colors`, `moq`, and `categories` (comma-separated category names). Review the preview, import up to 60 rows as drafts without images, then add photos later in each product editor. A blank CSV template is available on the Bulk add page.

**Catalogue PDF**
- Visitors get a PDF lookbook built automatically from your published products (grouped by category, with your contact details). It rebuilds itself when products change.
- By default visitors fill a short form first. That saves them as a lead (Enquiries, marked "catalogue request"), gives a signed 24-hour download link, and emails the PDF too if email alerts (SMTP) are set up. Turn the form off under CMS, Catalogue page text.
- Prefer a designed brochure? Upload your own PDF under CMS, Catalogue PDF and it replaces the automatic one.
- The automatic PDF uses Latin letters only (English product names). Use your own PDF for Hindi text.

**Legal**
- `/privacy` and `/terms` pages, editable under CMS, Legal pages and GST. Use `{{brand}}`, `{{email}}` etc. in the text. **The starter texts are a template: have your lawyer review them and check every statement matches how the business really works before going live.**
- Add the registered name and GSTIN there and they appear in the footer and PDF. Leave blank to hide.
- The enquiry forms link to the privacy policy.

**Analytics**
- **Built in, nothing to set up:** the dashboard shows which designs get the most views and enquiry-button clicks in the last 30 days. It uses no cookies and stores no IP addresses or personal data.
- **Visitor reports (optional):** add a Plausible or Umami account and fill the `ANALYTICS_*` lines in `.env`. The site's security policy then allows only that one host. Enquiry clicks are sent as events named `Enquire` (with the design code), `WhatsApp` and `Catalogue`; create them as goals in Plausible, or view them as events in Umami.

**Monitoring**
- **Uptime:** in UptimeRobot create an HTTP(S) monitor for `https://yourdomain.com/healthz` with keyword `"ok":true`, 5-minute interval, and alerts to the client's email or WhatsApp-capable channel. Optionally also set `HEARTBEAT_URL` (UptimeRobot heartbeat or Healthchecks.io) so you are told if the server itself stops.
- **Errors:** create a Node project at sentry.io and put its DSN in `SENTRY_DSN`. Server errors are reported with visitor data (names, enquiry text, cookies) removed before sending.
- The dashboard has a **Go-live checklist** that shows what is still switched off.

## Going live

1. Run it on any Node host (VPS, Render, Railway, Fly) **behind HTTPS**.
2. In `.env` set `NODE_ENV=production`, `SITE_URL=https://yourdomain.com`, and `TRUST_PROXY=1` if you use a proxy or Cloudflare.
3. Keep the `data/` folder on persistent storage and back it up (it holds the database and uploaded photos).
4. Optional email alerts for new enquiries: fill the `SMTP_*` and `NOTIFY_EMAIL` lines in `.env`.
5. Submit `https://yourdomain.com/sitemap.xml` in Google Search Console.

Lost the admin password? `npm run create-admin` sets a new one. Lost phone and recovery codes? `npm run reset-2fa -- email@example.com`.

## Checks

```bash
npm test            # automated checks: pages, CMS modules, uploads, CSRF, 2FA, roles, trash, catalogue, lockout, XSS
npm run check-links # crawls the running site and reports any broken link or image
```

## Project layout

```
server/
  app.js, index.js, lifecycle.js
  controllers/  HTTP response and page controllers
  middleware/   Authentication, security, request validation, error handling
  models/       Database access and product queries
  routes/       Public storefront and CMS API routes
  services/     Content, catalogue, email, uploads, authentication helpers
  views/        Storefront page templates and HTML renderer
admin/
  components/   Reusable CMS layout and form controls
  context/      CMS session and UI state
  pages/        Dashboard, products, categories, content, and other screens
  services/     Admin API client
  utils/        DOM, date, and async helpers
public/assets/  Storefront CSS, JS, fonts, and placeholder art
data/           Created at runtime: database + uploads (not in git)
scripts/        Setup, admin tools, tests, and link checker
```

The frontend uses native JavaScript modules rather than React/TypeScript; the folders
follow the same type-based separation without adding a framework or changing the UI.
The Express backend separates routing, controllers, middleware, models, services,
and rendered views.
#   A a n n - J a i p u r i  
 