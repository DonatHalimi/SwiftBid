import { prisma } from '../lib/prisma.js';
import { emitProductEvent } from '../lib/socket.js';
import { AppError, conflict, notFound, forbidden } from '../utils/AppError.js';
import { removeLocalUpload } from '../middleware/upload.js';
import { writeAudit } from '../utils/audit.js';

export async function getMetrics() {
  const [users, activeListings, listings, transactions, completedValue, openReports] = await Promise.all([
    prisma.user.count(),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.product.count(),
    prisma.transaction.count(),
    prisma.transaction.aggregate({ where: { status: { in: ['PAID', 'SHIPPED', 'COMPLETED'] } }, _sum: { finalAmount: true } }),
    prisma.listingReport.count({ where: { status: 'OPEN' } }),
  ]);
  return { users, activeListings, listings, transactions, grossMerchandiseValue: completedValue._sum.finalAmount?.toFixed(2) ?? '0.00', openReports };
}

export async function listUsers({ q, role, page, limit }) {
  const where = { ...(role ? { role } : {}), ...(q ? { OR: [
    { email: { contains: q, mode: 'insensitive' } }, { fullName: { contains: q, mode: 'insensitive' } },
  ] } : {}) };
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select: { id: true, email: true, fullName: true, role: true, isSuspended: true, createdAt: true, _count: { select: { products: true, bids: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.user.count({ where }),
  ]);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function updateUser(targetId, actorId, input) {
  if (targetId === actorId && (input.role !== undefined || input.isSuspended === true)) throw forbidden('You cannot change your own admin access or suspend your own account.');
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw notFound('User not found.');
  const update = await prisma.user.update({ where: { id: targetId }, data: input, select: { id: true, email: true, fullName: true, role: true, isSuspended: true, updatedAt: true } });
  if (input.isSuspended === true) await prisma.refreshToken.updateMany({ where: { userId: targetId, revokedAt: null }, data: { revokedAt: new Date() } });
  return update;
}

export async function listListings({ q, status, page, limit }) {
  const where = {
    ...(status && ['ACTIVE', 'SOLD', 'EXPIRED', 'CANCELLED'].includes(status) ? { status } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { category: { contains: q, mode: 'insensitive' } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, include: { seller: { select: { id: true, fullName: true, email: true } }, images: { take: 1 }, _count: { select: { bids: true, reports: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.product.count({ where }),
  ]);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function cancelListing(productId, adminId, ipAddress) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, title: true, status: true } });
  if (!product) throw notFound('Listing not found.');
  if (product.status !== 'ACTIVE') throw conflict('Only active listings can be cancelled.');
  const changed = await prisma.product.updateMany({ where: { id: productId, status: 'ACTIVE' }, data: { status: 'CANCELLED' } });
  if (changed.count !== 1) throw conflict();
  await writeAudit({ actorId: adminId, action: 'LISTING_CANCELLED', targetType: 'Product', targetId: productId, metadata: { title: product.title }, ipAddress });
  emitProductEvent(productId, 'listing:cancelled', { productId, status: 'CANCELLED', reason: 'ADMIN_MODERATION' });
  return { id: productId, status: 'CANCELLED' };
}

export async function listReports({ status, page, limit }) {
  const where = status && ['OPEN', 'RESOLVED', 'DISMISSED'].includes(status) ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.listingReport.findMany({ where, include: {
      product: { select: { id: true, title: true, status: true, seller: { select: { id: true, fullName: true, email: true } }, images: { take: 1 } } },
      reporter: { select: { id: true, fullName: true, email: true } },
      reviewer: { select: { id: true, fullName: true } },
    }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.listingReport.count({ where }),
  ]);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function reviewReport(reportId, adminId, status, ipAddress) {
  const report = await prisma.listingReport.findUnique({ where: { id: reportId }, select: { id: true, status: true, productId: true } });
  if (!report) throw notFound('Report not found.');
  if (report.status !== 'OPEN') throw conflict('This report has already been reviewed.');
  const result = await prisma.listingReport.update({ where: { id: reportId }, data: { status, reviewerId: adminId, reviewedAt: new Date() } });
  await writeAudit({ actorId: adminId, action: 'REPORT_REVIEWED', targetType: 'ListingReport', targetId: reportId, metadata: { status, productId: report.productId }, ipAddress });
  return result;
}

export async function deleteListingImage(imageId, adminId, ipAddress) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) throw notFound('Image not found.');
  await prisma.productImage.delete({ where: { id: imageId } });
  await removeLocalUpload(image.url);
  await writeAudit({ actorId: adminId, action: 'LISTING_IMAGE_REMOVED', targetType: 'ProductImage', targetId: imageId, metadata: { productId: image.productId }, ipAddress });
  return { id: imageId, removed: true };
}

export async function listTransactions({ status, page, limit }) {
  const where = status && ['PENDING_PAYMENT', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'].includes(status) ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.transaction.findMany({ where, include: { product: { select: { id: true, title: true } }, buyer: { select: { id: true, fullName: true, email: true } }, seller: { select: { id: true, fullName: true, email: true } }, payout: true, disputes: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.transaction.count({ where }),
  ]);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function listAuditLogs({ page, limit }) {
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ include: { actor: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.auditLog.count(),
  ]);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
