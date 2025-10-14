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
}) => {
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
  const dPhotoWidth = photoWidth ?? 132; // tuned size: large enough for clarity, leaves vertical room
  const dPhotoHeight = photoHeight ?? 150;
  const stampSize = Math.round(dPhotoWidth * 0.62); // proportional to photo
  const stampOffset = Math.min(18, Math.round(stampSize * 0.18)); // keep inside bounds

  const gap = signatureToStripGap ?? 10; // increased default gap to raise label further from red strip
  const signBg = signatureBgColor ?? 'transparent';

  return (
    <View style={[{ width, height }, style]}>
      <View style={{ width: baseWidth, height: baseHeight, transform: [{ translateX: -(baseWidth * (1 - scale) / 2) }, { translateY: -(baseHeight * (1 - scale) / 2) }, { scale } ] }}>
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
        {/* Details table (fixed order) */}
        <View style={styles.detailsTable}>
          <DetailRow label="Name" value={memberName} />
          <DetailRow label="Designation" value={designation} />
          <DetailRow label="ID No" value={idNumber} />
          <DetailRow label="Contact No" value={contactNumber} />
          <DetailRow label="Valid Upto" value={validUpto} />
        </View>
        {/* Signature Row */}
        <View style={styles.signatureRow}>
          {authorSignUri ? (
            <Image source={{ uri: authorSignUri }} style={[styles.authorSign, { backgroundColor: signBg }]} resizeMode="contain" />
          ) : (
            <View style={[styles.authorSign, styles.authorSignPlaceholder, { backgroundColor: signBg }]}><Text style={styles.placeholderTextSmall}>Author Sign{`\n`}PNG</Text></View>
          )}
          <Text style={styles.signatureLabel}>Signature Issue Auth.</Text>
        </View>
      </View>
  {/* Bottom Red Strip */}
  <View style={[styles.bottomRed, { marginTop: Math.max(gap, 1) }] }>
        <Text style={styles.bottomText}>WE TAKE HELP 24×7 FROM (POLICE, CBI, VIGILANCE, NIA) & OTHER GOVT. DEPT. AGAINST CRIME & CORRUPTION.</Text>
      </View>
        </View>
      </View>
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => {
  const isNameRow = label.trim().toLowerCase() === 'name';
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.colon}>:</Text>
      {isNameRow ? (
        <Text style={styles.detailValue}>{value}</Text>
      ) : (
        <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="tail">{value}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
  },
  topRed: { backgroundColor: RED, paddingVertical: 12, paddingHorizontal: 16 },
  topRedTitle: { color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  blueBand: { backgroundColor: BLUE, paddingVertical: 14, paddingHorizontal: 20 },
  regLine: { color: '#ffffff', fontSize: 20, fontWeight: '700', textAlign: 'center', lineHeight: 26, letterSpacing: 0.5 },
  bodySection: { flex: 1, alignItems: 'center', paddingTop: 12, paddingHorizontal: 28 },
  logoWrapper: { marginBottom: 12 },
  logo: { width: 0.19 * 720, height: 0.19 * 720, borderRadius: 0.095 * 720, resizeMode: 'cover', borderWidth: 4, borderColor: '#ffffff' },
  logoPlaceholder: { width: 0.2 * 720, height: 0.2 * 720, borderRadius: 0.1 * 720, backgroundColor: '#d4d4d8', alignItems: 'center', justifyContent: 'center' },
  placeholderText: { textAlign: 'center', color: '#111827', fontWeight: '700' },
  placeholderTextSmall: { textAlign: 'center', color: '#111827', fontSize: 12, fontWeight: '600' },
  jurisdiction: { fontSize: 26, fontWeight: '900', color: BLUE_TEXT, marginTop: 0, textAlign: 'center', letterSpacing: 0.5, lineHeight: 30 },
  nitiLine: { color: RED, fontWeight: '800', fontSize: 16, textAlign: 'center', marginTop: 6, letterSpacing: 0.15, includeFontPadding: false, lineHeight: 20 },
  identityHeading: { color: RED, fontWeight: '900', fontSize: 24, marginTop: 10, letterSpacing: 0.8, lineHeight: 26 },
  photoStampRow: { marginTop: 6, marginBottom: 8 },
  photoShell: { backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e5e7eb' },
  cellName: { color: BLUE_TEXT, fontSize: 30, fontWeight: '900', marginTop: 18, textAlign: 'center', letterSpacing: 0.5, lineHeight: 32 },
  detailsTable: { marginTop: 14, alignSelf: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3, flexWrap: 'nowrap' },
  detailLabel: { width: 160, fontSize: 18, fontWeight: '700', color: '#111827', letterSpacing: 0.25, textAlign: 'left' },
  colon: { width: 14, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  detailValue: { width: 320, fontSize: 18, fontWeight: '700', color: '#111827', lineHeight: 22, textAlign: 'left' },
  signatureRow: { flexDirection: 'column', alignItems: 'flex-end', width: '100%', marginTop: 26 },
  signatureBox: { display: 'none' },
  authorSign: { width: 190, height: 90 },
  authorSignPlaceholder: { backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  // signatureLabel marginTop set negative to allow signature image to visually overlap the label area
  signatureLabel: { fontSize: 20, fontWeight: '900', color: BLUE_TEXT, marginTop: -14, letterSpacing: 0.5, alignSelf: 'flex-end' },
  bottomRed: { backgroundColor: RED, paddingVertical: 14, paddingHorizontal: 16, marginTop: 0 },
  bottomText: { color: '#ffffff', textAlign: 'center', fontSize: 14, fontWeight: '800', letterSpacing: 0.4, lineHeight: 18 },
});

export default HrciIdCardFrontExact;
