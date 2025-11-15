import React, { useCallback, useState } from 'react';
import { Image, LayoutChangeEvent, NativeSyntheticEvent, Platform, StyleSheet, Text, TextLayoutEventData, View } from 'react-native';

/**
 * Standard ID-1 size (credit card) aspect ratio front design.
 * ISO/IEC 7810 ID-1 dimensions: 85.6mm × 54mm (ratio ~0.631). We treat width as 85.6 units.
 */
export interface HrciIdCardFrontStandardProps {
  topTitle?: string; // custom text for the top red band title
  memberName: string;
  designation: string;
  /** Optional level/title to combine with designation (e.g., District, State). Rendered as "Designation, Level" */
  designationLevel?: string;
  cellName: string;
  /** Derived work place name (district / mandal / state / zone / country) */
  workPlace?: string;
  idNumber: string;
  contactNumber: string;
  validUpto: string;
  logoUri?: string;
  photoUri?: string;
  stampUri?: string;
  authorSignUri?: string;
  qrUri?: string; // Optional QR code image
  issueDate?: string; // Optional extra field
  zone?: string; // Optional zone field
  // Physical sizing (optional, improves band exact heights)
  widthInInches?: number; // CR80: 3.375 (landscape) or 2.125 (portrait)
  heightInInches?: number; // CR80: 2.125 (landscape) or 3.375 (portrait)
  bandHeightInches?: number; // Height of red/blue bands in inches (default 0.25in)
  // Optional precise section heights (if provided, take precedence for matching print inches)
  topBandHeightInches?: number;
  blueBandHeightInches?: number;
  bodyHeightInches?: number; // white middle area between top bands and bottom red
  bottomBandHeightInches?: number;
  width?: number; // target render width in px (height derived)
  orientation?: 'landscape' | 'portrait'; // portrait => 3.375in x 2.125in
  style?: any;
  // Portrait controls
  photoPosition?: 'left' | 'center' | 'right';
  showJurisdiction?: boolean;
  showNitiLine?: boolean;
  showIdentityHeading?: boolean;
  bottomTextOverride?: string;
  // Callback to report computed section sizes (pixels & inches) after layout calc
  onSectionsComputed?: (sections: {
    topBandPx: number; blueBandPx: number; bodyPx: number; bottomBandPx: number;
    topBandIn: number; blueBandIn: number; bodyIn: number; bottomBandIn: number; totalHeightIn: number;
  }) => void;
  showSectionDebug?: boolean; // overlay text listing computed inches
  // Landscape-only: choose which side to show the member photo (default 'left' for backward compatibility)
  landscapePhotoSide?: 'left' | 'right';
  // Landscape-only: optional QR column and side
  landscapeQrSide?: 'left' | 'right';
  qrSizePx?: number;
  // Landscape-only: photo sizing controls
  landscapePhotoAspect?: number; // width/height ratio, default 2 (2:1)
  landscapePhotoWidthInches?: number; // physical width in inches for photo (overrides px)
  landscapePhotoWidthPx?: number; // fallback pixel width if inches not provided
  landscapePhotoHeightInches?: number; // alternatively specify physical height in inches
  landscapePhotoHeightPx?: number; // fallback pixel height
  landscapePhotoScale?: number; // multiply computed w/h by this (e.g., 0.9 to shrink)
  landscapePhotoTopOffsetPx?: number; // shift photo block vertically (negative = up)
  showSignatureUnderPhoto?: boolean; // move signature image + label beneath photo in photo column
  landscapePhotoHorizontalOffsetPx?: number; // shift photo horizontally (positive = move right)
  landscapeStampScale?: number; // multiply stamp size (after base proportion), e.g., 0.5 to shrink
  // Landscape-only: stamp placement
  landscapeStampPosition?: 'overlap' | 'above' | 'below'; // overlap places stamp over photo (default); above/below places a larger stamp separate from the photo
  landscapeStampAboveScale?: number; // when above, factor of min(photoW, photoH) to size stamp (default 1.2)
  landscapeStampBelowScale?: number; // when below, factor of min(photoW, photoH) to size stamp (defaults to landscapeStampAboveScale)
  showQrBelowLogo?: boolean; // if true and qrUri provided, show QR (same size as logo) directly below logo in left column
  /** Optional explicit scale factor for very large (print) widths. If not provided and width > 860, auto-scale fonts & elements. */
  wideScale?: number;
}

const RED = '#FE0002';
const BLUE = '#17007A';

export const HrciIdCardFrontStandard: React.FC<HrciIdCardFrontStandardProps> = ({
  topTitle,
  memberName,
  designation,
  designationLevel,
  cellName,
  workPlace,
  idNumber,
  contactNumber,
  validUpto,
  logoUri,
  photoUri,
  stampUri,
  authorSignUri,
  qrUri,
  issueDate,
  zone,
  widthInInches,
  heightInInches,
  bandHeightInches = 0.25,
  topBandHeightInches,
  blueBandHeightInches,
  bodyHeightInches,
  bottomBandHeightInches,
  width = 340,
  orientation = 'landscape',
  style,
  photoPosition = 'right',
  showJurisdiction = true,
  showNitiLine = true,
  showIdentityHeading = true,
  bottomTextOverride,
  onSectionsComputed,
  showSectionDebug,
  landscapePhotoSide = 'right',
  landscapeQrSide,
  qrSizePx = 64,
  // Passport photo standard is 35mm x 45mm (width:height ≈ 0.7778). Use that as default.
  landscapePhotoAspect = 35/45,
  landscapePhotoWidthInches,
  landscapePhotoWidthPx,
  landscapePhotoHeightInches,
  landscapePhotoHeightPx,
  landscapePhotoScale = 1,
  landscapePhotoTopOffsetPx = -40,
  showSignatureUnderPhoto = true,
  landscapePhotoHorizontalOffsetPx = 0,
  landscapeStampScale = 1,
  landscapeStampPosition = 'overlap',
  landscapeStampAboveScale = 1.2,
  landscapeStampBelowScale,
  showQrBelowLogo = false,
  wideScale,
}) => {
  const TITLE_DEFAULT = 'HUMAN RIGHTS COUNCIL FOR INDIA (HRCI)';
  const TOP_TITLE = (topTitle || TITLE_DEFAULT);
  // Dynamic letter-spacing so the red band title stretches left->right neatly.
  const [landscapeBandWidth, setLandscapeBandWidth] = useState<number | null>(null);
  const [portraitBandWidth, setPortraitBandWidth] = useState<number | null>(null);
  const [landscapeLS, setLandscapeLS] = useState<number | undefined>(undefined);
  const [portraitLS, setPortraitLS] = useState<number | undefined>(undefined);
  // Fallback font scaling to guarantee full fit when title is wider than band
  const [landscapeScale, setLandscapeScale] = useState<number>(1);
  const [portraitScale, setPortraitScale] = useState<number>(1);
  // Blue band dynamic spacing (multi-line)
  const [landscapeBlueBandWidth, setLandscapeBlueBandWidth] = useState<number | null>(null);
  const [portraitBlueBandWidth, setPortraitBlueBandWidth] = useState<number | null>(null);
  const [landscapeBlueLS, setLandscapeBlueLS] = useState<number | undefined>(undefined);
  const [portraitBlueLS, setPortraitBlueLS] = useState<number | undefined>(undefined);

  const adjustTitleFit = useCallback((bandWidth: number, measuredWidth: number, currentLS: number | undefined, setLS: (v: number | undefined) => void, currentScale: number, setScale: (v: number) => void) => {
    if (measuredWidth <= 0 || bandWidth <= 0) return;
    // We first ensure the raw text (no spacing) fits; only after a stable fit we expand horizontally.
    const safeInset = 2; // px margin to avoid edge clipping of last characters like ')'
    const targetInner = bandWidth - safeInset;
    const tolerance = 0.5;
    const chars = Math.max(TOP_TITLE.length, 2);
    const gaps = chars - 1;
    // If currently wider than target, shrink scale until it fits; keep letterSpacing neutral
    if (measuredWidth > targetInner + tolerance) {
      if (currentLS !== 0) setLS(0);
      const shrinkFactor = 0.96; // gentle step
      const nextScale = Math.max(0.70, parseFloat((currentScale * shrinkFactor).toFixed(3)));
      if (nextScale < currentScale - 0.002) {
        setScale(nextScale);
        return; // wait for next layout pass
      }
      // If we've shrunk to min and still overflow (rare), force slight negative spacing as a last resort
      const overflow = measuredWidth - targetInner;
      if (overflow > tolerance) {
        const perGapReduce = overflow / gaps;
        const desiredNeg = -Math.min(perGapReduce, 0.8); // cap compression
        if (currentLS == null || currentLS > desiredNeg + 0.02) setLS(desiredNeg);
      }
      return;
    }
    // Text fits raw. If we had previously shrunk, we can try to gently grow scale back toward 1 before spacing.
    if (currentScale < 1 && measuredWidth < targetInner * 0.94) {
      const growFactor = 1.015;
      const nextScale = Math.min(1, parseFloat((currentScale * growFactor).toFixed(3)));
      if (nextScale > currentScale + 0.002) {
        setScale(nextScale);
        return;
      }
    }
    // Now apply positive letterSpacing to fill remaining horizontal space.
    const remaining = targetInner - measuredWidth;
    if (remaining > tolerance) {
      const desiredLS = remaining / gaps;
      const clampedLS = Math.min(Math.max(desiredLS, 0.15), 5.5);
      if (currentLS == null || Math.abs(clampedLS - currentLS) > 0.02) {
        setLS(clampedLS);
        return;
      }
    } else {
      // Close enough; normalize tiny negative or positive spacing.
      if (currentLS && Math.abs(currentLS) < 0.12) setLS(0);
    }
  }, [TOP_TITLE]);

  const onLandscapeTitleLayout = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (!landscapeBandWidth) return;
    const line = e.nativeEvent.lines?.[0];
    if (!line) return;
    // Detect clipping: if the rendered line text is shorter than the full title, it's clipped
    const isClipped = (line.text ?? '') !== TOP_TITLE;
    if (isClipped) {
      // Gradually reduce scale until full text renders; reset spacing to avoid extra width
      const nextScale = Math.max(0.7, parseFloat((landscapeScale * 0.96).toFixed(3)));
      if (Math.abs(nextScale - landscapeScale) > 0.005) {
        if (landscapeLS) setLandscapeLS(0);
        setLandscapeScale(nextScale);
        return;
      }
    }
    adjustTitleFit(landscapeBandWidth, line.width, landscapeLS, setLandscapeLS, landscapeScale, setLandscapeScale);
  }, [landscapeBandWidth, landscapeLS, landscapeScale, adjustTitleFit, TOP_TITLE]);

  const onPortraitTitleLayout = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (!portraitBandWidth) return;
    const line = e.nativeEvent.lines?.[0];
    if (!line) return;
    const isClipped = (line.text ?? '') !== TOP_TITLE;
    if (isClipped) {
      const nextScale = Math.max(0.7, parseFloat((portraitScale * 0.96).toFixed(3)));
      if (Math.abs(nextScale - portraitScale) > 0.005) {
        if (portraitLS) setPortraitLS(0);
        setPortraitScale(nextScale);
        return;
      }
    }
    adjustTitleFit(portraitBandWidth, line.width, portraitLS, setPortraitLS, portraitScale, setPortraitScale);
  }, [portraitBandWidth, portraitLS, portraitScale, adjustTitleFit, TOP_TITLE]);

  const onLandscapeBandLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (!landscapeBandWidth || Math.abs(w - landscapeBandWidth) > 1) {
      setLandscapeBandWidth(w);
      // Reset LS so it can recalc after width change
      setLandscapeLS(undefined);
      setLandscapeScale(1);
    }
  }, [landscapeBandWidth]);

  const onPortraitBandLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (!portraitBandWidth || Math.abs(w - portraitBandWidth) > 1) {
      setPortraitBandWidth(w);
      setPortraitLS(undefined);
      setPortraitScale(1);
    }
  }, [portraitBandWidth]);
  
  // Compute blue band letterSpacing to expand lines toward edges without overflow
  const computeBlueLetterSpacing = useCallback((bandWidth: number, lines: { width: number; text?: string }[]) => {
    if (!bandWidth || !lines || !lines.length) return 0;
    const inset = 4; // leave a bit more margin than red band
    const tolerance = 0.5;
    const target = Math.max(0, bandWidth - inset);
    let bestLS: number | undefined;
    for (const line of lines) {
      const w = line.width ?? 0;
      const t = line.text ?? '';
      const chars = Math.max(t.length, 2);
      const gaps = Math.max(chars - 1, 1);
      if (w < target - tolerance) {
        const desired = (target - w) / gaps;
        const clamped = Math.min(Math.max(desired, 0.15), 2.0);
        bestLS = (bestLS == null) ? clamped : Math.min(bestLS, clamped);
      } else {
        // this line already near/full; enforce no negative spacing
        bestLS = (bestLS == null) ? 0 : Math.min(bestLS, 0);
      }
    }
    return bestLS ?? 0;
  }, []);

  const onLandscapeBlueBandLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (!landscapeBlueBandWidth || Math.abs(w - landscapeBlueBandWidth) > 1) {
      setLandscapeBlueBandWidth(w);
      setLandscapeBlueLS(undefined);
    }
  }, [landscapeBlueBandWidth]);

  const onPortraitBlueBandLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (!portraitBlueBandWidth || Math.abs(w - portraitBlueBandWidth) > 1) {
      setPortraitBlueBandWidth(w);
      setPortraitBlueLS(undefined);
    }
  }, [portraitBlueBandWidth]);

  const onLandscapeBlueTextLayout = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (!landscapeBlueBandWidth) return;
    const lines = e.nativeEvent.lines?.map(l => ({ width: l.width, text: l.text })) ?? [];
    const ls = computeBlueLetterSpacing(landscapeBlueBandWidth, lines);
    if (landscapeBlueLS == null || Math.abs(ls - landscapeBlueLS) > 0.02) setLandscapeBlueLS(ls);
  }, [landscapeBlueBandWidth, computeBlueLetterSpacing, landscapeBlueLS]);

  const onPortraitBlueTextLayout = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (!portraitBlueBandWidth) return;
    const lines = e.nativeEvent.lines?.map(l => ({ width: l.width, text: l.text })) ?? [];
    const ls = computeBlueLetterSpacing(portraitBlueBandWidth, lines);
    if (portraitBlueLS == null || Math.abs(ls - portraitBlueLS) > 0.02) setPortraitBlueLS(ls);
  }, [portraitBlueBandWidth, computeBlueLetterSpacing, portraitBlueLS]);
  const landscapeAspect = 54 / 85.6; // ~0.631
  const portraitAspect = 3.375 / 2.125; // ~1.588 (H/W)
  const physWInDefault = orientation === 'portrait' ? 2.125 : 3.375;
  const physHInDefault = orientation === 'portrait' ? 3.375 : 2.125;
  const physWIn = widthInInches ?? physWInDefault;
  const physHIn = heightInInches ?? physHInDefault;
  const pxPerIn = width / physWIn;
  const aspect = orientation === 'portrait' ? portraitAspect : landscapeAspect;
  // Prefer physical inches for height when provided to ensure print-exact proportions
  const height = (widthInInches && heightInInches)
    ? Math.round(pxPerIn * physHIn)
    : Math.round(width * aspect);

  // Note: Designation string comes from designation prop; if a level is provided, you may choose to incorporate it upstream.

  // Compute band height (in inches) to pixels using physical width mapping
  const fallbackBandPx = Math.max(24, Math.round(width * ((bandHeightInches || 0.25) / physWIn)));
  // If explicit inch heights provided, compute exact pixel heights for sections
  const topBandPx = (topBandHeightInches ?? null) != null
    ? Math.max(0, Math.round(pxPerIn * (topBandHeightInches as number)))
    : fallbackBandPx;
  const blueBandPx = (blueBandHeightInches ?? null) != null
    ? Math.max(0, Math.round(pxPerIn * (blueBandHeightInches as number)))
    : fallbackBandPx;
  const bottomBandPxExplicit = (bottomBandHeightInches ?? null) != null
    ? Math.max(0, Math.round(pxPerIn * (bottomBandHeightInches as number)))
    : undefined;
  // If bodyHeightInches not passed, but phys height and other sections exist, derive body inches
  const bodyHeightInchesDerived = (bodyHeightInches ?? null) != null
    ? bodyHeightInches
    : ((heightInInches && ((topBandHeightInches ?? bandHeightInches) || blueBandHeightInches || bottomBandHeightInches))
      ? Math.max(0,
        heightInInches -
        (topBandHeightInches ?? bandHeightInches ?? 0) -
        (blueBandHeightInches ?? bandHeightInches ?? 0) -
        (bottomBandHeightInches ?? 0)
      )
      : undefined);
  const bodyPxExplicit = (bodyHeightInchesDerived ?? null) != null
    ? Math.max(0, Math.round(pxPerIn * (bodyHeightInchesDerived as number)))
    : undefined;
  // Blue band font sizing to fit three lines inside band height (reduced padding for 0.25in)
  const blueVPad = orientation === 'portrait' ? 2 : 2;
  const blueAvail = Math.max((blueBandPx ?? fallbackBandPx) - blueVPad, 12);
  // Make blue text intentionally smaller
  const blueFS = Math.max(5, Math.floor(blueAvail / 3) - 3);
  const blueLH = Math.max(blueFS + 1, Math.floor(blueFS * 1.12));
  // Red header font size proportional to band height (auto-fit will adjust horizontally)
  const redFS = Math.max(10, Math.floor((topBandPx ?? fallbackBandPx) * 0.50));

  // Wide scaling logic (for high-DPI render beyond design width). Base design reference 720.
  // Auto scale only interior (details/photo/signature); keep bands fixed for proportional consistency.
  const autoScale = wideScale != null ? wideScale : (width > 860 ? (width / 720) : 1);
  const wScale = Math.max(1, autoScale);

  // Helper to scale a numeric value only when capturing wide.
  const S = (n: number) => Math.round(n * wScale);

  // Report computed section sizes when requested (use physical width for inch conversion)
  if (onSectionsComputed) {
    try {
      const topPxVal = topBandPx ?? fallbackBandPx;
      const bluePxVal = blueBandPx ?? fallbackBandPx;
      const bottomPxVal = bottomBandPxExplicit ?? 0; // if not explicit, approximate using rendered style later
      const bodyPxVal = (orientation === 'portrait')
        ? 0 // portrait body segmentation not currently requested
        : (bodyPxExplicit != null ? bodyPxExplicit : 0);
      const toIn = (px: number) => px / pxPerIn;
      onSectionsComputed({
        topBandPx: topPxVal,
        blueBandPx: bluePxVal,
        bodyPx: bodyPxVal,
        bottomBandPx: bottomPxVal,
        topBandIn: toIn(topPxVal),
        blueBandIn: toIn(bluePxVal),
        bodyIn: toIn(bodyPxVal),
        bottomBandIn: toIn(bottomPxVal),
        totalHeightIn: physHIn,
      });
    } catch {/* silent */}
  }

  if (orientation === 'portrait') {
    return (
      <View style={[styles.card, { width, height }, style]}>
        <View style={[styles.pTopRed, { height: topBandPx ?? fallbackBandPx }]} onLayout={onPortraitBandLayout}>
          <Text
            style={[styles.pTopTitle, { fontSize: Math.round(redFS * portraitScale), letterSpacing: portraitLS ?? 0 }]}
            numberOfLines={1}
            allowFontScaling={false}
            ellipsizeMode="clip"
            onTextLayout={onPortraitTitleLayout}
          >
              {TOP_TITLE}
          </Text>
        </View>
        <View style={[styles.pBlueBand, { height: blueBandPx ?? fallbackBandPx }]} onLayout={onPortraitBlueBandLayout}>
          <Text
            style={[styles.pBlueBandText, { fontSize: blueFS, lineHeight: blueLH, letterSpacing: portraitBlueLS ?? 0 }]}
            numberOfLines={3}
            allowFontScaling={false}
            onTextLayout={onPortraitBlueTextLayout}
          >
            REGISTERED BY NCT, NEW DELHI, GOVT OF INDIA{"\n"}
            REGISTERED NO: 4396/2022 (UNDER TRUST ACT 1882){"\n"}
            TO PROTECT & PROMOTE THE HUMAN RIGHTS
          </Text>
        </View>
        <View style={styles.pLogoWrap}>{logoUri ? <Image source={{ uri: logoUri }} style={styles.pLogo} /> : <View style={[styles.pLogo, styles.placeholder, { backgroundColor: 'transparent' }]}><Text style={styles.phSmall}>LOGO</Text></View>}</View>

        {showJurisdiction && (
          <Text style={styles.pJurisdictionVerdana} numberOfLines={1}>ALL INDIA JURISDICTION</Text>
        )}
        {showNitiLine && (
          <>
            <Text style={[styles.nitiTight, { marginTop: 2 }]} numberOfLines={1}>REGD BY GOVT OF &quot;NITI AAYOG&quot;</Text>
            <Text style={[styles.nitiTightSmall, { marginTop: 0 }]} numberOfLines={1}>UNIQUE ID: AP/2022/0324217,AP/2022/0326782</Text>
            <Text style={[styles.worksAgainstLine, { marginTop: 1 }]} numberOfLines={1}>WORKS AGAINST CRIME, VIOLENCE AND CORRUPTION</Text>
            {showIdentityHeading && (
              <Text style={[styles.identityCardInline, { marginTop: 1 }]} numberOfLines={1}>IDENTITY CARD</Text>
            )}
          </>
        )}

        {/* Main portrait content: details (left/center) and photo (right) */}
        <View style={[styles.pMain, photoPosition === 'center' ? { alignItems: 'center' } : {}]}>
          {/* Optional QR on far left */}
          {!!qrUri && (
            <View style={styles.pQrWrap}>
              <Image source={{ uri: qrUri }} style={styles.pQr} />
            </View>
          )}

          {/* Details block */}
          <View style={[styles.pCenterBlock, photoPosition === 'center' ? { alignItems: 'center' } : { flex: 1 }]}>
            {/* Show Name first, then Designation, then Cell (single-line only) */}
            <Text style={styles.pName} numberOfLines={1}>{memberName}</Text>
            <Text style={styles.pDesignation} numberOfLines={1}>{designation}</Text>
            <Text style={styles.pCell} numberOfLines={1}>{cellName}</Text>
            <View style={styles.pDetailsContainer}>
              <View style={styles.pDetails}>
                <Detail label="Name" value={memberName} />
                <Detail label="Designation" value={designation} />
                <Detail label="Cell" value={cellName} />
                <Detail label="Work Place" value={workPlace || ''} />
                <Detail label="ID" value={idNumber} />
                <Detail label="Mob" value={contactNumber} />
                <Detail label="Valid" value={validUpto} />
                {!!issueDate && <Detail label="Issue Date" value={issueDate} />}
              </View>
            </View>
          </View>

          {/* Photo on the right/center */}
          {(photoPosition === 'right' || photoPosition === 'center' || photoPosition === 'left') && (
            <View style={[styles.pPhotoWrap, photoPosition === 'right' ? { alignSelf: 'flex-end' } : photoPosition === 'left' ? { alignSelf: 'flex-start' } : {}]}>
              {photoUri ? <Image source={{ uri: photoUri }} style={styles.pPhoto} /> : <View style={[styles.pPhoto, styles.placeholder]}><Text style={styles.phSmall}>PHOTO</Text></View>}
              {stampUri ? <Image source={{ uri: stampUri }} style={styles.pStamp} /> : <View style={[styles.pStamp, styles.placeholder]}><Text style={styles.phTiny}>STAMP</Text></View>}
            </View>
          )}
        </View>

  <View style={styles.pSignatureBox}>{authorSignUri ? <Image source={{ uri: authorSignUri }} style={styles.pSignature} resizeMode="contain" /> : <View style={[styles.pSignature, styles.placeholder]}><Text style={styles.phTiny}>SIGN</Text></View>}</View>
  <Text style={styles.pAuthLabel}>Signature Issue Auth.</Text>
        <View style={[styles.pBottomRed, (bottomBandPxExplicit != null) ? { height: bottomBandPxExplicit, justifyContent: 'center', paddingVertical: 0 } : null]}>
          <Text style={styles.pBottomText} numberOfLines={3}>{bottomTextOverride ?? 'We take help 24x7 From (Police, CBI, Vigilance, NIA) & other Govt. Dept.'}</Text>
        </View>
        {showSectionDebug && (
          <View style={styles.debugOverlay} pointerEvents="none">
            <Text style={styles.debugText}>
              Top: {( (topBandPx ?? fallbackBandPx) / pxPerIn ).toFixed(4)} in\n
              Blue: {( (blueBandPx ?? fallbackBandPx) / pxPerIn ).toFixed(4)} in\n
              Bottom: {( (bottomBandPxExplicit ?? 0) / pxPerIn ).toFixed(4)} in\n
              Total: {physHIn.toFixed(4)} in
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Landscape (default)
  return (
    <View style={[styles.card, { width, height }, style]}>
      <View style={[styles.topRed, { height: topBandPx ?? fallbackBandPx }]} onLayout={onLandscapeBandLayout}>
        <Text
          style={[styles.topTitle, { fontSize: Math.round(redFS * landscapeScale), letterSpacing: landscapeLS ?? 0 }]}
          numberOfLines={1}
          allowFontScaling={false}
          ellipsizeMode="clip"
          onTextLayout={onLandscapeTitleLayout}
        >
          {TOP_TITLE}
        </Text>
      </View>
      <View style={[styles.blueBand, { height: blueBandPx ?? fallbackBandPx }]} onLayout={onLandscapeBlueBandLayout}>
        <Text
          style={[styles.blueBandText, { fontSize: blueFS, lineHeight: blueLH, letterSpacing: landscapeBlueLS ?? 0 }]}
          numberOfLines={3}
          allowFontScaling={false}
          onTextLayout={onLandscapeBlueTextLayout}
        >
          REGISTERED BY NCT, NEW DELHI, GOVT OF INDIA{"\n"}
          REGISTERED NO: 4396/2022 (UNDER TRUST ACT 1882){"\n"}
          TO PROTECT & PROMOTE THE HUMAN RIGHTS
        </Text>
      </View>
      {/* White body area wrapper (optional fixed height when inches provided) */}
      {(() => {
        // Compute body height in px, adjusting for rounding to match outer height if all sections fixed
        const bottomPx = bottomBandPxExplicit;
        let bodyPx = bodyPxExplicit;
        if ((topBandPx != null) && (blueBandPx != null) && (bottomPx != null) && (bodyPx != null)) {
          const sum = topBandPx + blueBandPx + bodyPx + bottomPx;
          const delta = height - sum;
          bodyPx = Math.max(0, bodyPx + delta); // adjust body to fill remainder (can be -1,0,+1 px)
        }
        return (
          <View style={[styles.bodyWrap, (bodyPx != null) ? { height: bodyPx } : { flex: 1 }]}>
            {/* Centered jurisdiction and NITI lines under blue band */}
            <View style={styles.jurisdictionWrap}>
              <Text style={[styles.pJurisdictionVerdana, { marginTop: 4 }, wScale>1 && { fontSize: S(11), lineHeight: S(13) }]} numberOfLines={1}>ALL INDIA JURISDICTION</Text>
              <Text style={[styles.nitiTight, { marginTop: 2 }, wScale>1 && { fontSize: S(8), lineHeight: S(10) }]} numberOfLines={1}>REGD BY GOVT OF &quot;NITI AAYOG&quot;</Text>
              <Text style={[styles.nitiTightSmall, { marginTop: 0 }, wScale>1 && { fontSize: S(7), lineHeight: S(9) }]} numberOfLines={1}>UNIQUE ID: AP/2022/0324217,AP/2022/0326782</Text>
              <Text style={[styles.worksAgainstLine, { marginTop: 1 }, wScale>1 && { fontSize: S(6.5), lineHeight: S(9) }]} numberOfLines={1}>WORKS AGAINST CRIME, VIOLENCE AND CORRUPTION</Text>
              {showIdentityHeading && (
                <Text style={[styles.identityCardInline, { marginTop: 1 }, wScale>1 && { fontSize: S(8.5), lineHeight: S(11) }]} numberOfLines={1}>IDENTITY CARD</Text>
              )}
            </View>
            {landscapePhotoSide === 'right' ? (
              <View style={styles.mainRow}>
                {/* Left column: logo + optional QR (shrink width to free detail space) */}
                <View style={[styles.leftCol, { width: S(showQrBelowLogo ? 72 : 62) }]}>
                  <View style={styles.logoWrap}>
                    {logoUri && (
                      <Image source={{ uri: logoUri }} style={[styles.logo, { width: S(54), height: S(54) }]} />
                    )}
                    {!logoUri && (
                      <View style={[styles.logo, styles.placeholder, { backgroundColor: 'transparent', width: S(54), height: S(54) }]}>
                        <Text style={[styles.phSmall, wScale>1 && {fontSize:S(8)}]}>LOGO</Text>
                      </View>
                    )}
                  </View>
                  {showQrBelowLogo && qrUri && (
                    <View style={styles.qrBelowLogoWrap}>
                      <Image source={{ uri: qrUri }} style={[styles.qrBelowLogo, { width: S(54), height: S(54) }]} />
                    </View>
                  )}
                </View>
                {/* Center: all details centered */}
                <View style={[styles.centerColCentered, styles.centerNudgeRight]}>
                  {/* Exact order: Name → Designation → Cell → Work Place → ID → Mob → Valid */}
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>Name</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]} numberOfLines={1}>{memberName}</Text>
                  </View>
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>Designation</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]} numberOfLines={1}>{designation}</Text>
                  </View>
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>Cell</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]} numberOfLines={1}>{cellName}</Text>
                  </View>
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>Work Place</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]} numberOfLines={1}>{workPlace || ''}</Text>
                  </View>
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>ID</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]} numberOfLines={1}>{idNumber}</Text>
                  </View>
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>Mob</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]} numberOfLines={1}>{contactNumber}</Text>
                  </View>
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>Valid</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(7.2), lineHeight:S(8)}]} numberOfLines={1}>{validUpto}</Text>
                  </View>
                </View>
                {/* Right: photo + stamp */}
                {(() => {
                  // Compute landscape photo size.
                  // Priority: explicit height (inches/px) -> explicit width (inches/px) -> derive from body height proportion.
                  const proportionFromBody = 0.52; // passport: keep a bit smaller vertically
                  let hPxBase: number | undefined;
                  let wPxBase: number | undefined;
                  if (landscapePhotoHeightInches != null) {
                    hPxBase = Math.round(pxPerIn * landscapePhotoHeightInches);
                  } else if (landscapePhotoHeightPx != null) {
                    hPxBase = Math.round(landscapePhotoHeightPx);
                  } else if (landscapePhotoWidthInches != null) {
                    wPxBase = Math.round(pxPerIn * landscapePhotoWidthInches);
                  } else if (landscapePhotoWidthPx != null) {
                    wPxBase = Math.round(landscapePhotoWidthPx);
                  } else if (bodyPxExplicit != null) {
                    hPxBase = Math.round(bodyPxExplicit * proportionFromBody);
                  }
                    const aspect = Math.max(landscapePhotoAspect || (35/45), 0.05); // width/height passport default
                  let hPx0 = Math.max(28, Math.round(hPxBase != null ? hPxBase : (wPxBase != null ? Math.round(wPxBase / aspect) : 86)));
                  let wPx0 = Math.max(20, Math.round(wPxBase != null ? wPxBase : Math.round(hPx0 * aspect)));
                  // Apply scale for right side; do not shrink at high DPI so photo fills space
                  const scaleDownForRightSide = wScale > 1 ? 1.0 : 0.6;
                  const wPx = Math.max(28, Math.round(wPx0 * landscapePhotoScale * scaleDownForRightSide));
                  const hPx = Math.max(36, Math.round(hPx0 * landscapePhotoScale * scaleDownForRightSide));
                  const separateStampScale = landscapeStampPosition === 'above'
                    ? (landscapeStampAboveScale ?? 2)
                    : (landscapeStampBelowScale ?? landscapeStampAboveScale ?? 2);
                  const stampFactor = (landscapeStampPosition === 'overlap' ? 1 : separateStampScale);
                  const colWidth = S(110); // scale column width
                  const maxStampPx = colWidth - 6; // small inset
                  const stampPxRaw = Math.round(Math.min(wPx, hPx) * stampFactor * landscapeStampScale);
                  const stampPx = Math.min(stampPxRaw, maxStampPx);
                  return (
                    <View style={[styles.photoCol, styles.photoColRight, { width: Math.max(Math.max(wPx, stampPx), (showSignatureUnderPhoto ? S(70) : 0)) }]}>
                      {/* Wrap photo and optional stamps in a relative box so photo stays top-aligned */}
                      <View style={{ width: Math.max(wPx, stampPx), alignItems: 'flex-end', position: 'relative' }}>
                        {(() => {
                          // Prevent overflow on the right; enforce 10px right margin space inside card edge.
                          // Enforce a 10px right margin by forbidding positive (rightward) translation.
                          return (
                            <View style={[styles.photoWrap, { width: wPx, height: hPx, transform: [{ translateY: (landscapePhotoTopOffsetPx || 0) - S(20) }] }]}>
                              {photoUri ? <Image source={{ uri: photoUri }} style={[styles.photo, { width: wPx, height: hPx }]} /> : <View style={[styles.photo, styles.placeholder, { width: wPx, height: hPx }]}><Text style={styles.phSmall}>PHOTO</Text></View>}
                              {landscapeStampPosition === 'overlap' && (
                                stampUri ? <Image source={{ uri: stampUri }} style={[styles.stamp, { width: stampPx, height: stampPx, borderRadius: stampPx/2 }]} /> : <View style={[styles.stamp, styles.placeholder, { width: stampPx, height: stampPx, borderRadius: stampPx/2 }]}><Text style={[styles.phTiny, wScale>1 && {fontSize:S(6)}]}>STAMP</Text></View>
                              )}
                            </View>
                          );
                        })()}
                        {/* Optional stamp above the photo (absolute so it doesn't push photo down) */}
                        {landscapeStampPosition === 'above' && (
                          <View style={{ position: 'absolute', top: -(stampPx + 4), left: 0, right: 0, alignItems: 'center' }}>
                            {stampUri ? (
                              <Image source={{ uri: stampUri }} style={{ width: stampPx, height: stampPx, borderRadius: stampPx/2 }} />
                            ) : (
                              <View style={[styles.placeholder, { width: stampPx, height: stampPx, borderRadius: stampPx/2 }]}><Text style={styles.phTiny}>STAMP</Text></View>
                            )}
                          </View>
                        )}
                        {/* Optional stamp below the photo */}
                        {landscapeStampPosition === 'below' && (
                          <View style={{ width: Math.max(wPx, stampPx), alignItems: 'center', marginTop: 4 }}>
                            {stampUri ? (
                              <Image source={{ uri: stampUri }} style={{ width: stampPx, height: stampPx, borderRadius: stampPx/2 }} />
                            ) : (
                              <View style={[styles.placeholder, { width: stampPx, height: stampPx, borderRadius: stampPx/2 }]}><Text style={styles.phTiny}>STAMP</Text></View>
                            )}
                          </View>
                        )}
                      </View>
                      {showSignatureUnderPhoto ? (
                        <View style={styles.signatureUnderPhoto}>
                          {authorSignUri ? (
                            <Image source={{ uri: authorSignUri }} style={[styles.photoSigImage, styles.photoSigImageOverlay, wScale>1 && {width:S(70), height:S(24)}]} resizeMode="contain" />
                          ) : (
                            <View style={[styles.photoSigImage, styles.placeholder, wScale>1 && {width:S(70), height:S(24)}]}><Text style={[styles.phTiny, wScale>1 && {fontSize:S(6)}]}>SIGN</Text></View>
                          )}
                          <Text style={[styles.photoSigLabel, styles.photoSigLabelUnder, wScale>1 && {fontSize:S(7)}]}>Signature Issue Auth.</Text>
                        </View>
                      ) : null}
                      {showSectionDebug && (
                        <Text style={styles.photoDebug}>{`Photo: ${ (wPx/pxPerIn).toFixed(3) }in × ${ (hPx/pxPerIn).toFixed(3) }in (${ (wPx/pxPerIn*25.4).toFixed(1) }mm × ${ (hPx/pxPerIn*25.4).toFixed(1) }mm)`}</Text>
                      )}
                    </View>
                  );
                })()}
                
                {/* QR is shown under logo in left column; suppress far-right QR */}
              </View>
            ) : (
              <View style={styles.mainRow}>
                {/* Left column: logo + optional QR (shrink width to free detail space) */}
                <View style={[styles.leftCol, { width: showQrBelowLogo ? 72 : 62 }]}>
                  <View style={styles.logoWrap}>
                    {logoUri && (
                      <Image source={{ uri: logoUri }} style={styles.logo} />
                    )}
                    {!logoUri && (
                      <View style={[styles.logo, styles.placeholder, { backgroundColor: 'transparent' }]}>
                        <Text style={styles.phSmall}>LOGO</Text>
                      </View>
                    )}
                  </View>
                  {showQrBelowLogo && qrUri && (
                    <View style={styles.qrBelowLogoWrap}>
                      <Image source={{ uri: qrUri }} style={styles.qrBelowLogo} />
                    </View>
                  )}
                </View>
                {/* Photo column first when photo is on left */}
                {(() => {
                  const proportionFromBody = 0.52;
                  let hPxBase: number | undefined;
                  let wPxBase: number | undefined;
                  if (landscapePhotoHeightInches != null) {
                    hPxBase = Math.round(pxPerIn * landscapePhotoHeightInches);
                  } else if (landscapePhotoHeightPx != null) {
                    hPxBase = Math.round(landscapePhotoHeightPx);
                  } else if (landscapePhotoWidthInches != null) {
                    wPxBase = Math.round(pxPerIn * landscapePhotoWidthInches);
                  } else if (landscapePhotoWidthPx != null) {
                    wPxBase = Math.round(landscapePhotoWidthPx);
                  } else if (bodyPxExplicit != null) {
                    hPxBase = Math.round(bodyPxExplicit * proportionFromBody);
                  }
                  const aspect = Math.max(landscapePhotoAspect || (35/45), 0.05); // passport default
                  let hPx0 = Math.max(28, Math.round(hPxBase != null ? hPxBase : (wPxBase != null ? Math.round(wPxBase / aspect) : 86)));
                  let wPx0 = Math.max(20, Math.round(wPxBase != null ? wPxBase : Math.round(hPx0 * aspect)));
                  const wPx = Math.max(20, Math.round(wPx0 * landscapePhotoScale));
                  const hPx = Math.max(28, Math.round(hPx0 * landscapePhotoScale));
                  const separateStampScale = landscapeStampPosition === 'above'
                    ? (landscapeStampAboveScale ?? 1.2)
                    : (landscapeStampBelowScale ?? landscapeStampAboveScale ?? 1.2);
                  const stampFactor = (landscapeStampPosition === 'overlap' ? 0.6 : separateStampScale);
                  const colWidth = 110; // keep in sync with styles.photoCol width
                  const maxStampPx = colWidth - 4;
                  const stampPxRaw = Math.round(Math.min(wPx, hPx) * stampFactor * landscapeStampScale);
                  const stampPx = Math.min(stampPxRaw, maxStampPx);
                  return (
                    <View style={[styles.photoCol, { width: Math.max(Math.max(wPx, stampPx), (showSignatureUnderPhoto ? 70 : 0)) + 8 }]}>
                      {/* Relative wrapper so 'above' stamp doesn't push photo down */}
                      <View style={{ width: Math.max(wPx, stampPx), alignItems: 'center', position: 'relative' }}>
                        <View style={[styles.photoWrap, { width: wPx, height: hPx, transform: [{ translateY: landscapePhotoTopOffsetPx }, { translateX: landscapePhotoHorizontalOffsetPx }] }]}>
                          {photoUri ? <Image source={{ uri: photoUri }} style={[styles.photo, { width: wPx, height: hPx }]} /> : <View style={[styles.photo, styles.placeholder, { width: wPx, height: hPx }]}><Text style={styles.phSmall}>PHOTO</Text></View>}
                          {landscapeStampPosition === 'overlap' && (
                            stampUri ? <Image source={{ uri: stampUri }} style={[styles.stamp, { width: stampPx, height: stampPx, borderRadius: stampPx/2 }]} /> : <View style={[styles.stamp, styles.placeholder, { width: stampPx, height: stampPx, borderRadius: stampPx/2 }]}><Text style={styles.phTiny}>STAMP</Text></View>
                          )}
                        </View>
                        {landscapeStampPosition === 'above' && (
                          <View style={{ position: 'absolute', top: -(stampPx + 4), left: 0, right: 0, alignItems: 'center' }}>
                            {stampUri ? (
                              <Image source={{ uri: stampUri }} style={{ width: stampPx, height: stampPx, borderRadius: stampPx/2 }} />
                            ) : (
                              <View style={[styles.placeholder, { width: stampPx, height: stampPx, borderRadius: stampPx/2 }]}><Text style={styles.phTiny}>STAMP</Text></View>
                            )}
                          </View>
                        )}
                        {landscapeStampPosition === 'below' && (
                          <View style={{ width: Math.max(wPx, stampPx), alignItems: 'center', marginTop: 4 }}>
                            {stampUri ? (
                              <Image source={{ uri: stampUri }} style={{ width: stampPx, height: stampPx, borderRadius: stampPx/2 }} />
                            ) : (
                              <View style={[styles.placeholder, { width: stampPx, height: stampPx, borderRadius: stampPx/2 }]}><Text style={styles.phTiny}>STAMP</Text></View>
                            )}
                          </View>
                        )}
                      </View>
                      {showSignatureUnderPhoto ? (
                        <View style={styles.signatureUnderPhoto}>
                          {authorSignUri ? (
                            <Image source={{ uri: authorSignUri }} style={[styles.photoSigImage, styles.photoSigImageOverlay]} resizeMode="contain" />
                          ) : (
                            <View style={[styles.photoSigImage, styles.placeholder]}><Text style={styles.phTiny}>SIGN</Text></View>
                          )}
                          <Text style={[styles.photoSigLabel, styles.photoSigLabelUnder]}>Signature Issue Auth.</Text>
                        </View>
                      ) : null}
                      {showSectionDebug && (
                        <Text style={styles.photoDebug}>{`Photo: ${ (wPx/pxPerIn).toFixed(3) }in × ${ (hPx/pxPerIn).toFixed(3) }in (${ (wPx/pxPerIn*25.4).toFixed(1) }mm × ${ (hPx/pxPerIn*25.4).toFixed(1) }mm)`}</Text>
                      )}
                    </View>
                  );
                })()}
                {/* Center details (when photo left, details in middle) */}
                <View style={[styles.centerColCentered, styles.centerNudgeRight]}>
                  {/* Exact order: Name → Designation → Cell → Work Place → ID → Mob → Valid */}
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>Name</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]} numberOfLines={1}>{memberName}</Text>
                  </View>
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>Designation</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]} numberOfLines={1}>{designation}</Text>
                  </View>
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>Cell</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]} numberOfLines={1}>{cellName}</Text>
                  </View>
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>Work Place</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]} numberOfLines={1}>{workPlace || ''}</Text>
                  </View>
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>ID</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]} numberOfLines={1}>{idNumber}</Text>
                  </View>
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>Mob</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]} numberOfLines={1}>{contactNumber}</Text>
                  </View>
                  <View style={styles.alignedDetailRow}>
                    <Text style={[styles.alignedDetailLabel, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>Valid</Text>
                    <Text style={[styles.alignedDetailColon, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]}>:</Text>
                    <Text style={[styles.alignedDetailValue, wScale>1 && {fontSize:S(9.2), lineHeight:S(10)}]} numberOfLines={1}>{validUpto}</Text>
                  </View>
                </View>
                {/* Removed right placeholder column to free space for details */}
              </View>
            )}
          </View>
        );
      })()}
      {/* Footer signature removed per correction (keep original in-column placement only) */}
      <View style={[styles.bottomRed, (bottomBandPxExplicit != null) ? { height: bottomBandPxExplicit, justifyContent: 'center', paddingVertical: 0 } : null]}>
        <Text style={[styles.bottomText]} numberOfLines={1}>24x7 SUPPORT WITH GOVT AGENCIES AGAINST CRIME & CORRUPTION</Text>
      </View>
      {showSectionDebug && (
        <View style={styles.debugOverlay} pointerEvents="none">
          <Text style={styles.debugText}>
            Top: {( (topBandPx ?? fallbackBandPx) / pxPerIn ).toFixed(4)} in\n
            Blue: {( (blueBandPx ?? fallbackBandPx) / pxPerIn ).toFixed(4)} in\n
            Body: {( (bodyPxExplicit ?? 0) / pxPerIn ).toFixed(4)} in\n
            Bottom: {( (bottomBandPxExplicit ?? 0) / pxPerIn ).toFixed(4)} in\n
            Total: {physHIn.toFixed(4)} in
          </Text>
        </View>
      )}
    </View>
  );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#F3F4F6', overflow: 'hidden' },
  topRed: { backgroundColor: RED, paddingHorizontal: 0, height: 44, justifyContent: 'center' },
  topTitle: { color: '#fff', fontSize: 14, fontWeight: '900', textAlign: 'center', letterSpacing: 0, fontFamily: Platform.select({ ios: 'Verdana', android: 'verdana', default: 'Verdana' }) },
  blueBand: { backgroundColor: BLUE, paddingHorizontal: 8, height: 44, justifyContent: 'center' },
  blueBandText: { color: '#fff', fontSize: 7.5, fontWeight: '700', textAlign: 'center', lineHeight: 10 },
  bodyWrap: { },
  // New header row directly under blue band: holds logo/QR (left) and jurisdiction/NITI lines (right)
  headerRow: { flexDirection: 'row', paddingHorizontal: 6, paddingTop: 2, alignItems: 'flex-start', marginBottom: 2 },
  headerRight: { flex: 1, paddingLeft: 8, alignItems: 'flex-end', justifyContent: 'flex-start' },
  jurisdictionWrap: { alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 6, marginBottom: 4 },
  mainRow: { flex: 1, flexDirection: 'row', paddingHorizontal: 0, paddingTop: 2 },
  // Left column: align items to start so logo/QR sit closer to the card's left edge
  leftCol: { width: 86, alignItems: 'flex-start', paddingLeft: 4, paddingRight: 0, paddingTop: 0 },
  // Reset extra left margin so logo sits a bit further left
  logoWrap: { marginBottom: 8, marginTop: -60, marginLeft: 0 },
  logo: { width: 56, height: 56, borderRadius: 4 },
  photoWrap: { marginTop: 16, width: 64, height: 48 },
  photo: { width: 64, height: 48, borderRadius: 6 },
  // Overlap stamp now positioned bottom-left (was bottom-right); slight negative offset keeps circular stamp visually anchored
  stamp: { position: 'absolute', width: 48, height: 48, borderRadius: 24, bottom: -4, left: -4 },
  stampBelow: { marginTop: 6, alignSelf: 'center' },
  rightCol: { flex: 1, paddingLeft: 6 },
  cell: { color: BLUE, fontSize: 9, fontWeight: '800', marginBottom: 1 },
  name: { fontSize: 11, fontWeight: '800', color: '#111827' },
  designation: { fontSize: 8.5, fontWeight: '700', color: RED, marginVertical: 1 },
  // Compact detail rows (portrait) – reduced vertical spacing & tighter line height
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  detailLabel: { width: 32, fontSize: 8, lineHeight: 10, fontWeight: '700', color: '#111827' },
  detailValue: { flex: 1, fontSize: 8, lineHeight: 10, fontWeight: '600', color: '#111827' },
  signatureBox: { marginTop: 4, alignItems: 'center', height: 28, justifyContent: 'flex-end' },
  signature: { width: 74, height: 26 },
  authLabel: { fontSize: 8, fontWeight: '700', color: BLUE, marginTop: 3, textAlign: 'center' },
  photoSigWrap: { width: '100%', alignItems: 'center', marginTop: 4 },
  photoSigImage: { width: 70, height: 24 },
  photoSigLabel: { fontSize: 7, fontWeight: '700', color: BLUE, marginTop: 2, textAlign: 'center' },
  // When we want the sign image to overlap the label below (right-side variant)
  // Normalize signature overlay: remove extreme negative margins so text isn't hidden behind PNG
  // Raise signature PNG slightly (2px higher) per request
  photoSigImageOverlay: { marginTop: -45, marginBottom: -8, position: 'relative', zIndex: 2 },
  photoSigLabelUnder: { position: 'relative', zIndex: 1, marginTop: -8 },
  signatureUnderPhoto: { alignItems: 'center', justifyContent: 'flex-start', marginTop: 0, marginBottom: 0 },
  photoDebug: { fontSize: 6, color: '#374151', marginTop: 2, textAlign: 'center' },
  bottomRed: { backgroundColor: RED, paddingHorizontal: 6, paddingVertical: 3 },
  bottomText: { color: '#fff', fontSize: 6.5, fontWeight: '900', textAlign: 'center' },
  // Portrait additions
  pTopRed: { backgroundColor: RED, paddingHorizontal: 0, height: 48, justifyContent: 'center' },
  pTopTitle: { color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center', lineHeight: 18, letterSpacing: 0, fontFamily: Platform.select({ ios: 'Verdana', android: 'verdana', default: 'Verdana' }) },
  pBlueBand: { backgroundColor: BLUE, paddingHorizontal: 10, height: 48, justifyContent: 'center' },
  pBlueBandText: { color: '#fff', fontSize: 8, fontWeight: '700', textAlign: 'center', lineHeight: 10 },
  pLogoWrap: { alignItems: 'center', marginTop: 6 },
  pLogo: { width: 70, height: 70, borderRadius: 0 },
  pJurisdiction: { fontSize: 11, fontWeight: '900', color: BLUE, marginTop: 6, textAlign: 'center' },
  // Apply Verdana fallback chain for jurisdiction text
  pJurisdictionVerdana: { fontSize: 11, fontWeight: '900', color: '#000', marginTop: 6, textAlign: 'center', fontFamily: Platform.select({ ios: 'Verdana', android: 'verdana', default: 'Verdana' }) },
  pNiti: { color: RED, fontSize: 8, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  // Tight two-line NITI text style (used under jurisdiction, minimal line gap)
  nitiTight: { color: '#000', fontSize: 8, fontWeight: '800', textAlign: 'center', lineHeight: 10 },
  // Slightly smaller variant for UNIQUE ID line to reduce layout impact
  nitiTightSmall: { color: '#000', fontSize: 7, fontWeight: '700', textAlign: 'center', lineHeight: 9 },
  // Red emphasis line matching top band color (slightly smaller)
  worksAgainstLine: { color: RED, fontSize: 6.5, fontWeight: '800', textAlign: 'center', lineHeight: 9 },
  // Inline Identity Card line (red, bold) to appear directly after worksAgainstLine
  identityCardInline: { color: RED, fontSize: 8.5, fontWeight: '900', textAlign: 'center', lineHeight: 11 },
  pIdentity: { color: RED, fontSize: 11, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  pMain: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 12, marginTop: 10 },
  pQrWrap: { width: 68, marginRight: 8, alignItems: 'center' },
  pQr: { width: 68, height: 68 },
  pPhotoWrap: { width: 124, height: 94, marginTop: 6 },
  pPhoto: { width: 124, height: 94, borderRadius: 8 },
  pStamp: { position: 'absolute', width: 58, height: 58, borderRadius: 29, bottom: -6, left: -6 },
  pCenterBlock: { paddingHorizontal: 10 },
  pCell: { color: BLUE, fontSize: 12, fontWeight: '800', marginTop: 8, textAlign: 'left', paddingHorizontal: 10 },
  pName: { fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 6, textAlign: 'left', paddingHorizontal: 10 },
  pDesignation: { fontSize: 10, fontWeight: '700', color: RED, marginTop: 6, textAlign: 'left', paddingHorizontal: 10 },
  pDetailsContainer: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10 },
  pDetails: { },
  pSignatureBox: { marginTop: 8, alignItems: 'center', height: 40, justifyContent: 'flex-end' },
  pSignature: { width: 110, height: 32 },
  pAuthLabel: { fontSize: 8, fontWeight: '700', color: BLUE, marginTop: 4, textAlign: 'center' },
  pBottomRed: { backgroundColor: RED, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
  pBottomText: { color: '#fff', fontSize: 8, fontWeight: '900', textAlign: 'center', lineHeight: 12 },
  placeholder: { backgroundColor: '#d4d4d8', alignItems: 'center', justifyContent: 'center' },
  phSmall: { fontSize: 8, fontWeight: '700', color: '#111827' },
  phTiny: { fontSize: 6, fontWeight: '700', textAlign: 'center', color: '#111827' },
  debugOverlay: { position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 },
  debugText: { color: '#fff', fontSize: 7, fontFamily: Platform.select({ ios: 'Verdana', android: 'verdana', default: 'Verdana' }) },
  // New layout columns for landscape when photo moved to right
  centerCol: { flex: 1, paddingLeft: 6, paddingRight: 6 },
  photoCol: { width: 110, alignItems: 'center', justifyContent: 'flex-start' },
  photoColRight: { width: 110, alignItems: 'flex-end', justifyContent: 'flex-start', paddingRight: 2 },
  qrCol: { width: 72, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  qr: { resizeMode: 'contain' },
  qrBelowLogoWrap: { marginTop: 0 },
  qrBelowLogo: { width: 54, height: 54, resizeMode: 'contain' },
  // Centered column styles for new 3-column layout
  // Pull detail rows a bit more left (increase negative margin) to sit closer to logo/QR.
  centerColCentered: { flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start', paddingHorizontal: 0, marginLeft: -4 },
  centerNudgeRight: { marginLeft: 2 },
  cellCenter: { color: BLUE, fontSize: 9, fontWeight: '800', marginBottom: 2, textAlign: 'center' },
  nameCenter: { fontSize: 11, fontWeight: '800', color: '#111827', textAlign: 'center' },
  designationCenter: { fontSize: 8.5, fontWeight: '700', color: RED, marginVertical: 2, textAlign: 'center' },
  detailCenter: { fontSize: 7.5, fontWeight: '600', color: '#111827', textAlign: 'center', marginTop: 2 },
  rightColCentered: { width: 110, alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 6 },
  // New left-aligned detail rows with fixed colon alignment
  // Compact aligned detail rows (landscape)
  alignedDetailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 },
  alignedDetailLabel: { width: 56, fontSize: 8, lineHeight: 10, fontWeight: '700', color: '#111827', textAlign: 'left' },
  alignedDetailColon: { width: 6, fontSize: 8, lineHeight: 10, fontWeight: '700', color: '#111827', textAlign: 'center' },
  alignedDetailValue: { flex: 1, fontSize: 8, lineHeight: 10, fontWeight: '600', color: '#111827', textAlign: 'left' },
});

export default HrciIdCardFrontStandard;
