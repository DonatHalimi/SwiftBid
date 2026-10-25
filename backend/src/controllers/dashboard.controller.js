import { asyncHandler } from '../utils/asyncHandler.js';
import { getDashboard } from '../services/dashboard.service.js';

export const mine = asyncHandler(async (req, res) => res.json(await getDashboard(req.user.id)));
