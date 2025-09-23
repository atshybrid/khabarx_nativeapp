// Legacy stub kept to avoid import errors. Actual eager init now performed in firebaseClient itself.
import { ensureFirebaseAuthAsync, isFirebaseConfigComplete } from './firebaseClient';
(async () => {
  try {
    if (isFirebaseConfigComplete()) {
      const auth = await ensureFirebaseAuthAsync();
      console.log('[AUTH_INIT] (stub preload) auth ready', { appId: auth.app.options.appId });
    }
  } catch {
    // Silent
  }
})();
