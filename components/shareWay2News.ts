import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, Share as RnCoreShare, ToastAndroid } from 'react-native';

function getNativeShareModule(): any | null {
  if (Platform.OS === 'web') return null;
  try {
    return require('react-native-share')?.default;
  } catch {
    return null;
  }
}

type ShareParams = {
  imagePath?: string; // local file uri or remote url
  title?: string;
  shareUrl?: string;
  deepLink?: string;
};

export const shareWay2News = async ({ imagePath, title, shareUrl }: ShareParams) => {
  try {
    const messageLines: string[] = [];
    if (title) messageLines.push(title);
    if (shareUrl) messageLines.push(`Read: ${shareUrl}`);
    const message = messageLines.filter(Boolean).join('\n');

    // Ensure we have a local file path
    let localUri: string = imagePath || '';
    if (!localUri) throw new Error('No image path provided');

    // If it's remote (http/https), download it first to cache
    if (!localUri.startsWith('file://') && /^https?:\/\//.test(localUri)) {
      try {
        const ext = (localUri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
        const baseDir = ((FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '');
        const dest = baseDir + `khabarx-share-way2news.${['jpg','jpeg','png','webp'].includes(ext) ? ext : 'jpg'}`;
        const dl = await (FileSystem as any).downloadAsync(localUri, dest);
        if (dl?.uri) localUri = dl.uri;
      } catch (e) {
        console.warn('[shareWay2News] download failed, proceeding with original uri', e);
      }
    }

    // Copy caption to clipboard first so user can paste in WhatsApp
    try {
      if (message) await Clipboard.setStringAsync(message);
      if (Platform.OS === 'android') {
        try { ToastAndroid.show('Caption copied. Paste in WhatsApp if needed.', ToastAndroid.SHORT); } catch {}
      }
    } catch (e) { /* ignore */ }

    // Prefer react-native-share to attach image + caption
    try {
      const nativeShare = getNativeShareModule();
      if (!nativeShare) throw new Error('react-native-share not available');
      await nativeShare.open({ title: title || 'Share', message, url: localUri, type: 'image/*', failOnCancel: false });
      return true;
    } catch (err) {
      // fall through
    }

    // Fallback to expo-sharing (image only)
    try {
      if (await Sharing.isAvailableAsync()) {
        await (Sharing as any).shareAsync(String(localUri), { dialogTitle: title || 'Share' });
        return true;
      }
    } catch (err) {
      console.warn('[shareWay2News] expo-sharing failed', err);
    }

    // Final fallback: RN core Share text-only
    try {
      await (RnCoreShare as any).share({ title, message });
      return true;
    } catch (err) {
      console.warn('[shareWay2News] RN core Share fallback failed', err);
    }

    return false;
  } catch (e) {
    console.error('[shareWay2News] failed', e);
    return false;
  }
};
