import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearPersistedPayOrder, isPayOrderFresh, loadPayOrderRaw, ORDER_MAX_AGE_MS } from '../services/hrciPayment';

export type HrciLevel = 'NATIONAL' | 'ZONE' | 'STATE' | 'DISTRICT' | 'MANDAL';

export interface HrciGeo {
  zone?: string | null;
  hrcCountryId?: string | null;
  hrcStateId?: string | null;
  hrcDistrictId?: string | null;
  hrcMandalId?: string | null;
  hrcCountryName?: string | null;
  hrcStateName?: string | null;
  hrcDistrictName?: string | null;
  hrcMandalName?: string | null;
}

export interface HrciSelection {
  mobileNumber?: string;
  level?: HrciLevel;
  // Cell with ID, name, and code
  cellId?: string;
  cellName?: string;
  cellCode?: string;
  // Designation with code, name, and ID
  designationId?: string;
  designationCode?: string;
  designationName?: string;
  geo: HrciGeo;
  payOrder?: {
    orderId: string;
    amount: number;
    currency: string;
    provider: string | null;
    providerOrderId?: string | null;
    providerKeyId?: string | null;
    createdAt?: number;
    paidAt?: string | null;
    restoredFrom?: string;
  } | null;
  razorpayResult?: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  } | null;
}

interface Ctx extends HrciSelection {
  setMobileNumber: (m: string) => void;
  setLevel: (l: HrciLevel) => void;
  setCell: (id: string, name?: string, code?: string) => void;
  setDesignation: (id: string, code: string, name?: string) => void;
  updateGeo: (patch: Partial<HrciGeo>) => void;
  setPayOrder: (o: HrciSelection['payOrder']) => void;
  setRazorpayResult: (r: HrciSelection['razorpayResult']) => void;
  clearPayment: () => void;
  reset: () => void;
}

const HrciOnboardingContext = createContext<Ctx | undefined>(undefined);

const STORAGE_KEY = '@hrci_onboarding_data';

export function HrciOnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<HrciSelection>({ geo: {}, payOrder: null, razorpayResult: null });
  // Track whether we attempted payOrder restore (so consumers can know it's final)
  const [loaded, setLoaded] = useState(false);

  // Load persisted data on mount (core selection excluding payment)
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedData = JSON.parse(stored);
          setState(prev => ({ ...prev, ...parsedData }));
        }
      } catch (error) {
        console.warn('[HrciOnboarding] Failed to load stored data:', error);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Separate restoration for pay-order (since we intentionally don't persist it inside main blob)
  useEffect(() => {
    (async () => {
      if (!loaded) return;
      try {
        const raw = await loadPayOrderRaw();
        if (raw && isPayOrderFresh(raw, ORDER_MAX_AGE_MS)) {
          setState(prev => (prev.payOrder ? prev : { ...prev, payOrder: raw }));
        } else if (raw) {
          console.log('[HrciOnboarding] Clearing stale pay order');
          await clearPersistedPayOrder();
        }
      } catch (e) {
        console.warn('[HrciOnboarding] pay order helper restore failed', e);
      }
    })();
  }, [loaded]);

  // Persist data whenever state changes (except payment data)
  useEffect(() => {
    if (!loaded) return; // Don't persist until initial load is complete
    
    (async () => {
      try {
        const { payOrder, razorpayResult, ...persistableData } = state;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persistableData));
      } catch (error) {
        console.warn('[HrciOnboarding] Failed to persist data:', error);
      }
    })();
  }, [state, loaded]);

  // Stable setters (identities do not change across renders)
  const setMobileNumber = useCallback((m: string) => {
    setState(prev => (prev.mobileNumber === m ? prev : { ...prev, mobileNumber: m }));
  }, []);
  const setLevel = useCallback((l: HrciLevel) => {
    setState(prev => (prev.level === l ? prev : { ...prev, level: l }));
  }, []);
  const setCell = useCallback((id: string, name?: string, code?: string) => {
    setState(prev => (prev.cellId === id && prev.cellName === name && prev.cellCode === code ? prev : { ...prev, cellId: id, cellName: name, cellCode: code }));
    // Persist cookies for cell selection (id, name, code)
    try {
      AsyncStorage.multiSet([
        ['HRCI_CELL_ID', id || ''],
        ['HRCI_CELL_NAME', name || ''],
        ['HRCI_CELL_CODE', code || ''],
      ]);
    } catch {}
  }, []);
  const setDesignation = useCallback((id: string, code: string, name?: string) => {
    setState(prev => (prev.designationId === id && prev.designationCode === code && prev.designationName === name ? prev : { ...prev, designationId: id, designationCode: code, designationName: name }));
    // Persist cookies for designation selection (id, code, name)
    try {
      AsyncStorage.multiSet([
        ['HRCI_DESIGNATION_ID', id || ''],
        ['HRCI_DESIGNATION_CODE', code || ''],
        ['HRCI_DESIGNATION_NAME', name || ''],
      ]);
    } catch {}
  }, []);
  const updateGeo = useCallback((patch: Partial<HrciGeo>) => {
    setState(prev => {
      const nextGeo = { ...prev.geo, ...patch };
      const same = prev.geo.zone === nextGeo.zone
        && prev.geo.hrcCountryId === nextGeo.hrcCountryId
        && prev.geo.hrcStateId === nextGeo.hrcStateId
        && prev.geo.hrcDistrictId === nextGeo.hrcDistrictId
        && prev.geo.hrcMandalId === nextGeo.hrcMandalId
        && prev.geo.hrcCountryName === nextGeo.hrcCountryName
        && prev.geo.hrcStateName === nextGeo.hrcStateName
        && prev.geo.hrcDistrictName === nextGeo.hrcDistrictName
        && prev.geo.hrcMandalName === nextGeo.hrcMandalName;
      return same ? prev : { ...prev, geo: nextGeo };
    });
  }, []);
  const setPayOrder = useCallback((o: HrciSelection['payOrder']) => {
    setState(prev => (prev.payOrder === o ? prev : { ...prev, payOrder: o }));
  }, []);
  const setRazorpayResult = useCallback((r: HrciSelection['razorpayResult']) => {
    setState(prev => (prev.razorpayResult === r ? prev : { ...prev, razorpayResult: r }));
  }, []);
  const clearPayment = useCallback(() => {
    setState(prev => (!prev.payOrder && !prev.razorpayResult ? prev : { ...prev, payOrder: null, razorpayResult: null }));
  }, []);
  const reset = useCallback(() => {
    setState(prev => (Object.keys(prev.geo || {}).length === 0 && !prev.mobileNumber && !prev.level && !prev.cellId && !prev.cellCode && !prev.designationId && !prev.designationCode && !prev.payOrder && !prev.razorpayResult ? prev : { geo: {}, payOrder: null, razorpayResult: null }));
  }, []);

  const value = useMemo<Ctx>(() => ({
    ...state,
    setMobileNumber,
    setLevel,
    setCell,
    setDesignation,
    updateGeo,
    setPayOrder,
    setRazorpayResult,
    clearPayment,
    reset,
  }), [state, setMobileNumber, setLevel, setCell, setDesignation, updateGeo, setPayOrder, setRazorpayResult, clearPayment, reset]);

  return (
    <HrciOnboardingContext.Provider value={value}>{children}</HrciOnboardingContext.Provider>
  );
}

export function useHrciOnboarding() {
  const ctx = useContext(HrciOnboardingContext);
  if (!ctx) throw new Error('useHrciOnboarding must be used within HrciOnboardingProvider');
  return ctx;
}
