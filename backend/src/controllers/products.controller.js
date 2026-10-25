import * as productService from '../services/product.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { prisma } from '../lib/prisma.js';
import { removeLocalUpload } from '../middleware/upload.js';
import fs from 'node:fs/promises';
import { writeAudit } from '../utils/audit.js';

export const list = asyncHandler(async (req, res) => res.json(await productService.listProducts(req.validated)));
export const getById = asyncHandler(async (req, res) => res.json({ product: await productService.getProduct(req.params.id) }));

export const create = asyncHandler(async (req, res) => {
  let product;
  try { product = await productService.createProduct(req.validated, req.user.id, req.files); }
  catch (error) {
    await Promise.all((req.files ?? []).map((file) => fs.unlink(file.path).catch(() => undefined)));
    throw error;
  }

  await writeAudit({ actorId: req.user.id, action: 'LISTING_CREATED', targetType: 'Product', targetId: product.id, metadata: { title: product.title }, ipAddress: req.ip });
  res.status(201).json({ product });
});

export const cancel = asyncHandler(async (req, res) => {
  const result = await productService.cancelOwnListing(req.params.id, req.user);

  await writeAudit({ actorId: req.user.id, action: 'LISTING_CANCELLED_BY_SELLER', targetType: 'Product', targetId: result.id, metadata: { status: result.status }, ipAddress: req.ip });
  res.json(result);
});

export const report = asyncHandler(async (req, res) => {
  const report = await productService.reportListing({ productId: req.params.id, reporterId: req.user.id, reason: req.validated.reason });

  await writeAudit({ actorId: req.user.id, action: 'LISTING_REPORTED', targetType: 'ListingReport', targetId: report.id, metadata: { productId: req.params.id }, ipAddress: req.ip });
  res.status(201).json({ report });
});

export const dashboard = asyncHandler(async (req, res) => {
  const items = await prisma.product.findMany({ where: { sellerId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 100, include: { images: { take: 1 }, _count: { select: { bids: true } } } });

  res.json({ items });
});

export const removeMyImage = asyncHandler(async (req, res) => {
  const image = await prisma.productImage.findUnique({ where: { id: req.params.imageId }, include: { product: { select: { sellerId: true, status: true } } } });
  if (!image) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Image not found.' } });
  if (image.product.sellerId !== req.user.id || image.product.status !== 'ACTIVE') return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot remove this image.' } });

  await prisma.productImage.delete({ where: { id: image.id } });
  await removeLocalUpload(image.url);
  res.status(204).end();
});
