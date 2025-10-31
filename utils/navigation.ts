import type { Href } from 'expo-router';

// Safe back navigation: if there's no history to go back to, navigate/replace to a fallback.
// Default fallback is '/news' which is the primary tab route used across the app.
export function safeBack(
  router: { back: () => void; canGoBack: () => boolean; replace: (href: Href) => void },
  fallback: Href = '/news'
) {
  try {
    if (router?.canGoBack && router.canGoBack()) {
      router.back();
      return;
    }
  } catch {}
  try {
    router?.replace?.(fallback);
  } catch {}
}
