import crypto from 'node:crypto';

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const createRefreshToken = () => crypto.randomBytes(48).toString('base64url');
export const createVerificationToken = () => crypto.randomBytes(32).toString('base64url');
