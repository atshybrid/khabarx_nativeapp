import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

/**
 * Standard ID-1 size (credit card) aspect ratio front design.
 * ISO/IEC 7810 ID-1 dimensions: 85.6mm × 54mm (ratio ~0.631). We treat width as 85.6 units.
 */
export interface HrciIdCardFrontStandardProps {
  memberName: string;
  designation: string;
  cellName: string;
  idNumber: string;
  contactNumber: string;
  validUpto: string;
  logoUri?: string;
  photoUri?: string;
  stampUri?: string;
  authorSignUri?: string;
  width?: number; // target render width in px (height derived)
  orientation?: 'landscape' | 'portrait'; // portrait => 3.375in x 2.125in
  style?: any;
}

const RED = '#FE0002';
const BLUE = '#17007A';

export const HrciIdCardFrontStandard: React.FC<HrciIdCardFrontStandardProps> = ({
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
  width = 340,
  orientation = 'landscape',
  style,
}) => {
  const landscapeAspect = 54 / 85.6; // ~0.631
  const portraitAspect = 3.375 / 2.125; // ~1.588 (H/W)
  const aspect = orientation === 'portrait' ? portraitAspect : landscapeAspect;
  const height = width * aspect;

  if (orientation === 'portrait') {
    return (
      <View style={[styles.card, { width, height }, style]}>
        <View style={styles.pTopRed}><Text style={styles.pTopTitle} numberOfLines={2}>HUMAN RIGHTS{"\n"}COUNCIL FOR INDIA</Text></View>
        <View style={styles.pBlueBand}>
          <Text style={styles.pBlueBandText} numberOfLines={3}>REGD NO: 4396/2022 • TRUST ACT 1882{"\n"}NITI AAYOG UID:{"\n"}AP/2022/0324217 / 0326782</Text>
        </View>
  <View style={styles.pLogoWrap}>{logoUri ? <Image source={{ uri: logoUri }} style={styles.pLogo} /> : <View style={[styles.pLogo, styles.placeholder, { backgroundColor: 'transparent' }]}><Text style={styles.phSmall}>LOGO</Text></View>}</View>
        <View style={styles.pPhotoWrap}>
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.pPhoto} /> : <View style={[styles.pPhoto, styles.placeholder]}><Text style={styles.phSmall}>PHOTO</Text></View>}
          {stampUri ? <Image source={{ uri: stampUri }} style={styles.pStamp} /> : <View style={[styles.pStamp, styles.placeholder]}><Text style={styles.phTiny}>STAMP</Text></View>}
        </View>
        <Text style={styles.pCell} numberOfLines={2}>{cellName}</Text>
        <Text style={styles.pName} numberOfLines={2}>{memberName}</Text>
        <Text style={styles.pDesignation} numberOfLines={3}>{designation}</Text>
        <View style={styles.pDetails}>
          <Detail label="ID" value={idNumber} />
          <Detail label="Mob" value={contactNumber} />
          <Detail label="Valid" value={validUpto} />
        </View>
        <View style={styles.pSignatureBox}>{authorSignUri ? <Image source={{ uri: authorSignUri }} style={styles.pSignature} resizeMode="contain" /> : <View style={[styles.pSignature, styles.placeholder]}><Text style={styles.phTiny}>SIGN</Text></View>}</View>
        <Text style={styles.pAuthLabel}>Signature Auth.</Text>
        <View style={styles.pBottomRed}><Text style={styles.pBottomText} numberOfLines={3}>24x7 SUPPORT WITH GOVT AGENCIES{"\n"}AGAINST CRIME &{"\n"}CORRUPTION</Text></View>
      </View>
    );
  }

  // Landscape (default)
  return (
    <View style={[styles.card, { width, height }, style]}>
      <View style={styles.topRed}><Text style={styles.topTitle} numberOfLines={1}>HUMAN RIGHTS COUNCIL FOR INDIA</Text></View>
      <View style={styles.blueBand}>
        <Text style={styles.blueBandText} numberOfLines={2}>REGD NO: 4396/2022 • TRUST ACT 1882{"\n"}NITI AAYOG UID: AP/2022/0324217 / 0326782</Text>
      </View>
      <View style={styles.mainRow}>
        <View style={styles.leftCol}>
          <View style={styles.logoWrap}>{logoUri ? <Image source={{ uri: logoUri }} style={styles.logo} /> : <View style={[styles.logo, styles.placeholder, { backgroundColor: 'transparent' }]}><Text style={styles.phSmall}>LOGO</Text></View>}</View>
          <View style={styles.photoWrap}>
            {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : <View style={[styles.photo, styles.placeholder]}><Text style={styles.phSmall}>PHOTO</Text></View>}
            {stampUri ? <Image source={{ uri: stampUri }} style={styles.stamp} /> : <View style={[styles.stamp, styles.placeholder]}><Text style={styles.phTiny}>STAMP</Text></View>}
          </View>
        </View>
        <View style={styles.rightCol}>
          <Text style={styles.cell}>{cellName}</Text>
          <Text style={styles.name} numberOfLines={1}>{memberName}</Text>
          <Text style={styles.designation} numberOfLines={2}>{designation}</Text>
          <Detail label="ID" value={idNumber} />
          <Detail label="Mob" value={contactNumber} />
          <Detail label="Valid" value={validUpto} />
          <View style={styles.signatureBox}>{authorSignUri ? <Image source={{ uri: authorSignUri }} style={styles.signature} resizeMode="contain" /> : <View style={[styles.signature, styles.placeholder]}><Text style={styles.phTiny}>SIGN</Text></View>}</View>
          <Text style={styles.authLabel}>Signature Auth.</Text>
        </View>
      </View>
      <View style={styles.bottomRed}><Text style={styles.bottomText} numberOfLines={1}>24x7 SUPPORT WITH GOVT AGENCIES AGAINST CRIME & CORRUPTION</Text></View>
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
  topRed: { backgroundColor: RED, paddingHorizontal: 6, paddingVertical: 4 },
  topTitle: { color: '#fff', fontSize: 10, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 },
  blueBand: { backgroundColor: BLUE, paddingHorizontal: 6, paddingVertical: 4 },
  blueBandText: { color: '#fff', fontSize: 7.5, fontWeight: '600', textAlign: 'center', lineHeight: 10 },
  mainRow: { flex: 1, flexDirection: 'row', paddingHorizontal: 6, paddingTop: 4 },
  leftCol: { width: 110, alignItems: 'center' },
  logoWrap: { marginBottom: 4 },
  logo: { width: 54, height: 54, borderRadius: 27 },
  photoWrap: { marginTop: 4, width: 90, height: 70 },
  photo: { width: 90, height: 70, borderRadius: 4 },
  stamp: { position: 'absolute', width: 50, height: 50, borderRadius: 25, bottom: -6, right: -6 },
  rightCol: { flex: 1, paddingLeft: 6 },
  cell: { color: BLUE, fontSize: 9, fontWeight: '800', marginBottom: 2 },
  name: { fontSize: 11, fontWeight: '800', color: '#111827' },
  designation: { fontSize: 8.5, fontWeight: '700', color: RED, marginVertical: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  detailLabel: { width: 28, fontSize: 7.5, fontWeight: '700', color: '#111827' },
  detailValue: { flex: 1, fontSize: 7.5, fontWeight: '600', color: '#111827' },
  signatureBox: { marginTop: 2, alignItems: 'flex-start', height: 26, justifyContent: 'flex-end' },
  signature: { width: 70, height: 24 },
  authLabel: { fontSize: 7, fontWeight: '700', color: BLUE, marginTop: 2 },
  bottomRed: { backgroundColor: RED, paddingHorizontal: 6, paddingVertical: 3 },
  bottomText: { color: '#fff', fontSize: 6.5, fontWeight: '700', textAlign: 'center' },
  // Portrait additions
  pTopRed: { backgroundColor: RED, paddingHorizontal: 10, paddingVertical: 6 },
  pTopTitle: { color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 16 },
  pBlueBand: { backgroundColor: BLUE, paddingHorizontal: 10, paddingVertical: 6 },
  pBlueBandText: { color: '#fff', fontSize: 9, fontWeight: '600', textAlign: 'center', lineHeight: 12 },
  pLogoWrap: { alignItems: 'center', marginTop: 6 },
  pLogo: { width: 70, height: 70, borderRadius: 35 },
  pPhotoWrap: { width: 120, height: 90, alignSelf: 'center', marginTop: 8 },
  pPhoto: { width: 120, height: 90, borderRadius: 6 },
  pStamp: { position: 'absolute', width: 60, height: 60, borderRadius: 30, bottom: -8, right: -8 },
  pCell: { color: BLUE, fontSize: 11, fontWeight: '800', marginTop: 18, textAlign: 'center', paddingHorizontal: 8 },
  pName: { fontSize: 12, fontWeight: '800', color: '#111827', marginTop: 4, textAlign: 'center', paddingHorizontal: 8 },
  pDesignation: { fontSize: 9, fontWeight: '700', color: RED, marginTop: 4, textAlign: 'center', paddingHorizontal: 8 },
  pDetails: { marginTop: 8, paddingHorizontal: 12 },
  pSignatureBox: { marginTop: 8, alignItems: 'center', height: 40, justifyContent: 'flex-end' },
  pSignature: { width: 110, height: 32 },
  pAuthLabel: { fontSize: 8, fontWeight: '700', color: BLUE, marginTop: 4, textAlign: 'center' },
  pBottomRed: { backgroundColor: RED, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
  pBottomText: { color: '#fff', fontSize: 8, fontWeight: '700', textAlign: 'center', lineHeight: 12 },
  placeholder: { backgroundColor: '#d4d4d8', alignItems: 'center', justifyContent: 'center' },
  phSmall: { fontSize: 8, fontWeight: '700', color: '#111827' },
  phTiny: { fontSize: 6, fontWeight: '700', textAlign: 'center', color: '#111827' },
});

export default HrciIdCardFrontStandard;
