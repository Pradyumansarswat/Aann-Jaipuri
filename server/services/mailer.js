import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transport = null;
if (config.smtp) {
  transport = nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
}
const clean = (s) => String(s).replace(/[\r\n]+/g, ' ').slice(0, 200);

// Best-effort notification. Credentials stay on the server; failures never break the visitor's request.
export async function sendCatalogueEmail({ to, name, brandName, file }) {
  if (!transport) return false;
  try {
    await transport.sendMail({
      from: config.smtp.from, to: clean(to),
      subject: clean(`Your ${brandName} wholesale catalogue`),
      text: `Hello ${clean(name)},\n\nThank you for your interest. Your wholesale catalogue is attached. Message us on WhatsApp for rates and minimum orders.\n\n${brandName}`,
      attachments: [{ filename: 'wholesale-catalogue.pdf', path: file }],
    });
    return true;
  } catch (err) { console.error('[mail] could not send catalogue:', err.code || err.message); return false; }
}

export async function notifyEnquiry(e) {
  if (!transport) return;
  try {
    await transport.sendMail({
      from: config.smtp.from, to: config.smtp.to,
      subject: clean(`New wholesale enquiry from ${e.shop}, ${e.city}`),
      text: [`Name: ${e.name}`, `Shop: ${e.shop}`, `City: ${e.city}`, `Phone: ${e.phone || '-'}`, `Email: ${e.email || '-'}`, e.source === 'catalogue' ? 'Source: catalogue request' : '',
        `Buyer type: ${e.buyer_type || '-'}`, e.product_code ? `Design: ${e.product_code}` : '', '', e.requirement].filter(Boolean).join('\n'),
    });
  } catch (err) {
    console.error('[mail] could not send enquiry notification:', err.code || err.message);
  }
}
