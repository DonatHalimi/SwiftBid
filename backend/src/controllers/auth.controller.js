import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { clearAuthCookies, setAuthCookies } from '../services/auth.service.js';
import { writeAudit } from '../utils/audit.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.validated);
  res.status(201).json({ email: result.email, message: 'Account created. Check your email to verify your account.' });
});

export const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.validated.email);
  res.status(202).json({ message: 'If the account needs verification and the resend cooldown has passed, a new email will be sent.' });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const session = await authService.verifyEmail(req.validated.token);
  setAuthCookies(res, session.accessToken, session.refreshToken);
  res.json({ user: session.user });
});

export const login = asyncHandler(async (req, res) => {
  const session = await authService.authenticate(req.validated);
  setAuthCookies(res, session.accessToken, session.refreshToken);
  res.json({ user: session.user });
});

export const refresh = asyncHandler(async (req, res) => {
  const session = await authService.rotateRefreshToken(req.cookies?.refreshToken);
  setAuthCookies(res, session.accessToken, session.refreshToken);
  res.json({ user: session.user });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.refreshToken);
  clearAuthCookies(res);
  res.status(204).end();
});

export const me = asyncHandler(async (req, res) => res.json({ user: req.user }));

export const becomeSeller = asyncHandler(async (req, res) => {
  const user = await authService.becomeSeller(req.user.id);
  await writeAudit({ actorId: req.user.id, action: 'BECAME_SELLER', targetType: 'User', targetId: req.user.id, ipAddress: req.ip });
  res.json({ user });
});

export const oauthNotReady = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: { code: 'OAUTH_NOT_CONFIGURED', message: 'OAuth provider integration is reserved for a later release.' } });
});
