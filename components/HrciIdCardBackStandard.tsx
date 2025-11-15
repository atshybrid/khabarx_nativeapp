import React from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';

/** Back side of standard ID-1 (CR80) card. Matches sizing logic of front component. */
export interface HrciIdCardBackStandardProps {
  width?: number; // width in px (same as front, default 340)
  // Physical sizing (optional): ensure printed size parity with front
  widthInInches?: number; // typically 3.375 for landscape
  heightInInches?: number; // typically ~2.125 for landscape
  // Optional band height control (in inches); mirrors front defaults if provided
  bandHeightInches?: number; // default band height; used if specific topBandHeightInches not provided
  topBandHeightInches?: number; // explicit top red band height in inches
  style?: any;
  // Common assets
  bottomBlueBandHeightInches?: number; // explicit bottom blue band height in inches
  logoUri?: string;
  qrUri?: string;
  // Dynamic text blocks
  helpline?: string; // e.g., Helpline: +91 ...
  email?: string;
  website?: string;
  // Optional: explicit helpline numbers to display in bottom blue band (will show up to 2)
  helplineNumbers?: string[];
  // Optional: replace center content with a registration block (center aligned)
  registrationLines?: string[];
  alignRegistrationCenter?: boolean;
  showLegacyInfo?: boolean; // if false and registrationLines provided, hide helpline/email/address/disclaimers
  addressLines?: string[]; // multiline address
  disclaimerLines?: string[]; // disclaimers / usage notes
  // Terms & address blocks to show below registration lines
  termsTitle?: string;
  termsLines?: string[];
  headOfficeAddress?: string;
  regionalOfficeAddress?: string;
  administrationOfficeAddress?: string;
  showTermsAndAddressesBelowRegistration?: boolean;
  // If true, render labeled address lines below the main row spanning full card width
  addressesFullWidth?: boolean;
  // If true (with addressesFullWidth), show only ADMINISTRATION OFFICE in a larger two-line centered style
  addressesOnlyAdministration?: boolean;
  showJurisdiction?: boolean;
  showRightsHeader?: boolean; // show HUMAN RIGHTS header again on back if needed
  showBottomBlueBand?: boolean; // show bottom blue band/box
  /** Optional scale factor for widths larger than base design (720). */
  wideScale?: number;
}
// Color constants
const RED = '#FE0002';
const BLUE = '#17007A';
export const HrciIdCardBackStandard: React.FC<HrciIdCardBackStandardProps> = ({
  width = 340,
  widthInInches,
  heightInInches,
  bandHeightInches,
  topBandHeightInches,
  bottomBlueBandHeightInches,
  style,
  logoUri,
  qrUri,
  helpline = 'Helpline: +91-0000-000-000',
  email = 'Email: info@hrci.org',
  website = 'Web: www.hrci.org',
  helplineNumbers,
  registrationLines = [],
  alignRegistrationCenter = true,
  showLegacyInfo = true,
  termsTitle = 'Terms & Conditions',
  termsLines = [
    'This card is the property of HRCI and must be returned upon request to HRCI management.',
    'This card can be withdrawn anytime without notice.',
    'Use this card as per the terms and conditions of the cardholder agreement.',
    'If found, please return this card to the nearest police station or HRCI office.'
  ],
  headOfficeAddress,
  regionalOfficeAddress,
  administrationOfficeAddress,
  showTermsAndAddressesBelowRegistration = true,
  addressesFullWidth = false,
  addressesOnlyAdministration = false,
  addressLines = ['Regd Office:', '123 Human Rights Street', 'New Delhi, India'],
  disclaimerLines = [
    'This card remains property of HRCI.',
    'Report loss or misuse immediately.',
    'Misuse is a punishable offence.'
  ],
  showJurisdiction = true,
  showRightsHeader = true,
  showBottomBlueBand = true,
  wideScale,
}) => {
  const landscapeAspect = 54 / 85.6; // ~0.631 (ID-1)
  // Physical mapping (pixels per inch) based on provided widthInInches
  const physWInDefault = 3.375;
  const physHInDefault = 2.125;
  const physWIn = widthInInches ?? physWInDefault;
  const physHIn = heightInInches ?? physHInDefault;
  const pxPerIn = width / physWIn;
  // Prefer physical inches for height when both provided
  const height = (widthInInches && heightInInches)
    ? Math.round(pxPerIn * physHIn)
    : Math.round(width * landscapeAspect);
  const autoScale = wideScale != null ? wideScale : (width > 860 ? (width / 720) : 1);
  const wScale = Math.max(1, autoScale);
  const S = (n: number) => Math.round(n * wScale);
  // Compute top red band height in pixels if inches provided; fallback to existing 32px
  const defaultTopBandPx = 32;
  const topBandPx = (showRightsHeader && (topBandHeightInches != null || bandHeightInches != null))
    ? Math.max(0, Math.round(pxPerIn * (topBandHeightInches ?? (bandHeightInches as number))))
    : defaultTopBandPx;

  // Bottom blue band height in pixels if inches provided; fallback to a small default when enabled
  const defaultBottomBluePx = 30;
  const bottomBluePx = (showBottomBlueBand && bottomBlueBandHeightInches != null)
    ? Math.max(0, Math.round(pxPerIn * bottomBlueBandHeightInches))
    : (showBottomBlueBand ? defaultBottomBluePx : 0);

  // Prepare helpline numbers for bottom blue band (show up to two)
  const preparedHelplineNumbers = (() => {
    const fromProp = (helplineNumbers ?? []).filter(Boolean);
    if (fromProp.length > 0) return fromProp.slice(0, 2);
    // Fallback: try to extract number-like substrings from the helpline text
    if (helpline) {
      const matches = helpline.match(/[+]?\d[\d\s\-()]+/g) || [];
      if (matches.length > 0) return matches.slice(0, 2);
    }
    return [] as string[];
  })();

  const helplineTextJoined = preparedHelplineNumbers.join('  |  ');
  return (
    <View style={[styles.card, { width, height }, style]}>
      {/* Optional top band repeat (always landscape to match front) */}
      {showRightsHeader && (
        <View style={[styles.topRed, { height: topBandPx }]}><Text style={[styles.topTitle]} numberOfLines={1}>HUMAN RIGHTS COUNCIL FOR INDIA (HRCI)</Text></View>
      )}
      {/* Main landscape row (QR left + center info + logo right) */}
        <View style={styles.mainRow}>
          {/* Left: QR only */}
          <View style={[styles.leftCol, wScale>1 && { width: S(72) }]}>
            {qrUri ? (
              <View style={styles.qrWrap}>
                <Image source={{ uri: qrUri }} style={[styles.qr, wScale>1 && { width: S(54), height: S(54) }]} />
              </View>
            ) : null}
          </View>
          {/* Center: either registration block (centered) or legacy info */}
          <View style={[styles.centerCol, alignRegistrationCenter && registrationLines.length ? { alignItems: 'center' } : null]}>
            {registrationLines.length ? (
              <View style={{ paddingHorizontal: 0, width: '100%' }}>
                <Text
                  style={[styles.regLine, alignRegistrationCenter ? { textAlign: 'center' } : null, wScale>1 && { fontSize: S(9), lineHeight: S(8) } ]}
                  numberOfLines={registrationLines.length}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {registrationLines.join('\n')}
                </Text>
                {showTermsAndAddressesBelowRegistration && (
                  <View style={{ marginTop: 2 }}>
                    <Text style={[styles.termsHeader, alignRegistrationCenter ? { textAlign: 'center' } : null, wScale>1 && { fontSize: S(9), lineHeight: S(8) }]} numberOfLines={1}>{termsTitle}</Text>
                    {termsLines.map((t,i)=>(
                      <Text key={`term-${i}`} style={[styles.termsLine, alignRegistrationCenter ? { textAlign: 'center' } : null, wScale>1 && { fontSize: S(4), lineHeight: S(4) }]} numberOfLines={2}>{t}</Text>
                    ))}
                    <View style={{ marginTop: 4 }}>
                      {headOfficeAddress && (
                        <View style={styles.addrGroup}>
                          <Text style={[styles.addrLabelLine, alignRegistrationCenter ? { textAlign: 'center' } : null, wScale>1 && { fontSize: S(7), lineHeight: S(7) }]} numberOfLines={1} ellipsizeMode="clip">HEAD OFFICE</Text>
                          <Text
                            style={[styles.addrValueLineHead, alignRegistrationCenter ? { textAlign: 'center' } : null, wScale>1 && { fontSize: S(7), lineHeight: S(7) }]}
                            numberOfLines={1}
                            ellipsizeMode="clip"
                          >
                            {headOfficeAddress}
                          </Text>
                        </View>
                      )}
                      {regionalOfficeAddress && (
                        <View style={styles.addrGroup}>
                          <Text style={[styles.addrLabelLine, alignRegistrationCenter ? { textAlign: 'center' } : null, wScale>1 && { fontSize: S(7), lineHeight: S(7) }]} numberOfLines={1} ellipsizeMode="clip">REGIONAL OFFICE</Text>
                          <Text
                            style={[styles.addrValueLineTwo, alignRegistrationCenter ? { textAlign: 'center' } : null, wScale>1 && { fontSize: S(7), lineHeight: S(7) }]}
                            numberOfLines={2}
                            ellipsizeMode="clip"
                          >
                            {regionalOfficeAddress}
                          </Text>
                        </View>
                      )}
                      {administrationOfficeAddress && (
                        <View style={styles.addrGroup}>
                          <Text style={[styles.addrLabelLine, alignRegistrationCenter ? { textAlign: 'center' } : null, wScale>1 && { fontSize: S(7), lineHeight: S(7) }]} numberOfLines={1} ellipsizeMode="clip">ADMINISTRATION OFFICE</Text>
                          <Text
                            style={[styles.addrValueLineTwo, alignRegistrationCenter ? { textAlign: 'center' } : null, wScale>1 && { fontSize: S(7), lineHeight: S(7) }]}
                            numberOfLines={2}
                            ellipsizeMode="clip"
                          >
                            {administrationOfficeAddress}
                          </Text>
                        </View>
                      )}
                      {website ? (
                        <Text
                          style={[styles.websiteLine, alignRegistrationCenter ? { textAlign: 'center' } : null, wScale>1 && { fontSize: S(7), lineHeight: S(9) }]}
                          numberOfLines={1}
                          ellipsizeMode="clip"
                          adjustsFontSizeToFit
                          minimumFontScale={0.85}
                        >
                          {website}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <>
                {showJurisdiction && <Text style={[styles.jurisdiction, wScale>1 && { fontSize: S(23) }]} numberOfLines={1}>ALL INDIA JURISDICTION</Text>}
                {showLegacyInfo && <Text style={[styles.infoLine, wScale>1 && { fontSize: S(10) }]} numberOfLines={1}>{helpline}</Text>}
                {showLegacyInfo && <Text style={[styles.infoLine, wScale>1 && { fontSize: S(10) }]} numberOfLines={1}>{email}</Text>}
                {showLegacyInfo && <Text style={[styles.infoLine, wScale>1 && { fontSize: S(10) }]} numberOfLines={1}>{website}</Text>}
                {showLegacyInfo && addressLines.map((l, i) => (
                  <Text key={`addr-${i}`} style={[styles.addrLine, wScale>1 && { fontSize: S(10) }]} numberOfLines={1}>{l}</Text>
                ))}
                {showLegacyInfo && <View style={styles.divider} />}
                {showLegacyInfo && disclaimerLines.map((l, i) => (
                  <Text key={`disc-${i}`} style={[styles.discLine, wScale>1 && { fontSize: S(10) }]} numberOfLines={1}>{l}</Text>
                ))}
              </>
            )}
          </View>
          {/* Right: logo only (keeps visual balance similar to front photo width) */}
          <View style={[styles.rightCol, wScale>1 && { width: S(80) }]}>
            {logoUri ? (
              <View style={styles.rightLogoWrap}>
                <Image source={{ uri: logoUri }} style={[styles.logo, wScale>1 && { width: S(54), height: S(54) }]} />
              </View>
            ) : (
              <View style={[styles.logo, styles.placeholder]}><Text style={styles.phTiny}>LOGO</Text></View>
            )}
          </View>
        </View>
      
      {/* Bottom blue band */}
      {/* Removed bottom full-width addresses block per request: addresses now appear directly under Terms & Conditions */}
      {showBottomBlueBand && (
        <View style={[styles.bottomBlue, { height: bottomBluePx }]}>
          <View style={styles.bottomBlueContent}>
            <Text
              style={[styles.bottomHelpOneLine]}
              numberOfLines={1}
              ellipsizeMode="clip"
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              <Text style={[styles.bottomHelpLabelInline]}>HELP LINE NUMBER</Text>
              {helplineTextJoined ? '  ' : ''}
              {helplineTextJoined ? (
                <Text style={[styles.bottomHelpValuesInline]}>{helplineTextJoined}</Text>
              ) : null}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#F3F4F6', overflow: 'hidden' },
  topRed: { backgroundColor: RED, height: 32, justifyContent: 'center', paddingHorizontal: 0 },
  bottomBlue: { backgroundColor: BLUE, width: '100%' },
  bottomBlueContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  bottomHelpLabel: { color: '#fff', fontSize: 8, lineHeight: 9, fontWeight: '900', letterSpacing: 0.2 },
  bottomHelpValues: { color: '#fff', fontSize: 8, lineHeight: 9, fontWeight: '700', marginTop: 1 },
  bottomHelpOneLine: { color: '#fff', fontSize: 8, lineHeight: 10, fontWeight: '400' },
  bottomHelpLabelInline: { color: '#fff', fontSize: 8, lineHeight: 10, fontWeight: '900' },
  bottomHelpValuesInline: { color: '#fff', fontSize: 8, lineHeight: 10, fontWeight: '700' },
  topTitle: { color: '#fff', fontSize: 13, fontWeight: '900', textAlign: 'center', letterSpacing: 0, fontFamily: Platform.select({ ios: 'Verdana', android: 'verdana', default: 'Verdana' }) },
  mainRow: { flex: 1, flexDirection: 'row', paddingHorizontal: 4, paddingTop: 6 },
  leftCol: { width: 76, alignItems: 'flex-start', paddingLeft: 4, paddingTop: 0 },
  logoWrap: { marginTop: 6, marginBottom: 10 },
  logo: { width: 56, height: 56 },
  qrWrap: { marginTop: 4, marginLeft: 6 },
  qr: { width: 56, height: 56, resizeMode: 'contain' },
  centerCol: { flex: 1, paddingHorizontal: 8, marginLeft: -4, justifyContent: 'flex-start', paddingBottom: 12 },
  jurisdiction: { fontSize: 23, fontWeight: '800', color: '#000', textAlign: 'left', marginBottom: 4 },
  infoLine: { fontSize: 10, fontWeight: '800', color: '#111827', marginBottom: 2 },
  addrLine: { fontSize: 10, fontWeight: '800', color: '#111827', marginBottom: 2 },
  discLine: { fontSize: 10, fontWeight: '800', color: RED, marginBottom: 2 },
  divider: { height: 1, backgroundColor: '#d4d4d8', marginVertical: 4 },
  rightSpacer: { width: 110 },
  placeholder: { backgroundColor: '#d4d4d8', alignItems: 'center', justifyContent: 'center' },
  phTiny: { fontSize: 23, fontWeight: '800', textAlign: 'center', color: '#111827' },
  // New styles for registration lines and right logo column
  // Increase line heights to avoid overlap at high DPI during export
  // Registration block lines (center column): use compact, readable size
  regLine: { fontSize: 10, lineHeight: 11, fontWeight: '800', color: '#111827', marginBottom: 2 },
  termsHeader: { fontSize: 10, lineHeight: 12, fontWeight: '900', color: '#111827', marginTop: 4 },
  termsLine: { fontSize: 6, lineHeight: 7, fontWeight: '700', color: '#111827', marginTop: 3 },
  addrLabel: { fontSize: 11, lineHeight: 13, fontWeight: '800', color: '#111827', marginTop: 3 },
  addrLabelLarge: { fontSize: 11, lineHeight: 13, fontWeight: '800', color: '#111827', marginTop: 3 },
  websiteLine: { fontSize: 8, lineHeight: 10, fontWeight: '800', color: '#111827', marginTop: 5 },
    addrGroup: { marginBottom: 6, paddingHorizontal: 2 },
  addrLabelLine: { fontSize: 8, lineHeight: 10, fontWeight: '900', color: '#111827' },
  addrValueLineHead: { fontSize: 8, lineHeight: 10, fontWeight: '600', color: '#111827', marginTop: 2 },
  addrValueLineTwo: { fontSize: 8, lineHeight: 10, fontWeight: '600', color: '#111827', marginTop: 2 },
  fullWidthAddresses: { paddingHorizontal: 12, paddingTop: -6, alignItems: 'center', marginBottom: 8 },
  addrFull: { fontSize: 10, lineHeight: 5, fontWeight: '800', color: '#111827', marginTop: 2, textAlign: 'center', width: '100%' },
  addrAdminEmphasis: { fontSize: 12, lineHeight: 8, fontWeight: '900', color: '#111827', marginTop: 2, textAlign: 'center' },
  rightCol: { width: 84, alignItems: 'center', paddingRight: 6, paddingTop: 2 },
  rightLogoWrap: { marginTop: 6, marginBottom: 10 },
});

export default HrciIdCardBackStandard;
