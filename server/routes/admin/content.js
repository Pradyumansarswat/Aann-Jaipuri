import { db, audit } from '../../models/database.js';
import { fail, firstIssue } from '../../middleware/request-validation.js';
import { SECTIONS, DEFAULTS, validators, getContent, saveSection, resetSection } from '../../services/content.js';

export function registerContentRoutes(admin) {
  admin.get('/content', (req, res) => res.json({ schema: SECTIONS, content: getContent(), defaults: DEFAULTS }));
  admin.put('/content/:section', (req, res) => {
    const v = validators[req.params.section];
    if (!v) return fail(res, 404, 'Unknown section.');
    const r = v.safeParse(req.body);
    if (!r.success) return fail(res, 400, firstIssue(r.error));
    saveSection(req.params.section, r.data);
    audit(req, 'content_saved', req.params.section);
    res.json({ ok: true });
  });
  admin.delete('/content/:section', (req, res) => {
    if (!validators[req.params.section]) return fail(res, 404, 'Unknown section.');
    resetSection(req.params.section);
    audit(req, 'content_reset', req.params.section);
    res.json({ ok: true });
  });
}
