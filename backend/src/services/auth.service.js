import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { createRefreshToken, createVerificationToken, hashToken } from '../utils/token.js';
import { AppError, conflict, unauthorized, notFound } from '../utils/AppError.js';
import { sendVerificationEmail } from './email.service.js';

const ACCESS_COOKIE_MS = 15 * 60 * 1000;
const VERIFICATION_TOKEN_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const publicUser = ({ id, email, fullName, role, isSuspended, isEmailVerified, createdAt }) => ({ id, email, fullName, role, isSuspended, isEmailVerified, createdAt });

async function createSession(user, client = prisma) {
  const rawRefresh = createRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await client.refreshToken.create({
    data: { tokenHash: hashToken(rawRefresh), userId: user.id, expiresAt },
  });
  return { user: publicUser(user), accessToken: issueAccessToken(user), refreshToken: rawRefresh };
}

export function issueAccessToken(user) {
  return jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL, issuer: 'ankand-api', audience: 'ankand-web' });
}

export function setAuthCookies(res, accessToken, refreshToken) {
  const common = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
  res.cookie('accessToken', accessToken, { ...common, maxAge: ACCESS_COOKIE_MS });
  res.cookie('refreshToken', refreshToken, { ...common, maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookies(res) {
  const common = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
  res.clearCookie('accessToken', common);
  res.clearCookie('refreshToken', common);
}

export async function register(input) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw conflict('An account with this email already exists.');
  const passwordHash = await bcrypt.hash(input.password, 12);
  const token = createVerificationToken();
  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: { email: input.email, passwordHash, fullName: input.fullName, isEmailVerified: false, emailVerifiedAt: null },
    });
    await tx.emailVerificationToken.create({
      data: { tokenHash: hashToken(token), userId: createdUser.id, expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_MS) },
    });
    return createdUser;
  });
  await sendVerificationEmail({ email: user.email, fullName: user.fullName, token });
  return { email: user.email };
}

export async function authenticate(input) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordOkay = user?.passwordHash ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !passwordOkay) throw unauthorized('Email or password is incorrect.');
  if (user.isSuspended) throw new AppError(403, 'This account has been suspended.', 'ACCOUNT_SUSPENDED');
  if (!user.isEmailVerified) throw new AppError(403, 'Verify your email address before signing in.', 'EMAIL_NOT_VERIFIED');

  return createSession(user);
}

export async function resendVerification(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, isEmailVerified: true },
  });
  if (!user || user.isEmailVerified) return;

  const now = new Date();
  const token = createVerificationToken();
  const existing = await prisma.emailVerificationToken.findUnique({ where: { userId: user.id } });
  if (existing) {
    const cutoff = new Date(now.getTime() - RESEND_COOLDOWN_MS);
    const updated = await prisma.emailVerificationToken.updateMany({
      where: { id: existing.id, createdAt: { lte: cutoff } },
      data: { tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_MS), consumedAt: null, createdAt: now },
    });
    if (updated.count !== 1) return;
  } else {
    try {
      await prisma.emailVerificationToken.create({
        data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_MS) },
      });
    } catch (error) {
      if (error?.code === 'P2002') return;
      throw error;
    }
  }

  await sendVerificationEmail({ email: user.email, fullName: user.fullName, token });
}

export async function verifyEmail(token) {
  const now = new Date();
  const tokenHash = hashToken(token);
  const result = await prisma.$transaction(async (tx) => {
    const verification = await tx.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!verification) throw new AppError(400, 'This verification link is invalid. Request a new email to continue.', 'EMAIL_VERIFICATION_INVALID');
    if (verification.consumedAt) throw new AppError(409, 'This verification link has already been used. Sign in to continue.', 'EMAIL_VERIFICATION_USED');
    if (verification.expiresAt <= now) throw new AppError(410, 'This verification link has expired. Request a new email to continue.', 'EMAIL_VERIFICATION_EXPIRED');
    if (verification.user.isEmailVerified) throw new AppError(409, 'This account is already verified. Sign in to continue.', 'EMAIL_VERIFICATION_USED');
    if (verification.user.isSuspended) throw new AppError(403, 'This account has been suspended.', 'ACCOUNT_SUSPENDED');

    const claimed = await tx.emailVerificationToken.updateMany({
      where: { id: verification.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (claimed.count !== 1) throw new AppError(409, 'This verification link has already been used. Sign in to continue.', 'EMAIL_VERIFICATION_USED');

    const user = await tx.user.update({
      where: { id: verification.userId },
      data: { isEmailVerified: true, emailVerifiedAt: now },
    });
    const rawRefresh = createRefreshToken();
    await tx.refreshToken.create({
      data: {
        tokenHash: hashToken(rawRefresh),
        userId: user.id,
        expiresAt: new Date(now.getTime() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    return { user: publicUser(user), accessToken: issueAccessToken(user), refreshToken: rawRefresh };
  });
  return result;
}

export async function rotateRefreshToken(rawToken) {
  if (!rawToken) throw unauthorized('Refresh session is missing. Sign in again.');
  const current = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) }, include: { user: true } });
  if (!current) throw unauthorized('Refresh session is invalid. Sign in again.');
  if (current.revokedAt) {
    // Reuse of a rotated token is treated as token theft; revoke all sessions for this user.
    await prisma.refreshToken.updateMany({ where: { userId: current.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw unauthorized('Refresh session reuse detected. Sign in again.');
  }
  if (current.expiresAt <= new Date()) {
    await prisma.refreshToken.updateMany({ where: { id: current.id, revokedAt: null }, data: { revokedAt: new Date() } });
    throw unauthorized('Refresh session has expired. Sign in again.');
  }
  if (current.user.isSuspended) throw new AppError(403, 'This account has been suspended.', 'ACCOUNT_SUSPENDED');

  const rawNext = createRefreshToken();
  const hashNext = hashToken(rawNext);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  const swapped = await prisma.$transaction(async (tx) => {
    const claim = await tx.refreshToken.updateMany({
      where: { id: current.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date(), replacedByTokenHash: hashNext },
    });
    if (claim.count !== 1) return false;
    await tx.refreshToken.create({ data: { tokenHash: hashNext, userId: current.userId, expiresAt } });
    return true;
  });
  if (!swapped) throw unauthorized('Refresh session has already been used. Sign in again.');
  return { user: publicUser(current.user), accessToken: issueAccessToken(current.user), refreshToken: rawNext };
}

export async function logout(rawToken) {
  if (rawToken) {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }
}

export async function becomeSeller(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User not found.');
  if (user.role === 'ADMIN' || user.role === 'SELLER') return publicUser(user);
  const updated = await prisma.user.update({ where: { id: userId }, data: { role: 'SELLER' } });
  return publicUser(updated);
}
