import { z } from 'zod';
import { db, audit } from '../../models/database.js';
import { fail, validateBody, validateId } from '../../middleware/request-validation.js';

export function registerEnquiryRoutes(admin) {
  admin.get('/enquiries', (req, res) => {
    const status = ['new', 'contacted', 'closed'].includes(req.query.status) ? req.query.status : '';
    const rows = db.prepare(`SELECT * FROM enquiries ${status ? 'WHERE status = ?' : ''} ORDER BY id DESC LIMIT 500`).all(...(status ? [status] : []));
    res.json({ enquiries: rows });
  });
  admin.get('/enquiries.csv', (req, res) => {
    const cell = (v) => {
      let s = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = db.prepare('SELECT * FROM enquiries ORDER BY id DESC').all();
    const head = ['id', 'date', 'status', 'source', 'name', 'shop', 'city', 'phone', 'email', 'buyer_type', 'design', 'requirement'];
    const csv = [head.join(','), ...rows.map((r) => [r.id, r.created_at, r.status, r.source, r.name, r.shop, r.city, r.phone, r.email, r.buyer_type, r.product_code, r.requirement].map(cell).join(','))].join('\r\n');
    audit(req, 'enquiries_exported');
    res.type('text/csv').set('Content-Disposition', 'attachment; filename="enquiries.csv"').send('\ufeff' + csv);
  });
  admin.patch('/enquiries/:id', validateId, validateBody(z.object({ status: z.enum(['new', 'contacted', 'closed']) }).strict()), (req, res) => {
    const r = db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').run(req.data.status, req.id);
    if (!r.changes) return fail(res, 404, 'Enquiry not found.');
    res.json({ ok: true });
  });
  admin.delete('/enquiries/:id', validateId, (req, res) => {
    const r = db.prepare('DELETE FROM enquiries WHERE id = ?').run(req.id);
    if (!r.changes) return fail(res, 404, 'Enquiry not found.');
    audit(req, 'enquiry_deleted', String(req.id));
    res.json({ ok: true });
  });
}
