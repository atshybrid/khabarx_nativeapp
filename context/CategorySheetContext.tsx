import { log } from '@/services/logger';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { useTabBarVisibility } from './TabBarVisibilityContext';

type CategoryItemLite = { id: string; name: string; slug?: string; iconUrl?: string | null };
type CategorySelectHandler = (item: CategoryItemLite) => void;

type CategorySheetCtx = {
  /** Open the category sheet. Optionally pass a one-time onSelect handler for local flows (e.g., Create Article). */
  open: (onSelect?: CategorySelectHandler) => void;
  close: () => void;
  visible: boolean;
  /** Current temporary onSelect handler (if any) set via open(handler). */
  currentOnSelect?: CategorySelectHandler | null;
  /** Internal: clear the temporary handler; called on close or after selection. */
  _clearHandler: () => void;
};

const Ctx = createContext<CategorySheetCtx | undefined>(undefined);

export const CategorySheetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const { setTabBarVisible } = useTabBarVisibility();
  const lastClosedAtRef = React.useRef<number>(0);
  const openTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTabTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSelectRef = React.useRef<CategorySelectHandler | null>(null);
  const [currentOnSelect, setCurrentOnSelect] = React.useState<CategorySelectHandler | null>(null);

  const api = useMemo<CategorySheetCtx>(() => ({
    open: (onSelect?: CategorySelectHandler) => {
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
      if (showTabTimerRef.current) {
        clearTimeout(showTabTimerRef.current);
        showTabTimerRef.current = null;
      }
      // Set temporary selection handler for this open call if provided
  onSelectRef.current = onSelect ?? null;
  setCurrentOnSelect(onSelect ?? null);
      // If just closed, delay reopen briefly to avoid racing with close animations/timers
      const now = Date.now();
      const sinceClose = now - (lastClosedAtRef.current || 0);
      const delay = sinceClose < 220 ? 220 - sinceClose : 0;
      if (visible) return; // already open
      if (delay > 0) {
        openTimerRef.current = setTimeout(() => {
          log.event('category.sheet.open');
          setVisible(true);
          setTabBarVisible(false);
          openTimerRef.current = null;
        }, delay);
      } else {
        log.event('category.sheet.open');
        setVisible(true);
        setTabBarVisible(false);
      }
    },
    close: () => {
      if (!visible) return; // already closed
      lastClosedAtRef.current = Date.now();
      log.event('category.sheet.close');
      setVisible(false);
  // Clear handler once the sheet is closed
  onSelectRef.current = null;
  setCurrentOnSelect(null);
      // Delay tab bar show until the close animation fully completes to avoid flicker
      if (showTabTimerRef.current) clearTimeout(showTabTimerRef.current);
      showTabTimerRef.current = setTimeout(() => {
        setTabBarVisible(true);
        showTabTimerRef.current = null;
      }, 320);
    },
    visible,
    currentOnSelect,
    _clearHandler: () => { onSelectRef.current = null; setCurrentOnSelect(null); },
  }), [visible, setTabBarVisible, currentOnSelect]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
};

export function useCategorySheet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCategorySheet must be used within CategorySheetProvider');
  return ctx;
}
