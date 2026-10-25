// backend/prisma/seed.js
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SEED_MARKER = '[seed]';

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  // --- Users ---
  const seller = await prisma.user.upsert({
    where: { email: 'seller@example.com' },
    update: {},
    create: {
      email: 'seller@example.com',
      fullName: 'Sam Seller',
      passwordHash,
      role: 'SELLER',
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@example.com' },
    update: {},
    create: {
      email: 'buyer@example.com',
      fullName: 'Bea Buyer',
      passwordHash,
      role: 'BUYER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      fullName: 'Ada Admin',
      passwordHash,
      role: 'ADMIN',
    },
  });

  // --- Clean previous seed products so re-runs are idempotent ---
  await prisma.product.deleteMany({
    where: { title: { startsWith: SEED_MARKER } },
  });

  // --- Products ---
  const now = Date.now();
  const inDays = (d) => new Date(now + d * 24 * 60 * 60 * 1000);

  const products = [
    {
      title: 'Vintage Mechanical Keyboard',
      description:
        'IBM Model M-style buckling spring keyboard. Fully refurbished, USB-C mod installed. Includes original cable.',
      startingPrice: '89.00',
      currentHighestBid: '112.50',
      reservePrice: '100.00',
      category: 'ELECTRONICS',
      condition: 'REFURBISHED',
      status: 'ACTIVE',
      auctionEndsAt: inDays(3),
      allowDirectOffers: true,
      images: ['https://picsum.photos/seed/kb/800/600'],
    },
    {
      title: 'Hand-thrown Ceramic Mug Set',
      description:
        'Set of four stoneware mugs, glazed in matte sage. Dishwasher and microwave safe. Slight variations make each one unique.',
      startingPrice: '40.00',
      currentHighestBid: '40.00',
      category: 'HOME_AND_KITCHEN',
      condition: 'NEW',
      status: 'ACTIVE',
      auctionEndsAt: inDays(5),
      allowDirectOffers: true,
      images: ['https://picsum.photos/seed/mugs/800/600'],
    },
    {
      title: 'Mountain Bike — 29er Hardtail',
      description:
        'Aluminum frame, hydraulic disc brakes, 1x12 drivetrain. Ridden two seasons, recently serviced. Minor scuffs on the frame.',
      startingPrice: '650.00',
      currentHighestBid: '720.00',
      reservePrice: '800.00',
      category: 'SPORTS_AND_OUTDOORS',
      condition: 'USED',
      status: 'ACTIVE',
      auctionEndsAt: inDays(1),
      allowDirectOffers: false,
      images: ['https://picsum.photos/seed/bike/800/600'],
    },
    {
      title: 'Signed First Edition Novel',
      description:
        'Hardcover first edition, signed by the author on the title page. Dust jacket shows light shelf wear.',
      startingPrice: '120.00',
      currentHighestBid: '120.00',
      category: 'BOOKS',
      condition: 'USED',
      status: 'ACTIVE',
      auctionEndsAt: inDays(10),
      allowDirectOffers: true,
      images: ['https://picsum.photos/seed/book/800/600'],
    },
    {
      title: 'Smart Watch — Series 9',
      description:
        'GPS + cellular, 45mm, midnight aluminum. Includes two bands and charging puck. Battery health 94%.',
      startingPrice: '200.00',
      currentHighestBid: '260.00',
      category: 'ELECTRONICS',
      condition: 'USED',
      status: 'SOLD',
      auctionEndsAt: inDays(-2),
      allowDirectOffers: false,
      images: ['https://picsum.photos/seed/watch/800/600'],
    },
    {
      title: 'Vintage Leather Satchel',
      description:
        'Full-grain leather satchel from the 1970s. Patina throughout, straps intact, interior lining replaced.',
      startingPrice: '75.00',
      currentHighestBid: '75.00',
      category: 'FASHION',
      condition: 'USED',
      status: 'CANCELLED',
      auctionEndsAt: inDays(-5),
      allowDirectOffers: true,
      images: ['https://picsum.photos/seed/satchel/800/600'],
    },
    {
      title: 'Espresso Machine — Dual Boiler',
      description:
        'PID-controlled dual boiler, plumbable, includes portafilter and tamper. Descaled monthly, works flawlessly.',
      startingPrice: '450.00',
      currentHighestBid: '480.00',
      reservePrice: '550.00',
      category: 'HOME_AND_KITCHEN',
      condition: 'USED',
      status: 'EXPIRED',
      auctionEndsAt: inDays(-1),
      allowDirectOffers: true,
      images: ['https://picsum.photos/seed/espresso/800/600'],
    },
  ];

  for (const p of products) {
    const { images, ...data } = p;
    await prisma.product.create({
      data: {
        ...data,
        title: `${SEED_MARKER} ${data.title}`,
        sellerId: seller.id,
        images: { create: images.map((url) => ({ url })) },
      },
    });
  }

  console.log(
    `Seeded 3 users (seller/buyer/admin @example.com, password "Password123!") and ${products.length} products.`
  );
  console.log(`Buyer id: ${buyer.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });