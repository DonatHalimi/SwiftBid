import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { env } from '../config/env.js';
import { badRequest } from '../utils/AppError.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const uploadRoot = path.resolve(backendRoot, env.UPLOAD_DIR);
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadRoot),
  filename: (_req, file, callback) => {
    const extensionByType = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
    callback(null, `${crypto.randomUUID()}${extensionByType[file.mimetype] ?? '.img'}`);
  },
});

export const uploadImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return callback(badRequest('Images must be JPEG, PNG, WEBP, or GIF.'));
    }
    callback(null, true);
  },
});

export async function removeLocalUpload(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  const filename = path.basename(url);
  if (!filename || filename === '.' || filename === '..') return;
  const target = path.resolve(uploadRoot, filename);
  if (path.dirname(target) !== uploadRoot) return;
  try { await fs.promises.unlink(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
