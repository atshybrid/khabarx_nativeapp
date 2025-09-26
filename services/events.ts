// Lightweight event bus for cross-screen notifications (no external deps)
// Usage:
//   const off = on('comments:updated', payload => { ... })
//   emit('comments:updated', { shortNewsId, total })
//   off()

export type AppEvents = {
  'comments:updated': { shortNewsId: string; total: number };
};

type Handler<T> = (payload: T) => void;

const listeners: { [K in keyof AppEvents]?: Set<Handler<AppEvents[K]>> } = {};

export function on<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): () => void {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event]!.add(handler);
  return () => {
    listeners[event]!.delete(handler);
  };
}

export function emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
  const set = listeners[event];
  if (!set || set.size === 0) return;
  for (const h of set) {
    try { h(payload); } catch (e) { if (e) {/* noop */} }
  }
}
