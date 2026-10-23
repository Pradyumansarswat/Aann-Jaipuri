import { z } from 'zod';
import { db } from '../../models/database.js';

export const bool = z.union([z.boolean(), z.number()]).transform(Boolean);
const IMG = /^\/(uploads|assets\/seed)\/[A-Za-z0-9._-]+$/;
export const imageField = z.string().trim().max(200).refine((v) => v === '' || IMG.test(v), 'Invalid image').refine((v) => {
  if (!v.startsWith('/uploads/')) return true;
  return !!db.prepare('SELECT 1 FROM media WHERE filename = ?').get(v.slice(9));
}, 'Image not found in the library');
