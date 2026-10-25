import { asyncHandler } from '../utils/asyncHandler.js';
import { placeBid } from '../services/auction.service.js';

export const create = asyncHandler(async (req, res) => {
  const bid = await placeBid({ productId: req.params.productId, userId: req.user.id, amount: req.validated.amount });
  res.status(201).json({ bid });
});
