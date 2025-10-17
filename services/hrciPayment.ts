import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * HRCI Pay Order Type shared across app.
 */
export interface HrciPayOrder {
  orderId: string;
  amount: number;
  currency: string;
  provider: string | null;
  providerOrderId?: string | null;
  providerKeyId?: string | null;
  // Optional pricing breakdown for diagnostics
  breakdown?: {
    baseAmount: number;
    discountAmount: number;
    discountPercent: number | null;
    appliedType: string | null;
    finalAmount: number;
    note: string | null;
  } | null;
  createdAt?: number; // local creation time (ms)
  paidAt?: string | null; // server ISO timestamp (if already paid)
  restoredFrom?: string; // metadata for diagnostics (e.g., 'pendingRegistration')
}

const STORAGE_KEY = 'HRCI_PAY_ORDER';

export const ORDER_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

/** Persist a pay order to storage. */
export async function persistPayOrder(order: HrciPayOrder): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch (e) {
    console.warn('[hrciPayment] persistPayOrder failed', (e as any)?.message);
  }
}

/** Load pay order from storage (raw, no freshness filtering). */
export async function loadPayOrderRaw(): Promise<HrciPayOrder | null> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    if (!v) return null;
    const parsed = JSON.parse(v);
    if (parsed?.orderId) return parsed as HrciPayOrder;
  } catch (e) {
    console.warn('[hrciPayment] loadPayOrderRaw failed', (e as any)?.message);
  }
  return null;
}

/** Determine if order is fresh based on createdAt or paidAt timestamp. */
export function isPayOrderFresh(order: HrciPayOrder, maxAgeMs: number = ORDER_MAX_AGE_MS): boolean {
  const ts = Number(order.createdAt || 0) || (order.paidAt ? Date.parse(order.paidAt) : 0);
  if (!ts) return true; // no timestamp means we treat as fresh
  return Date.now() - ts < maxAgeMs;
}

/** Load a fresh pay order; returns null if stale or missing. */
export async function loadFreshPayOrder(): Promise<HrciPayOrder | null> {
  const order = await loadPayOrderRaw();
  if (!order) return null;
  if (!isPayOrderFresh(order)) return null;
  return order;
}

/** Clear persisted pay order. */
export async function clearPersistedPayOrder(): Promise<void> {
  try { await AsyncStorage.removeItem(STORAGE_KEY); } catch {}
}
