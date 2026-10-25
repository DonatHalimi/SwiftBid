import http from 'node:http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { setIo } from './lib/socket.js';
import { settleExpiredAuctions } from './services/auction.service.js';

// removed: path / fileURLToPath imports and the app.use('/static', express.static(...)) line

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});
setIo(io);

io.on('connection', (socket) => {
  socket.on('admin:join', async (acknowledge) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || '';
      const accessCookie = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('accessToken='));
      const token = accessCookie
        ? decodeURIComponent(accessCookie.slice('accessToken='.length))
        : null;
      if (!token) throw new Error('Missing session');
      const claims = jwt.verify(token, env.JWT_SECRET, {
        issuer: 'ankand-api',
        audience: 'ankand-web',
      });
      const account = await prisma.user.findUnique({
        where: { id: claims.sub },
        select: { role: true, isSuspended: true },
      });
      if (!account || account.role !== 'ADMIN' || account.isSuspended) {
        throw new Error('Admin access denied');
      }
      socket.join('admins');
      if (typeof acknowledge === 'function') acknowledge({ ok: true });
    } catch {
      if (typeof acknowledge === 'function') acknowledge({ ok: false });
    }
  });

  socket.on('product:join', async (productId) => {
    if (typeof productId !== 'string' || productId.length > 64) return;
    try {
      const exists = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (exists) socket.join(`product:${productId}`);
    } catch {
      /* A failed room join must not crash the socket process. */
    }
  });

  socket.on('product:leave', (productId) => {
    if (typeof productId === 'string' && productId.length <= 64) {
      socket.leave(`product:${productId}`);
    }
  });
});

let settlementTimer;
let settling = false;
async function safeSettle() {
  if (settling) return;
  settling = true;
  try {
    await settleExpiredAuctions();
  } catch (error) {
    console.error('Auction settlement worker error:', error);
  } finally {
    settling = false;
  }
}

async function start() {
  await prisma.$connect();
  server.listen(env.PORT, '0.0.0.0', () => {
    console.info(`Ankand API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
  await safeSettle();
  settlementTimer = setInterval(safeSettle, 5_000);
  settlementTimer.unref?.();
}

async function shutdown(signal) {
  console.info(`${signal} received; shutting down...`);
  clearInterval(settlementTimer);
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();
  io.close(async () => {
    clearTimeout(forceExit);
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch(async (error) => {
  console.error('Failed to start API:', error);
  await prisma.$disconnect();
  process.exit(1);
});