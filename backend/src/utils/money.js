import { Prisma } from '../generated/prisma/client.js';

export function toMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new TypeError('Amount must be a finite number');
  return new Prisma.Decimal(numeric.toFixed(2));
}

export function moneyString(value) {
  return new Prisma.Decimal(value).toFixed(2);
}

export function maxDecimal(...values) {
  return values.reduce(
    (current, value) =>
      new Prisma.Decimal(value).gt(current) ? new Prisma.Decimal(value) : current,
    new Prisma.Decimal(0)
  );
}

export function meetsReserve(currentHighestBid, reservePrice) {
  return (
    new Prisma.Decimal(currentHighestBid).gt(0) &&
    (reservePrice == null || new Prisma.Decimal(currentHighestBid).gte(reservePrice))
  );
}