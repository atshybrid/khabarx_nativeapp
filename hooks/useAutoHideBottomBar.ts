
import { useCallback, useEffect, useRef } from "react";
import { EmitterSubscription, Keyboard } from "react-native";

type Options = {
  timeout?: number; // ms, default 5000
  minVisible?: number; // ms to keep visible before allowing hide again
  debug?: boolean; // log internal state transitions
};

export function useAutoHideBottomBar(
  onShow: () => void,
  onHide: () => void,
  opts: Options = {}
) {
  const timeout = opts.timeout ?? 5000;
  const minVisible = opts.minVisible ?? 500;
  const debug = opts.debug ?? false;
  const hideTimer = useRef<number | null>(null);
  const lastShownAt = useRef<number>(0);
  const onShowRef = useRef(onShow);
  const onHideRef = useRef(onHide);
  const didInitRef = useRef(false);

  const clear = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
  if (debug) console.log('[TabBarAutoHide] clear inactivity timer');
    }
  }, [debug]);

  const scheduleHide = useCallback(() => {
    clear();
    const elapsed = Date.now() - lastShownAt.current;
    const delay = Math.max(0, timeout - elapsed, minVisible);
    if (debug) console.log(`[TabBarAutoHide] scheduleHide in ${delay}ms (elapsedVisible=${elapsed})`);
    hideTimer.current = (setTimeout(() => {
      hideTimer.current = null;
      if (debug) console.log('[TabBarAutoHide] inactivity fired -> onHide()');
      onHideRef.current();
    }, delay) as unknown) as number;
  }, [clear, timeout, minVisible, debug]);

  const show = useCallback(() => {
    lastShownAt.current = Date.now();
    if (debug) console.log('[TabBarAutoHide] show() called');
    onShowRef.current();
    scheduleHide();
  }, [scheduleHide, debug]);

  const hide = useCallback(() => {
    clear();
    if (debug) console.log('[TabBarAutoHide] hide() called');
    onHideRef.current();
  }, [clear, debug]);

  useEffect(() => {
    // Keep latest callbacks
    onShowRef.current = onShow;
    onHideRef.current = onHide;
  }, [onShow, onHide]);

  useEffect(() => {
    // Hide initially - run once
    if (!didInitRef.current) {
      didInitRef.current = true;
      if (debug) console.log('[TabBarAutoHide] init hide on mount');
      onHideRef.current();
    }
    return () => clear();
  }, [clear, debug]);

  // Optional: show when keyboard opens
  useEffect(() => {
    const showSub: EmitterSubscription = Keyboard.addListener("keyboardDidShow", () => {
    if (debug) console.log('[TabBarAutoHide] keyboardDidShow -> show()');
    show();
    });
    return () => showSub.remove();
  }, [show, debug]);

  return { show, hide, scheduleHide, clear };
}
