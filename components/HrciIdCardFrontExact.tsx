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
  issueDate,
  zone,
  logoUri,
  photoUri,
  stampUri,
  authorSignUri,
  style,
  width = 720,
}) => {
  // Use a fixed design coordinate space then scale for width to avoid font/layout drift
  const baseWidth = 720;
  const baseHeight = baseWidth * 1.55;
  const scale = width / baseWidth;
  const height = baseHeight * scale;
  return (
    <View style={[{ width, height, overflow: 'hidden' }, style]}>
      <View style={{ width: baseWidth, height: baseHeight, transform: [{ scale }], transformOrigin: 'top left' as any }}>
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
  <Text style={styles.nitiLine}>REGD BY GOVT OF &quot;NITI AAYOG&quot; - UNIQUE ID: AP/2022/0324217 / AP/2022/0326782</Text>
  <Text style={styles.identityHeading} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} allowFontScaling={false}>IDENTITY CARD</Text>
        {/* Photo & Stamp */}
        <View style={styles.photoStampRow}>
          <View style={styles.photoShell}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}><Text style={styles.placeholderText}>Member{`\n`}Photo</Text></View>
            )}
            {stampUri ? (
              <Image source={{ uri: stampUri }} style={styles.stamp} />
            ) : (
              <View style={[styles.stamp, styles.stampPlaceholder]}><Text style={styles.placeholderTextSmall}>STAMP{`\n`}PNG</Text></View>
            )}
          </View>
        </View>
        <Text style={styles.cellName} numberOfLines={2}>{cellName}</Text>
        {/* Details table (dynamic rows) */}
        <View style={styles.detailsTable}>
          {[
            { label: 'Name', value: memberName },
            { label: 'Designation', value: designation },
            zone ? { label: 'Zone', value: zone } : null,
            { label: 'ID No', value: idNumber },
            issueDate ? { label: 'Issue Date', value: issueDate } : null,
            { label: 'Valid Upto', value: validUpto },
            { label: 'Contact No', value: contactNumber },
          ].filter(Boolean).map((row: any) => (
            <DetailRow key={row.label} label={row.label} value={row.value} />
          ))}
        </View>
        {/* Signature Row */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            {authorSignUri ? (
              <Image source={{ uri: authorSignUri }} style={styles.authorSign} resizeMode="contain" />
            ) : (
              <View style={[styles.authorSign, styles.authorSignPlaceholder]}><Text style={styles.placeholderTextSmall}>Author Sign{`\n`}PNG</Text></View>
            )}
          </View>
          <Text style={styles.signatureLabel}>SIGNATURE ISSUE AUTH.</Text>
        </View>
      </View>
      {/* Bottom Red Strip */}
      <View style={styles.bottomRed}>
        <Text style={styles.bottomText}>WE TAKE HELP 24×7 FROM (POLICE, CBI, VIGILANCE, NIA) & OTHER GOVT. DEPT. AGAINST CRIME & CORRUPTION.</Text>
      </View>
        </View>
      </View>
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel} numberOfLines={1}>{label}</Text>
    <Text style={styles.colon}>:</Text>
    <Text style={styles.detailValue} numberOfLines={2} ellipsizeMode="tail">{value}</Text>
  </View>
);

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
  bodySection: { flex: 1, alignItems: 'center', paddingTop: 28, paddingHorizontal: 40 },
  logoWrapper: { marginBottom: 32 },
  logo: { width: 170, height: 170, borderRadius: 85, resizeMode: 'cover', borderWidth: 4, borderColor: '#ffffff' },
  logoPlaceholder: { width: 180, height: 180, borderRadius: 90, backgroundColor: '#d4d4d8', alignItems: 'center', justifyContent: 'center' },
  placeholderText: { textAlign: 'center', color: '#111827', fontWeight: '700' },
  placeholderTextSmall: { textAlign: 'center', color: '#111827', fontSize: 12, fontWeight: '600' },
  jurisdiction: { fontSize: 32, fontWeight: '900', color: BLUE_TEXT, marginTop: 2, textAlign: 'center', letterSpacing: 0.5 },
  nitiLine: { color: RED, fontWeight: '700', fontSize: 16, textAlign: 'center', marginTop: 14, letterSpacing: 0.25 },
  identityHeading: { color: RED, fontWeight: '900', fontSize: 30, marginTop: 20, letterSpacing: 1 },
  photoStampRow: { marginTop: 12, marginBottom: 16 },
  photoShell: { width: 320, height: 320, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#e5e7eb' },
  photo: { width: 312, height: 312, resizeMode: 'cover' },
  photoPlaceholder: { width: 312, height: 312, alignItems: 'center', justifyContent: 'center' },
  stamp: { position: 'absolute', width: 190, height: 190, borderRadius: 95, bottom: -28, right: -28, backgroundColor: '#d4d4d8', borderWidth: 4, borderColor: '#ffffff' },
  stampPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cellName: { color: BLUE_TEXT, fontSize: 40, fontWeight: '900', marginTop: 68, textAlign: 'center', letterSpacing: 0.5 },
  detailsTable: { width: '100%', marginTop: 32 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  detailLabel: { width: 170, fontSize: 22, fontWeight: '700', color: '#111827', letterSpacing: 0.25 },
  colon: { width: 14, fontSize: 22, fontWeight: '700', color: '#111827' },
  detailValue: { flex: 1, fontSize: 22, fontWeight: '700', color: '#111827' },
  signatureRow: { flexDirection: 'row', alignItems: 'flex-end', width: '100%', marginTop: 36 },
  signatureBox: { flex: 1, alignItems: 'flex-end' },
  authorSign: { width: 260, height: 140 },
  authorSignPlaceholder: { backgroundColor: '#d4d4d8', alignItems: 'center', justifyContent: 'center' },
  signatureLabel: { fontSize: 30, fontWeight: '900', color: BLUE_TEXT, marginLeft: 16, letterSpacing: 0.5 },
  bottomRed: { backgroundColor: RED, paddingVertical: 18, paddingHorizontal: 20, marginTop: 42 },
  bottomText: { color: '#ffffff', textAlign: 'center', fontSize: 18, fontWeight: '800', letterSpacing: 0.5, lineHeight: 24 },
});

export default HrciIdCardFrontExact;
