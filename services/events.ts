// Lightweight event bus for cross-screen notifications (no external deps)
// Usage:
//   const off = on('comments:updated', payload => { ... })
//   emit('comments:updated', { shortNewsId, total })
//   off()

export type AppEvents = {
  'comments:updated': { shortNewsId: string; total: number };
  // Fired after a user updates their profile (e.g., photo). Consumers can refetch /profiles/me.
  'profile:updated': { photoUrl?: string };
  // Fired after KYC is submitted or status changes; consumers can refresh membership or KYC status
  'kyc:updated': { status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NOT_STARTED' };
  // Show a lightweight in-app toast
  'toast:show': { message: string };
  // Ask News tab to reload items (e.g., after login/logout/language change)
  'news:refresh': { reason?: 'login' | 'logout' | 'language' | 'manual' };
};

type Handler<T> = (payload: T) => void;

// Simpler runtime structure: record of event -> set of handlers (erased generic for ease)
const listeners: Record<string, Set<Handler<any>>> = {};

export function on<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): () => void {
  const key = String(event);
  if (!listeners[key]) listeners[key] = new Set();
  listeners[key]!.add(handler as Handler<any>);
  return () => {
    listeners[key]!.delete(handler as Handler<any>);
  };
}

export function emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
  const key = String(event);
  const set = listeners[key];
  if (!set || set.size === 0) return;
  for (const h of set) {
    try { (h as Handler<AppEvents[K]>)(payload); } catch { /* noop */ }
  }
}
