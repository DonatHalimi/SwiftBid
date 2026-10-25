import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const fullName = process.env.BOOTSTRAP_ADMIN_NAME?.trim();

if (!email || !password || !fullName) {
  console.error('Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, and BOOTSTRAP_ADMIN_NAME in backend/.env first.');
  process.exitCode = 1;
} else if (password.length < 14 || Buffer.byteLength(password, 'utf8') > 72) {
  console.error('Bootstrap admin password must be at least 14 characters and no more than 72 UTF-8 bytes.');
  process.exitCode = 1;
} else {
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, fullName, role: 'ADMIN', isSuspended: false, isEmailVerified: true, emailVerifiedAt: new Date() },
      create: { email, passwordHash, fullName, role: 'ADMIN', isEmailVerified: true, emailVerifiedAt: new Date() },
      select: { id: true, email: true, role: true },
    });
    console.info(`Bootstrap admin is ready: ${admin.email} (${admin.role}, ${admin.id}). Remove BOOTSTRAP_ADMIN_PASSWORD from the environment now.`);
  } catch (error) {
    console.error('Failed to bootstrap admin:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
