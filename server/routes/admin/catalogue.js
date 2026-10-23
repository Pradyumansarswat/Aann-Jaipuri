import multer from 'multer';
import { audit } from '../../models/database.js';
import { limits } from '../../middleware/security.js';
import { fail } from '../../middleware/request-validation.js';
import * as catalogue from '../../services/catalogue.js';

export function registerCatalogueRoutes(admin) {
  const uploadPdf = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 2 } });
  admin.get('/catalogue', (req, res) => res.json(catalogue.status()));
  admin.post('/catalogue/rebuild', async (req, res) => { await catalogue.rebuild(); audit(req, 'catalogue_rebuilt'); res.json(catalogue.status()); });
  admin.get('/catalogue/file', async (req, res) => {
    const { file } = await catalogue.pdfFile();
    res.download(file, 'wholesale-catalogue.pdf', { headers: { 'X-Content-Type-Options': 'nosniff' } });
  });
  admin.post('/catalogue/upload', limits.upload, (req, res, next) => uploadPdf.single('file')(req, res, (err) => {
    if (err) return fail(res, 400, err.code === 'LIMIT_FILE_SIZE' ? 'The PDF must be under 25 MB.' : 'Upload failed.');
    next();
  }), async (req, res) => {
    if (!req.file) return fail(res, 400, 'Choose a PDF file.');
    await catalogue.saveCustom(req.file.buffer);
    audit(req, 'catalogue_uploaded', `${req.file.size} bytes`);
    res.json(catalogue.status());
  });
  admin.delete('/catalogue/custom', async (req, res) => { await catalogue.removeCustom(); audit(req, 'catalogue_custom_removed'); res.json(catalogue.status()); });
}
