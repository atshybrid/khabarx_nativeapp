import React from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HrciIdCardBackStandard } from '../components/HrciIdCardBackStandard';
import { HrciIdCardExport } from '../components/HrciIdCardExport';

export default function IdCardPreviewScreen() {
  const [portrait, setPortrait] = React.useState(false); // default to landscape so photo layout shows
  const [variant, setVariant] = React.useState<'standard' | 'exact'>('standard');
  const [showBack, setShowBack] = React.useState(true);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 12 }}>ID Card Preview</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, fontWeight: '700' }}>Portrait (CR80)</Text>
            <Switch value={portrait} onValueChange={setPortrait} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, fontWeight: '700' }}>Use Exact Design</Text>
            <Switch value={variant === 'exact'} onValueChange={(v) => setVariant(v ? 'exact' : 'standard')} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, fontWeight: '700' }}>Show Back Side</Text>
            <Switch value={showBack} onValueChange={setShowBack} />
          </View>
        </View>
        <View style={{ alignItems: 'center' }}>
          <HrciIdCardExport
            variant={variant}
            orientation={portrait ? 'portrait' : 'landscape'}
            // Physical CR80 credit card size in inches (landscape default: 3.375 x 2.1264 target)
            widthInInches={portrait ? 2.125 : 3.375}
            heightInInches={portrait ? 3.375 : 2.1264}
            dpi={600}
            previewWidth={360}
            exportWidth={2160}
            padToCR80
            // Landscape layout per PDF: photo on right, QR on left
            landscapePhotoSide={portrait ? undefined : 'right'}
            landscapeQrSide={portrait ? undefined : 'left'}
            qrSizePx={portrait ? undefined : 64}
            // Set exact photo size to 25x35 mm (width x height)
            landscapePhotoAspect={portrait ? undefined as any : (25/35)}
            landscapePhotoHeightInches={portrait ? undefined : (35 / 25.4)}
            // Use scale=1 to honor physical inch sizing
            landscapePhotoScale={portrait ? undefined : 1}
            landscapePhotoTopOffsetPx={portrait ? undefined : -6}
            landscapePhotoHorizontalOffsetPx={portrait ? undefined : 60}
            showSignatureUnderPhoto={portrait ? undefined : true}
            landscapeStampScale={portrait ? undefined : 0.5}
            // Precise section heights (landscape). For portrait we let existing layout handle until spec provided.
            topBandHeightInches={portrait ? undefined : 0.24}
            blueBandHeightInches={portrait ? undefined : 0.24}
            bodyHeightInches={portrait ? undefined : (2.1264 - (0.24 + 0.24 + 0.1806))}
            bottomBandHeightInches={portrait ? undefined : 0.1806}
            showSectionDebug={!portrait}
            // Card props (replace with real data/images)
            memberName="DORA REDDY"
            designation="VICE PRESIDENT"
            cellName="GENERAL BODY"
            idNumber="HRCI-2511-00003"
            contactNumber="9502337781"
            validUpto="01-11-2026"
            // Temporary sample QR and placeholders (replace with real URIs)
            qrUri={portrait ? undefined : 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=HRCI-2511-00003'}
            logoUri={undefined}
            photoUri={undefined}
            stampUri={undefined}
            authorSignUri={undefined}
            signatureBottomOffset={56}
            showExportInfo
          />
          {/* Back side preview (landscape only) */}
          {showBack && !portrait && (
            <View style={{ marginTop: 32 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', marginBottom: 8 }}>Back Side</Text>
              <HrciIdCardBackStandard
                width={360}
                widthInInches={3.375}
                heightInInches={2.1264}
                bandHeightInches={0.24}
                topBandHeightInches={0.24}
                logoUri={undefined}
                qrUri={undefined}
                helpline="Helpline: +91-0000-000-000"
                email="Email: info@hrci.org"
                website="Web: www.hrci.org"
                addressLines={["Regd Office:", "123 Human Rights Street", "New Delhi, India"]}
                disclaimerLines={["This card remains property of HRCI.", "Report loss or misuse immediately.", "Misuse is a punishable offence."]}
                showJurisdiction
                showRightsHeader
              />
              <Text style={{ marginTop: 6, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
                Back card uses physical size 3.375 in × 2.1264 in (CR80 landscape) with 0.24 in top band.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
