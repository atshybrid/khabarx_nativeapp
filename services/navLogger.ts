// Navigation logging helper for expo-router
// Enable with EXPO_PUBLIC_NAV_DEBUG=1/true/on
import { router } from 'expo-router';

const DEBUG_NAV = (() => {
  try {
    const raw = String(process.env.EXPO_PUBLIC_NAV_DEBUG ?? '').toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
  } catch {
    return false;
  }
})();

function log(action: string, payload: any) {
  if (!DEBUG_NAV) return;
  try {
    console.log('[nav]', action, payload);
  } catch {}
}

export const nav = {
  push: (href: any) => { log('push', { href }); router.push(href); },
  replace: (href: any) => { log('replace', { href }); router.replace(href); },
  back: () => { log('back', {}); router.back(); },
  canGoBack: () => router.canGoBack?.(),
};

export default nav;
