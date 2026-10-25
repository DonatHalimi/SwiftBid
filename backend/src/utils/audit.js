import { prisma } from '../lib/prisma.js';
import { getIo } from '../lib/socket.js';

export async function writeAudit({ actorId = null, action, targetType, targetId = null, metadata = undefined, ipAddress = null }) {
  const entry = await prisma.auditLog.create({ data: { actorId, action, targetType, targetId, metadata, ipAddress } });
  try { getIo().to('admins').emit('audit:new', entry); } catch { /* Socket server may not be running in a script/test. */ }
  return entry;
}
