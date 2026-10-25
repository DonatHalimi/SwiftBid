let ioInstance;

export function setIo(io) {
  ioInstance = io;
}

export function getIo() {
  if (!ioInstance) throw new Error('Socket.io has not been initialized');
  return ioInstance;
}

export function emitProductEvent(productId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`product:${productId}`).emit(event, payload);
  ioInstance.to('admins').emit('platform:event', { event, productId, ...payload });
}
