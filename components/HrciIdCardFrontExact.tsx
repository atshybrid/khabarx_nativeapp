import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

/**
 * Exact visual implementation of provided HRCI ID Card Front sample.
 * Focuses purely on layout fidelity; API/data integration happens externally.
 */
export interface HrciIdCardFrontProps {
  memberName: string;
  designation: string;
  cellName: string;
  idNumber: string;
  contactNumber: string;
  validUpto: string; // e.g., 'MARCH 2027'
  issueDate?: string; // Optional issue date text
  zone?: string; // Optional zone text
  logoUri?: string; // Circular logo PNG
  photoUri?: string; // Member photo square
  stampUri?: string; // Round stamp PNG (overlaps bottom-right of photo)
  authorSignUri?: string; // Authorizing signature PNG
  style?: any;
  width?: number; // Outer width; height derives from fixed aspect ratio  (approx 1.414 like A series) but sample is more tall; we'll tune
  /** Optional override for photo width (design coordinate space pixels). Default chosen for balance */
  photoWidth?: number;
  /** Optional override for photo height (design coordinate space pixels). Maintains portrait ratio */
  photoHeight?: number;
  /** Minimum gap (design px) between signature block bottom and red strip */
  signatureToStripGap?: number;
  /** Optional background color behind signature image (defaults transparent) */
  signatureBgColor?: string;
  /** Optional bottom offset (design px) to lift signature overlay above details/footer */
  signatureBottomOffset?: number;
}

const RED = '#FE0002';
const BLUE = '#17007A'; // Deep blue band
const BLUE_TEXT = '#17007A';

export const HrciIdCardFrontExact: React.FC<HrciIdCardFrontProps> = ({
  memberName,
  designation,
  cellName,
  idNumber,
  contactNumber,
  validUpto,
  logoUri,
  photoUri,
  stampUri,
  authorSignUri,
  style,
  width = 720,
  photoWidth,
  photoHeight,
  signatureToStripGap,
  signatureBgColor,
  signatureBottomOffset,
}) => {
  const [footerHeight, setFooterHeight] = React.useState(0);
  // Use a fixed design coordinate space then scale for width to avoid font/layout drift
  const baseWidth = 720;
  const baseHeight = baseWidth * 1.42; // slightly tighter
  const scale = width / baseWidth;
  const height = baseHeight * scale;

  if (width <= 0) {
    return <View style={[{ padding: 16, backgroundColor: '#fee2e2' }, style]}><Text style={{ color: '#b91c1c', fontWeight: '700' }}>Invalid width for ID Card</Text></View>;
  }

  if (scale < 0.4) {
    return (
      <View style={[{ width, padding: 16, backgroundColor: '#fff5f5', borderWidth: 1, borderColor: '#fecaca' }, style]}>
        <Text style={{ color: '#b91c1c', fontWeight: '800', textAlign: 'center' }}>Screen too small to display ID card. Rotate device or zoom.</Text>
      </View>
    );
  }

  // Dynamic sizing (design coordinate values before scale)
  const dPhotoWidth = photoWidth ?? 190; // further enlarged default for stronger presence
  const dPhotoHeight = photoHeight ?? 215; // maintain portrait ratio
  const stampSize = Math.round(dPhotoWidth * 0.62); // proportional to photo
  const stampOffset = Math.min(18, Math.round(stampSize * 0.18)); // keep inside bounds

  const gap = signatureToStripGap ?? 1; // minimal default gap so footer stays tight
  const signBg = signatureBgColor ?? 'transparent';
  const signBottom = signatureBottomOffset ?? 44; // lift signature overlay higher by default
  // Use measured footer height when available; fallback to 54 (14+25+14)
  const measuredFooter = footerHeight > 0 ? footerHeight : 54;
  const footerSafeBottom = Math.max(gap, 1) + measuredFooter;
  const cardSignBottom = Math.max(signBottom, footerSafeBottom);

  return (
    <View style={[{ width, height }, style]}>
      <View style={{ width: baseWidth, height: baseHeight, overflow: 'visible', transform: [{ translateX: -(baseWidth * (1 - scale) / 2) }, { translateY: -(baseHeight * (1 - scale) / 2) }, { scale } ] }}>
  <View style={[styles.card, { width: baseWidth, height: baseHeight }]}> 
      {/* Top Red Title */}
      <View style={styles.topRed}>
        <Text
          style={styles.topRedTitle}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          allowFontScaling={false}
        >
          HUMAN RIGHTS COUNCIL FOR INDIA (HRCI)
        </Text>
      </View>
      {/* Registration Blue Band */}
      <View style={styles.blueBand}>
        <Text style={styles.regLine} numberOfLines={3}>
          REGISTERED BY NCT, NEW DELHI, GOVT OF INDIA{`\n`}REGISTERED NO: 4396/2022 (UNDER TRUST ACT 1882){`\n`}TO PROTECT & PROMOTE HUMAN RIGHTS
        </Text>
      </View>
      {/* Logo + Jurisdiction section */}
      <View style={styles.bodySection}>
  <View style={styles.logoWrapper}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}><Text style={styles.placeholderText}>HRCI Logo{`\n`}PNG</Text></View>
          )}
        </View>
  <Text style={styles.jurisdiction} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} allowFontScaling={false}>ALL INDIA JURISDICTION</Text>
  <Text
    style={styles.nitiLine}
    numberOfLines={1}
    adjustsFontSizeToFit
    minimumFontScale={0.5}
    allowFontScaling={false}
  >{"REGD BY GOVT OF \"NITI AAYOG\" -UNIQUE ID: AP/2022/0324217,AP/2022/0326782"}</Text>
  <Text style={styles.identityHeading} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} allowFontScaling={false}>IDENTITY CARD</Text>
        {/* Photo & Stamp */}
        <View style={styles.photoStampRow}>
          <View style={[styles.photoShell, { width: dPhotoWidth, height: dPhotoHeight }]}> 
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={{ width: dPhotoWidth - 4, height: dPhotoHeight - 4, resizeMode: 'cover' }} />
            ) : (
              <View style={{ width: dPhotoWidth - 4, height: dPhotoHeight - 4, alignItems: 'center', justifyContent: 'center' }}><Text style={styles.placeholderText}>Member{`\n`}Photo</Text></View>
            )}
            {stampUri ? (
              <Image source={{ uri: stampUri }} style={{ position: 'absolute', width: stampSize, height: stampSize, borderRadius: stampSize / 2, bottom: -stampOffset, right: -stampOffset, backgroundColor: 'transparent' }} />
            ) : (
              <View style={{ position: 'absolute', width: stampSize, height: stampSize, borderRadius: stampSize / 2, bottom: -stampOffset, right: -stampOffset, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}><Text style={styles.placeholderTextSmall}>STAMP{`\n`}PNG</Text></View>
            )}
          </View>
        </View>
  <Text style={styles.cellName} numberOfLines={2}>{cellName}</Text>
        {/* Details Area */}
        <View style={styles.detailsArea}>
          {/* New highlighted container for key identity fields */}
          <View style={styles.detailsContainer}>
            {/* Details table (fixed order) */}
            <View style={styles.detailsTable}>
              <DetailRow label="Name" value={memberName} />
              <DetailRow label="Designation" value={designation} />
              <DetailRow label="ID No" value={idNumber} />
              <DetailRow label="Contact No" value={contactNumber} />
              <DetailRow label="Valid Upto" value={validUpto} />
            </View>
          </View>
        </View>
      </View>
  {/* Bottom Red Strip */}
  <View style={[styles.bottomRed, { marginTop: Math.max(gap, 1) }] } onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
        <Text
          style={styles.bottomText}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          allowFontScaling={false}
          ellipsizeMode="clip"
        >
          {"We take help 24x7 From (Police, CBI, Vigilance, NIA) & other Govt. Dept. against crime & corruption."}
        </Text>
      </View>
      {/* Signature Overlay anchored to card (always above footer) */}
      <View style={[styles.signatureOverlay, { right: 28, bottom: cardSignBottom }]} pointerEvents="box-none">
        <View style={styles.signatureContainer}>
          {authorSignUri ? (
            <Image source={{ uri: authorSignUri }} style={[styles.authorSign, { backgroundColor: signBg }]} resizeMode="contain" />
          ) : (
            <View style={[styles.authorSign, styles.authorSignPlaceholder, { backgroundColor: signBg }]}><Text style={styles.placeholderTextSmall}>Author Sign{`\n`}PNG</Text></View>
          )}
          <Text style={styles.signatureLabel}>Signature Issue Auth.</Text>
        </View>
      </View>
        </View>
      </View>
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => {
  const l = label.trim().toLowerCase();
  const isNameRow = l === 'name';
  const isDesignationRow = l === 'designation';
  const autoFit = isNameRow || isDesignationRow;

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.colon}>:</Text>
      {autoFit ? (
        <Text
          style={styles.detailValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          allowFontScaling={false}
        >
          {value}
        </Text>
      ) : (
        <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="tail">{value}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F3F4F6',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    overflow: 'visible',
  },
  topRed: { backgroundColor: RED, paddingVertical: 12, paddingHorizontal: 16 },
  topRedTitle: { color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  blueBand: { backgroundColor: BLUE, paddingVertical: 14, paddingHorizontal: 20 },
  regLine: { color: '#ffffff', fontSize: 20, fontWeight: '700', textAlign: 'center', lineHeight: 26, letterSpacing: 0.5 },
  bodySection: { flex: 1, alignItems: 'center', paddingTop: 12, paddingHorizontal: 28, position: 'relative', zIndex: 5, elevation: 2, overflow: 'visible' },
  logoWrapper: { marginBottom: 12 },
  logo: { width: 0.22 * 720, height: 0.22 * 720, borderRadius: 0.11 * 720, resizeMode: 'cover', borderWidth: 4, borderColor: '#ffffff' },
  logoPlaceholder: { width: 0.23 * 720, height: 0.23 * 720, borderRadius: 0.115 * 720, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  placeholderText: { textAlign: 'center', color: '#111827', fontWeight: '700' },
  placeholderTextSmall: { textAlign: 'center', color: '#111827', fontSize: 12, fontWeight: '600' },
  jurisdiction: { fontSize: 26, fontWeight: '900', color: BLUE_TEXT, marginTop: 0, textAlign: 'center', letterSpacing: 0.5, lineHeight: 30 },
  nitiLine: { color: RED, fontWeight: '800', fontSize: 16, textAlign: 'center', marginTop: 6, letterSpacing: 0.15, includeFontPadding: false, lineHeight: 20 },
  identityHeading: { color: RED, fontWeight: '900', fontSize: 24, marginTop: 10, letterSpacing: 0.8, lineHeight: 26 },
  photoStampRow: { marginTop: 6, marginBottom: 8 },
  photoShell: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e5e7eb' },
  cellName: { color: BLUE_TEXT, fontSize: 30, fontWeight: '900', marginTop: 18, textAlign: 'center', letterSpacing: 0.5, lineHeight: 32 },
  detailsArea: { position: 'relative', width: '100%', overflow: 'visible' },
  detailsContainer: {
    alignSelf: 'stretch',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  detailsTable: { alignSelf: 'center', position: 'relative', zIndex: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3, flexWrap: 'nowrap' },
  detailLabel: { width: 180, fontSize: 24, fontWeight: '800', color: '#111827', letterSpacing: 0.25, textAlign: 'left', lineHeight: 34 },
  colon: { width: 16, fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center', lineHeight: 34 },
  detailValue: { width: 420, fontSize: 24, fontWeight: '800', color: '#111827', lineHeight: 34, textAlign: 'left' },
  signatureRow: { flexDirection: 'column', alignItems: 'flex-end', width: 'auto', marginTop: 0, position: 'absolute', right: 0, bottom: 12, zIndex: 20, elevation: 8 },
  signatureOverlay: { position: 'absolute', alignItems: 'flex-end', zIndex: 999, elevation: 12 },
  signatureContainer: { flexDirection: 'column', alignItems: 'flex-end' },
  signatureBox: { display: 'none' },
  authorSign: { width: 190, height: 90, position: 'relative', zIndex: 1000, elevation: 12 },
  authorSignPlaceholder: { backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  // signatureLabel overlays on top of the signature image slightly
  signatureLabel: { fontSize: 20, fontWeight: '900', color: BLUE_TEXT, marginTop: -16, letterSpacing: 0.5, alignSelf: 'flex-end', position: 'relative', zIndex: 1002, elevation: 14 },
  bottomRed: { backgroundColor: RED, paddingVertical: 14, paddingHorizontal: 16, marginTop: 0, position: 'relative', zIndex: 1, elevation: 1 },
  bottomText: { color: '#ffffff', textAlign: 'center', fontSize: 14, fontWeight: '800', letterSpacing: 0.2, lineHeight: 22, marginHorizontal: 40 },
});

export default HrciIdCardFrontExact;
