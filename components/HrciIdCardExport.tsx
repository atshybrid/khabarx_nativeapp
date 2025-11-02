import * as Sharing from 'expo-sharing';
import React, { useCallback, useImperativeHandle, useRef } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { HrciIdCardFrontExact, HrciIdCardFrontProps } from './HrciIdCardFrontExact';

export interface HrciIdCardExportProps extends HrciIdCardFrontProps {
  // Visible width of the on-screen preview (design units will auto-scale inside)
  previewWidth?: number;
  // Pad the visible preview to a target aspect (e.g., CR80 portrait) rather than using the base card aspect
  previewPadToCR80?: boolean;
  previewTargetAspect?: number;
  // Pixel width to render for export (higher => higher DPI). Recommended 1440 or 2160 for print.
  exportWidth?: number;
  // Best-practice print options: compute export size from physical width & DPI
  widthInInches?: number; // e.g., 2.125 for CR80 portrait width
  dpi?: number; // e.g., 300 or 600
  // Pad to a target aspect ratio container (e.g., CR80 portrait ~ 1.588)
  padToCR80?: boolean; // if true, pad container to 1.588 portrait aspect (3.375 / 2.125)
  targetAspect?: number; // custom target aspect if padToCR80=false
  // Export format controls
  exportFormat?: 'jpg' | 'png';
  jpegQuality?: number; // 0..1, default 1
  // Behavior
  // How to fit the base card aspect (1.42) into the target aspect container
  // - 'pad': contain with padding (no crop, no stretch)
  // - 'cover': fill container by uniform scale and crop overflow
  // - 'stretch': distort to exactly match target aspect (fills without crop)
  fitMode?: 'pad' | 'cover' | 'stretch';
  // Button bar visibility
  showActions?: boolean;
  disableTapToDownload?: boolean;
  // Show a small label with computed export size and physical dimensions
  showExportInfo?: boolean;
}

export interface HrciIdCardExportHandle {
  download: () => Promise<void>;
  share: () => Promise<void>;
  capture: () => Promise<string | null>;
  saveToPhotos: () => Promise<void>;
}

/**
 * Wrapper that renders the HRCI front card and provides high‑resolution JPEG export + share.
 * It renders a hidden high‑DPI card for capture to ensure print-friendly quality.
 */
export const HrciIdCardExport = React.forwardRef<HrciIdCardExportHandle, HrciIdCardExportProps>(({ previewWidth = 360, exportWidth = 2160, showActions = true, ...cardProps }, ref) => {
  const shotRef = useRef<ViewShot>(null);
  const {
    previewPadToCR80,
    previewTargetAspect,
    widthInInches,
    dpi,
    padToCR80,
    targetAspect,
    exportFormat = 'jpg',
    jpegQuality = 1,
    fitMode = 'pad',
    disableTapToDownload,
    showExportInfo,
  } = cardProps as HrciIdCardExportProps;

  // Compute effective export width based on DPI/physical width when provided
  const effectiveExportWidth = (widthInInches && dpi)
    ? Math.max(Math.round(widthInInches * dpi), 300)
    : (typeof exportWidth === 'number' && exportWidth > 0 ? exportWidth : 1440);

  // Base card aspect used by HrciIdCardFrontExact
  const BASE_ASPECT = 1.42;
  const CR80_ASPECT = 3.375 / 2.125; // ~1.588
  const padAspect = padToCR80 ? CR80_ASPECT : (targetAspect || BASE_ASPECT);
  const doPad = !!padToCR80 || (!!targetAspect && Math.abs(targetAspect - BASE_ASPECT) > 0.001);
  const exportHeightPx = Math.round(effectiveExportWidth * (doPad ? padAspect : BASE_ASPECT));
  const heightInches = widthInInches ? +( (widthInInches * (doPad ? padAspect : BASE_ASPECT)).toFixed(3) ) : undefined;

  // Visible preview padding logic (so preview can match CR80 proportions like the back card)
  const previewPadAspect = previewPadToCR80 ? CR80_ASPECT : (previewTargetAspect || BASE_ASPECT);
  const previewDoPad = !!previewPadToCR80 || (!!previewTargetAspect && Math.abs(previewTargetAspect - BASE_ASPECT) > 0.001);
  const previewHeightPx = Math.round(previewWidth * (previewDoPad ? previewPadAspect : BASE_ASPECT));

  const onCapture = useCallback(async (): Promise<string | null> => {
    try {
      // Capture the hidden high‑DPI card as a temp JPG file
      const uri = await shotRef.current?.capture?.();
      return uri ?? null;
    } catch (e: any) {
      console.warn('Capture failed', e);
      Alert.alert('Capture failed', e?.message ?? String(e));
      return null;
    }
  }, []);

  const onDownload = useCallback(async () => {
    const uri = await onCapture();
    if (!uri) return;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Save or Share ID Card (JPEG)',
          UTI: 'public.jpeg',
        });
      } else {
        Alert.alert('Sharing not available', 'Your device does not support the native share sheet.');
      }
    } catch (e: any) {
      console.warn('Download/share failed', e);
      Alert.alert('Download failed', e?.message ?? String(e));
    }
  }, [onCapture]);

  const onShare = useCallback(async () => {
    // For now same as onDownload; could be customized if you add other flows
    return onDownload();
  }, [onDownload]);

  const onSaveToPhotos = useCallback(async () => {
    const uri = await onCapture();
    if (!uri) return;
    try {
      // Preflight: only import expo-media-library if the native module exists in this dev client
      const EMC: any = await import('expo-modules-core');
      const NativeModulesProxy = EMC?.NativeModulesProxy ?? EMC?.default?.NativeModulesProxy;
      const hasNative = !!(NativeModulesProxy?.ExpoMediaLibrary || NativeModulesProxy?.ExponentMediaLibrary);
      if (!hasNative) {
        throw new Error('MediaLibrary native module not available');
      }

      // Dynamically import after confirming native presence to avoid Metro unknown module errors
      const ML: any = await import('expo-media-library');
      const requestPermissionsAsync = ML?.requestPermissionsAsync ?? ML?.default?.requestPermissionsAsync;
      const saveToLibraryAsync = ML?.saveToLibraryAsync ?? ML?.default?.saveToLibraryAsync;
      if (!requestPermissionsAsync || !saveToLibraryAsync) {
        throw new Error('MediaLibrary JS API not available');
      }
      const { status } = await requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow Photos/Media permission to save the image.');
        return;
      }
      await saveToLibraryAsync(uri);
      Alert.alert('Saved', 'ID card saved to Photos.');
    } catch (e: any) {
      console.warn('Save to Photos failed', e);
      // Fallbacks on Android: try Storage Access Framework to save to user-selected folder (e.g., Downloads)
      if (Platform.OS === 'android') {
        try {
          const FS: any = await import('expo-file-system');
          const SAF = FS?.StorageAccessFramework;
          if (SAF) {
            const perm = await SAF.requestDirectoryPermissionsAsync();
            if (perm?.granted && perm.directoryUri) {
              const filename = `HRCI_ID_Front_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}.jpg`;
              const base64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
              const destUri = await SAF.createFileAsync(perm.directoryUri, filename, 'image/jpeg');
              await FS.writeAsStringAsync(destUri, base64, { encoding: FS.EncodingType.Base64 });
              Alert.alert('Saved', 'ID card saved to the selected folder.');
              return;
            }
          }
        } catch (safErr) {
          console.warn('SAF fallback failed', safErr);
        }
      }
      // Last resort: share sheet
      try {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share ID Card (JPEG)', UTI: 'public.jpeg' });
      } catch {}
    }
  }, [onCapture]);

  const onSaveToFiles = useCallback(async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Not available', 'Save to Files is only available on Android here.');
      return;
    }
    const uri = await onCapture();
    if (!uri) return;
    try {
      const FS: any = await import('expo-file-system');
      const SAF = FS?.StorageAccessFramework;
      if (!SAF) throw new Error('Storage Access Framework API not available');
      const perm = await SAF.requestDirectoryPermissionsAsync();
      if (!perm?.granted || !perm.directoryUri) {
        Alert.alert('Cancelled', 'No folder selected.');
        return;
      }
      const filename = `HRCI_ID_Front_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}.jpg`;
      const base64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
      const destUri = await SAF.createFileAsync(perm.directoryUri, filename, 'image/jpeg');
      await FS.writeAsStringAsync(destUri, base64, { encoding: FS.EncodingType.Base64 });
      Alert.alert('Saved', 'ID card saved to the selected folder.');
    } catch (e: any) {
      console.warn('Save to Files failed', e);
      try {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share ID Card (JPEG)', UTI: 'public.jpeg' });
      } catch {}
    }
  }, [onCapture]);

  useImperativeHandle(ref, () => ({
    download: onDownload,
    share: onShare,
    capture: onCapture,
    saveToPhotos: onSaveToPhotos,
  }), [onDownload, onShare, onCapture, onSaveToPhotos]);

  return (
    <View style={styles.root}>
      {/* Visible on-screen preview (tap to download) */}
      {disableTapToDownload ? (
        previewDoPad ? (
          <View style={{ width: previewWidth, height: previewHeightPx, alignItems: 'center', justifyContent: 'center' }}>
            <HrciIdCardFrontExact {...cardProps} width={previewWidth} />
          </View>
        ) : (
          <HrciIdCardFrontExact {...cardProps} width={previewWidth} />
        )
      ) : (
        <TouchableOpacity
          onPress={onDownload}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Download ID card as JPEG"
        >
          {previewDoPad ? (
            <View style={{ width: previewWidth, height: previewHeightPx, alignItems: 'center', justifyContent: 'center' }}>
              <HrciIdCardFrontExact {...cardProps} width={previewWidth} />
            </View>
          ) : (
            <HrciIdCardFrontExact {...cardProps} width={previewWidth} />
          )}
        </TouchableOpacity>
      )}

      {showExportInfo && (
        <Text style={styles.exportInfo}>
          {padToCR80 ? 'Wallet card (CR80)' : (targetAspect ? 'Custom size' : 'Base aspect')}:
          {' '}
          {widthInInches ? `${(widthInInches * 25.4).toFixed(1)}mm` : `${(2.125 * 25.4).toFixed(1)}mm`}
          {' \u00d7 '}
          {heightInches ? `${(heightInches * 25.4).toFixed(1)}mm` : `${((2.125 * (padToCR80 ? CR80_ASPECT : BASE_ASPECT)) * 25.4).toFixed(1)}mm`}
          {` at ${dpi ?? 600} DPI \u2192 ${effectiveExportWidth} \u00d7 ${exportHeightPx} px`}
        </Text>
      )}

      {/* Hidden high‑DPI render for capture */}
      <View style={styles.hiddenCapture} pointerEvents="none" accessibilityElementsHidden>
        {/* If padding to target aspect, wrap card centered inside a container of the target aspect */}
        <ViewShot
          ref={shotRef}
          options={{ format: exportFormat, quality: jpegQuality, result: 'tmpfile' }}
          style={[
            styles.captureWrapper,
            doPad
              ? { width: effectiveExportWidth, height: exportHeightPx, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', overflow: fitMode === 'cover' ? 'hidden' : 'visible' as any }
              : { width: effectiveExportWidth, height: exportHeightPx, backgroundColor: '#F3F4F6' },
          ]}
        >
          {doPad ? (
            fitMode === 'pad' ? (
              <View style={{ width: effectiveExportWidth, height: Math.round(effectiveExportWidth * BASE_ASPECT), alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
                <HrciIdCardFrontExact {...cardProps} width={effectiveExportWidth} />
              </View>
            ) : fitMode === 'cover' ? (
              (() => {
                const innerW0 = effectiveExportWidth;
                const innerH0 = Math.round(effectiveExportWidth * BASE_ASPECT);
                const scale = exportHeightPx / innerH0; // since width matches, scale height to fill
                const scaledW = Math.round(innerW0 * scale);
                const scaledH = Math.round(innerH0 * scale);
                return (
                  <View style={{ width: scaledW, height: scaledH, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
                    <HrciIdCardFrontExact {...cardProps} width={scaledW} />
                  </View>
                );
              })()
            ) : (
              // stretch
              <View style={{ width: effectiveExportWidth, height: exportHeightPx, backgroundColor: 'transparent' }}>
                {/* Stretch by rendering at container width and applying a vertical scale via transform */}
                {(() => {
                  const targetH = exportHeightPx;
                  const baseH = Math.round(effectiveExportWidth * BASE_ASPECT);
                  const vScale = targetH / baseH;
                  return (
                    <View style={{ transform: [{ scaleY: vScale }], transformOrigin: 'top left' as any }}>
                      <HrciIdCardFrontExact {...cardProps} width={effectiveExportWidth} />
                    </View>
                  );
                })()}
              </View>
            )
          ) : (
            <HrciIdCardFrontExact {...cardProps} width={effectiveExportWidth} />
          )}
        </ViewShot>
      </View>

      {showActions && (
        <View style={styles.actionBar} pointerEvents="box-none">
          <TouchableOpacity style={[styles.actionBtn, styles.download]} onPress={onDownload}>
            <Text style={styles.actionText}>Download JPEG</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.save]} onPress={onSaveToPhotos}>
            <Text style={styles.actionText}>Save to Photos</Text>
          </TouchableOpacity>
          {Platform.OS === 'android' && (
            <TouchableOpacity style={[styles.actionBtn, styles.save]} onPress={onSaveToFiles}>
              <Text style={styles.actionText}>Save to Files</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actionBtn, styles.share]} onPress={onShare}>
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});
HrciIdCardExport.displayName = 'HrciIdCardExport';

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingBottom: 72 },
  hiddenCapture: { position: 'absolute', opacity: 0, width: 1, height: 1, left: -9999, top: -9999 },
  captureWrapper: { backgroundColor: 'transparent' },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  download: { backgroundColor: '#111827' },
  save: { backgroundColor: '#10b981' },
  share: { backgroundColor: '#0ea5e9' },
  actionText: { color: '#fff', fontWeight: '800' },
  exportInfo: { marginTop: 8, fontSize: 12, color: '#6b7280', fontWeight: '600', textAlign: 'center' },
});

export default HrciIdCardExport;
