import { asyncHandler } from '../utils/asyncHandler.js';
import { makeInstantOffer } from '../services/offer.service.js';

export const create = asyncHandler(async (req, res) => {
  const result = await makeInstantOffer({ productId: req.params.productId, userId: req.user.id, offeredAmount: req.validated.offeredAmount });
  res.status(201).json(result);
});
