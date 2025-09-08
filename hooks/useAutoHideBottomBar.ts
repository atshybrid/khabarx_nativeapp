
import { useEffect, useRef, useCallback } from "react";
import { EmitterSubscription, Keyboard } from "react-native";

type Options = {
  timeout?: number; // ms, default 5000
  minVisible?: number; // ms to keep visible before allowing hide again
};

export function useAutoHideBottomBar(
  onShow: () => void,
  onHide: () => void,
  opts: Options = {}
) {
  const timeout = opts.timeout ?? 5000;
  const minVisible = opts.minVisible ?? 500;
  const hideTimer = useRef<number | null>(null);
  const lastShownAt = useRef<number>(0);

  const clear = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const scheduleHide = useCallback(() => {
    clear();
    const elapsed = Date.now() - lastShownAt.current;
    const delay = Math.max(0, timeout - elapsed, minVisible);
    hideTimer.current = (setTimeout(() => {
      hideTimer.current = null;
      onHide();
    }, delay) as unknown) as number;
  }, [onHide, timeout, minVisible]);

  const show = useCallback(() => {
    lastShownAt.current = Date.now();
    onShow();
    scheduleHide();
  }, [onShow, scheduleHide]);

  useEffect(() => {
    // Hide initially
    onHide();
    // Cleanup on unmount:
    return () => clear();
  }, [onHide]);

  // Optional: show when keyboard opens
  useEffect(() => {
    const showSub: EmitterSubscription = Keyboard.addListener("keyboardDidShow", () => {
      show();
    });
    return () => showSub.remove();
  }, [show]);

  return { show, scheduleHide, clear };
}
