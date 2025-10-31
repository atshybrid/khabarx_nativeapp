import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContextNew';
import { emit } from '@/services/events';
import { request } from '@/services/http';
import { getKYCStatus, submitKYC, uploadKYCDocument } from '@/services/kyc';
import { safeBack } from '@/utils/navigation';
import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface DocumentUpload {
  uri: string;
  name: string;
  type: string;
  uploadedUrl?: string;
}

export default function KYCCompletionScreen() {
  const { tokens } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Documents, 2: Details, 3: Review
  
  // Document states
  const [aadhaarFront, setAadhaarFront] = useState<DocumentUpload | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<DocumentUpload | null>(null);
  const [panCard, setPanCard] = useState<DocumentUpload | null>(null);
  const [llbSupportDoc, setLlbSupportDoc] = useState<DocumentUpload | null>(null);
  
  // Form states
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  // Segmented PAN parts for type-wise keyboard control
  const [panPart1, setPanPart1] = useState(''); // AAAAA (letters)
  const [panPart2, setPanPart2] = useState(''); // 1234 (digits)
  const [panPart3, setPanPart3] = useState(''); // Z (letter)
  const [membershipId, setMembershipId] = useState(''); // set from auth/membership API automatically
  // Refs for inputs to control keyboard
  const aadhaarInputRef = useRef<TextInput>(null);
  // Removed old single PAN input ref; using segmented refs instead
  const pan1Ref = useRef<TextInput>(null);
  const pan2Ref = useRef<TextInput>(null);
  const pan3Ref = useRef<TextInput>(null);
  const [designationCode, setDesignationCode] = useState<string>('');
  const isLegalSecretary = useMemo(() => {
    const code = (designationCode || '').toUpperCase().replace(/\s+/g, '_');
    if (!code) return false;
    return code.includes('LEGAL') && code.includes('SECRETARY');
  }, [designationCode]);
  const [llbRegistrationNumber, setLlbRegistrationNumber] = useState('');
  
  // Upload states
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  // Permission states
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null);
  // Note: Library permission/state removed for KYC camera-only flow
  const [cameraAskable, setCameraAskable] = useState<boolean | null>(null);
  // Note: Library permission/state removed for KYC camera-only flow

  // Resolve membershipId from JWT tokens first, then fallback to /memberships/me
  useEffect(() => {
    let mounted = true;
    // Preflight permissions once to avoid repeated prompts during flow
    const preflightPerms = async () => {
      try {
        // Prefer expo-camera for camera permission details
        const cam = await Camera.getCameraPermissionsAsync();
        if (mounted) {
          setCameraGranted(cam.status === 'granted');
          setCameraAskable(Boolean(cam.canAskAgain));
          // For KYC we don't require gallery; nothing to do for library permissions
        }
        // Try to request if not granted yet (first-run)
        if (cam.status !== 'granted') {
          const r = await Camera.requestCameraPermissionsAsync();
          if (mounted) {
            setCameraGranted(r.status === 'granted');
            setCameraAskable(Boolean(r.canAskAgain));
          }
        }
      } catch {}
    };
    preflightPerms();
    const derive = async () => {
      // Try from token payload
      const fromToken = (tokens as any)?.user?.membershipId
        || (tokens as any)?.user?.membership?.id
        || (tokens as any)?.user?.membership_id
        || '';
      if (fromToken) {
        if (mounted) setMembershipId(String(fromToken));
        return;
      }
      // Fallback: fetch membership profile
      try {
        const res = await request<any>('/memberships/me' as any, { method: 'GET' });
        const data = (res as any)?.data || res;
        const mid = data?.id || data?.membershipId || data?.membership?.id;
        if (mid && mounted) setMembershipId(String(mid));
        // Extract designation code/name when available
        try {
          const d = data?.designation ?? data?.membership?.designation;
          let code = '';
          if (typeof d === 'string') {
            code = d;
          } else if (d && (d.code || d.name)) {
            code = d.code || d.name;
          }
          if (mounted && code) setDesignationCode(String(code));
        } catch {}
      } catch {
        // Soft fail; UI will block submit if missing
        try { console.warn('[KYC] Could not resolve membershipId from API'); } catch {}
      }
    };
    derive();
    return () => { mounted = false; };
  }, [tokens]);

  const ensureCameraPermission = async (): Promise<boolean> => {
    try {
      try {
        console.log('[KYC][Pkg]', {
          applicationId: Application.applicationId,
          nativeApplicationVersion: Application.nativeApplicationVersion,
          nativeBuildVersion: Application.nativeBuildVersion,
        });
      } catch {}
      const camCurrent = await Camera.getCameraPermissionsAsync();
      const pickerCurrent = await ImagePicker.getCameraPermissionsAsync();
      console.log('[KYC][Perm] Camera current =', camCurrent, '| Picker current =', pickerCurrent);
      // If permission API reports undetermined and cannot ask again, the build may be missing CAMERA in the manifest
      const current: any = camCurrent ?? pickerCurrent;
      if ((current as any)?.status === 'undetermined' && (current as any)?.canAskAgain === false) {
        Alert.alert(
          'Camera Permission Unavailable',
          'This build may be missing the CAMERA permission. Please reinstall the app or rebuild the Dev Client, then open App info > Permissions > Camera and set to Allow.',
          [
            { text: 'OK' }
          ]
        );
        return false;
      }
      if (camCurrent.granted || camCurrent.status === 'granted' || pickerCurrent.granted || pickerCurrent.status === 'granted') {
        setCameraGranted(true);
        setCameraAskable(Boolean(camCurrent.canAskAgain));
        return true;
      }
      if (camCurrent.canAskAgain || pickerCurrent.canAskAgain) {
        const resCam = await Camera.requestCameraPermissionsAsync();
        const resPick = await ImagePicker.requestCameraPermissionsAsync();
        console.log('[KYC][Perm] Camera requested =', resCam, '| Picker requested =', resPick);
        const ok = (resCam.granted || resCam.status === 'granted') || (resPick.granted || resPick.status === 'granted');
        setCameraGranted(ok);
        setCameraAskable(Boolean(resCam.canAskAgain));
        if (!ok) {
          // User denied but can still ask again later; don't force settings
          Alert.alert('Camera Permission', 'Permission denied. You can try again.', [{ text: 'OK' }]);
        }
        return ok;
      }
      // Not askable anymore -> Recommend settings
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera access: App info > Permissions > Camera > Allow.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings?.() }
        ]
      );
      setCameraAskable(false);
      return false;
    } catch {
      return false;
    }
  };

  // Library permission flow removed for KYC camera-only mode

  const formatAadhaar = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const formatted = cleaned.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3');
    return formatted.slice(0, 14); // Limit to 12 digits + 2 hyphens
  };

  // Keep combined PAN string in sync with segmented parts for validation and submission
  useEffect(() => {
    const combined = (panPart1 + panPart2 + panPart3).toUpperCase();
    if (combined !== panNumber) setPanNumber(combined);
  }, [panPart1, panPart2, panPart3, panNumber]);

  const validateAadhaar = (aadhaar: string) => {
    const cleaned = aadhaar.replace(/\D/g, '');
    return cleaned.length === 12;
  };

  const validatePAN = (pan: string) => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  };

  const pickDocument = async (docType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card' | 'llb_support') => {
    // KYC requires camera capture only (no gallery). Ask camera permission and launch camera directly.
    try {
      const ok = await ensureCameraPermission();
      if (!ok) return;
      await takePhoto(docType);
    } catch (error) {
      console.error('Error starting camera for document:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const takePhoto = async (docType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card' | 'llb_support') => {
    try {
      const ok = await ensureCameraPermission();
      if (!ok) return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const document: DocumentUpload = {
          uri: asset.uri,
          name: `${docType}_${Date.now()}.jpg`,
          type: 'image/jpeg'
        };
        
        setDocumentState(docType, document);
        await uploadDocument(document, docType);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Gallery selection removed in KYC camera-only mode

  const setDocumentState = (docType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card' | 'llb_support', document: DocumentUpload) => {
    switch (docType) {
      case 'aadhaar_front':
        setAadhaarFront(document);
        break;
      case 'aadhaar_back':
        setAadhaarBack(document);
        break;
      case 'pan_card':
        setPanCard(document);
        break;
      case 'llb_support':
        setLlbSupportDoc(document);
        break;
    }
  };

  const uploadDocument = async (document: DocumentUpload, docType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card' | 'llb_support') => {
    try {
      setUploadingDoc(docType);
      
      // Create file object for upload
      const file = {
        uri: document.uri,
        name: document.name,
        type: document.type
      };

      const response = await uploadKYCDocument(file, docType);
      
      // Update document state with uploaded URL
      const updatedDocument = { ...document, uploadedUrl: response.url };
      setDocumentState(docType, updatedDocument);
      
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Failed to upload document. Please try again.');
    } finally {
      setUploadingDoc(null);
    }
  };

  const canProceedToStep2 = () => {
    if (!(aadhaarFront?.uploadedUrl && aadhaarBack?.uploadedUrl && panCard?.uploadedUrl)) return false;
    if (isLegalSecretary) {
      return Boolean(llbSupportDoc?.uploadedUrl);
    }
    return true;
  };

  const canProceedToStep3 = () => {
    // For /memberships/kyc/me, membershipId is inferred from auth and not required to proceed
    if (!(validateAadhaar(aadhaarNumber) && validatePAN(panNumber))) return false;
    if (isLegalSecretary) {
      return llbRegistrationNumber.trim().length > 0;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!aadhaarFront?.uploadedUrl || !aadhaarBack?.uploadedUrl || !panCard?.uploadedUrl) {
      Alert.alert('Missing Documents', 'Please upload all required documents.');
      return;
    }

    if (!canProceedToStep3()) {
      Alert.alert('Invalid Details', 'Please check your Aadhaar and PAN details.');
      return;
    }

    try {
      setLoading(true);
      
      console.log('[KYC][Submit] Preparing payload for POST /memberships/kyc/me');
      const submitRes = await submitKYC({
        // Send Aadhaar exactly as entered (server expects hyphenated format)
        aadhaarNumber: aadhaarNumber.trim(),
        aadhaarFrontUrl: aadhaarFront.uploadedUrl,
        aadhaarBackUrl: aadhaarBack.uploadedUrl,
        panNumber: panNumber.trim(),
        panCardUrl: panCard.uploadedUrl,
        ...(isLegalSecretary && llbRegistrationNumber ? { llbRegistrationNumber: llbRegistrationNumber.trim() } : {}),
        ...(isLegalSecretary && llbSupportDoc?.uploadedUrl ? { llbSupportDocUrl: llbSupportDoc.uploadedUrl } : {}),
      });
      console.log('[KYC][Submit] API responded with:', submitRes);

      // Immediately broadcast the status from submission response (most servers return PENDING)
      try { emit('kyc:updated', { status: (submitRes as any)?.status || 'PENDING' }); } catch {}

      // After submit, re-check KYC status with a short poll to account for backend eventual consistency
      try {
        const tryPoll = async () => {
          const maxTries = 3;
          for (let i = 0; i < maxTries; i++) {
            const statusRes = await getKYCStatus();
            if (statusRes?.status && statusRes.status !== 'NOT_STARTED') {
              emit('kyc:updated', { status: statusRes.status });
              break;
            }
            await new Promise(r => setTimeout(r, 1500));
          }
        };
        tryPoll();
      } catch {}

  // Navigate to dashboard instead of showing a separate success step
      try { emit('toast:show', { message: 'KYC submitted successfully' } as any); } catch {}
  try { router.replace('/hrci' as any); } catch { /* ignore */ }
      
    } catch (error: any) {
      console.error('KYC submission error:', error);
      Alert.alert(
        'Submission Failed',
        error?.message || 'Failed to submit KYC. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const renderDocumentCard = (
    title: string,
    subtitle: string,
    document: DocumentUpload | null,
  docType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card' | 'llb_support',
    icon: string
  ) => {
    const isUploading = uploadingDoc === docType;
    return (
      <Pressable
        style={[styles.docCard, document?.uploadedUrl && styles.docCardComplete, isUploading && styles.docCardUploading]}
        onPress={() => pickDocument(docType)}
        disabled={isUploading}
      >
        <View style={styles.docCardHeader}>
          <View style={styles.docCardTitleRow}>
            <MaterialCommunityIcons 
              name={icon as any} 
              size={24} 
              color={document?.uploadedUrl ? Colors.light.primary : '#6b7280'} 
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.docCardTitle}>{title}</Text>
              <Text style={styles.docCardSubtitle}>{subtitle}</Text>
            </View>
          </View>
          {isUploading ? (
            <LottieView source={require('@/assets/lotti/hrci_loader_svg.json')} autoPlay loop style={{ width: 24, height: 24 }} />
          ) : document?.uploadedUrl ? (
            <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
          ) : (
            <MaterialCommunityIcons name="camera" size={24} color="#9CA3AF" />
          )}
        </View>
        
        {document && (
          <View style={styles.docPreview}>
            {isUploading ? (
              <SkeletonBox style={styles.docImage} />
            ) : (
              <Image
                source={{ uri: document.uri }}
                style={[
                  styles.docImage,
                  document.uploadedUrl ? { borderColor: '#10b981', borderWidth: 2 } : null
                ]}
              />
            )}
            <Text style={[styles.docStatus, isUploading ? { color: '#111' } : null]}>
              {isUploading ? 'Uploading…' :
               document.uploadedUrl ? 'Uploaded Successfully' : 'Upload Pending'}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  const renderStep1 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      {cameraGranted === false ? (
        <View style={styles.permBanner}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#92400E" />
          <Text style={styles.permBannerText}>Permissions required to continue</Text>
          {cameraAskable === false ? (
            <Pressable style={styles.permAction} onPress={() => Linking.openSettings?.()}>
              <Text style={styles.permActionText}>Open Settings</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.permAction} onPress={async () => { await ensureCameraPermission(); }}>
              <Text style={styles.permActionText}>Grant</Text>
            </Pressable>
          )}
        </View>
      ) : null}
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Upload Documents</Text>
        <Text style={styles.stepDescription}>Please upload clear photos of your identity documents</Text>
      </View>

      <View style={styles.documentsContainer}>
        {renderDocumentCard(
          'Aadhaar Card (Front)',
          'Clear photo of front side',
          aadhaarFront,
          'aadhaar_front',
          'card-account-details'
        )}

        {renderDocumentCard(
          'Aadhaar Card (Back)',
          'Clear photo of back side',
          aadhaarBack,
          'aadhaar_back',
          'card-account-details-outline'
        )}

        {renderDocumentCard(
          'PAN Card',
          'Clear photo of PAN card',
          panCard,
          'pan_card',
          'credit-card'
        )}

        {isLegalSecretary && renderDocumentCard(
          'LLB Support Document',
          'Registration proof or supporting document',
          llbSupportDoc,
          'llb_support',
          'file-document-check-outline'
        )}
      </View>

      <View style={styles.stepActions}>
        <Pressable
          style={[styles.primaryBtn, !canProceedToStep2() && styles.btnDisabled]}
          onPress={() => canProceedToStep2() && setStep(2)}
          disabled={!canProceedToStep2()}
        >
          <Text style={[styles.primaryBtnText, !canProceedToStep2() && styles.btnTextDisabled]}>
            Continue
          </Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color={canProceedToStep2() ? '#fff' : '#9CA3AF'} />
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Enter Details</Text>
        <Text style={styles.stepDescription}>Please enter your document details carefully</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Membership ID</Text>
          <View style={[styles.textInput, { justifyContent: 'center' }]}> 
            <Text style={{ color: '#111', fontSize: 16 }} numberOfLines={1}>
              {membershipId ? membershipId : 'Fetching…'}
            </Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Aadhaar Number</Text>
          <TextInput
            style={styles.textInput}
            ref={aadhaarInputRef}
            value={aadhaarNumber}
            onChangeText={(text) => {
              const formatted = formatAadhaar(text);
              setAadhaarNumber(formatted);
              const digits = text.replace(/\D/g, '');
              if (digits.length === 12) {
                // Close keyboard once full Aadhaar entered
                try { Keyboard.dismiss(); } catch {}
              }
            }}
            placeholder="1234-5678-9012"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            maxLength={14}
          />
          {aadhaarNumber && !validateAadhaar(aadhaarNumber) && (
            <Text style={styles.errorText}>Please enter a valid 12-digit Aadhaar number</Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>PAN Number</Text>
          <View style={styles.inputRow}>
            <TextInput
              ref={pan1Ref}
              style={[styles.textInput, styles.panPart, { flex: 5 }]}
              value={panPart1}
              onChangeText={(t) => {
                const cleaned = t.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 5);
                setPanPart1(cleaned);
                if (cleaned.length === 5) {
                  pan2Ref.current?.focus();
                }
              }}
              placeholder="AAAAA"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              keyboardType={Platform.select({ ios: 'ascii-capable', android: 'default', default: 'default' }) as any}
              maxLength={5}
              returnKeyType="next"
              onKeyPress={(e) => {
                if (e.nativeEvent.key === 'Backspace' && panPart1.length === 0) {
                  // stay here
                }
              }}
            />
            <TextInput
              ref={pan2Ref}
              style={[styles.textInput, styles.panPart, { flex: 4 }]}
              value={panPart2}
              onChangeText={(t) => {
                const cleaned = t.replace(/[^0-9]/g, '').slice(0, 4);
                setPanPart2(cleaned);
                if (cleaned.length === 4) {
                  pan3Ref.current?.focus();
                }
              }}
              placeholder="1234"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={4}
              returnKeyType="next"
              onKeyPress={(e) => {
                if (e.nativeEvent.key === 'Backspace' && panPart2.length === 0) {
                  pan1Ref.current?.focus();
                }
              }}
            />
            <TextInput
              ref={pan3Ref}
              style={[styles.textInput, styles.panPart, { flex: 1 }]}
              value={panPart3}
              onChangeText={(t) => {
                const cleaned = t.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1);
                setPanPart3(cleaned);
                if (cleaned.length === 1) {
                  try { Keyboard.dismiss(); } catch {}
                }
              }}
              placeholder="Z"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              keyboardType={Platform.select({ ios: 'ascii-capable', android: 'default', default: 'default' }) as any}
              maxLength={1}
              onKeyPress={(e) => {
                if (e.nativeEvent.key === 'Backspace' && panPart3.length === 0) {
                  pan2Ref.current?.focus();
                }
              }}
            />
          </View>
          {/* Keep combined validation feedback */}
          {panNumber && !validatePAN(panNumber) && (
            <Text style={styles.errorText}>Please enter a valid PAN number</Text>
          )}
        </View>

        {isLegalSecretary && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>LLB Registration Number</Text>
            <TextInput
              style={styles.textInput}
              value={llbRegistrationNumber}
              onChangeText={setLlbRegistrationNumber}
              placeholder="Enter your LLB registration number"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />
            {!llbRegistrationNumber && (
              <Text style={styles.hintText}>Required for Legal Secretary</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.stepActions}>
        <Pressable style={styles.secondaryBtn} onPress={() => setStep(1)}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#111" />
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>

        <Pressable
          style={[styles.primaryBtn, !canProceedToStep3() && styles.btnDisabled]}
          onPress={() => canProceedToStep3() && setStep(3)}
          disabled={!canProceedToStep3()}
        >
          <Text style={[styles.primaryBtnText, !canProceedToStep3() && styles.btnTextDisabled]}>
            Review
          </Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color={canProceedToStep3() ? '#fff' : '#9CA3AF'} />
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Review & Submit</Text>
        <Text style={styles.stepDescription}>Please review your information before submitting</Text>
      </View>

      <View style={styles.reviewContainer}>
        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>Documents</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewDocs}>
            <View style={styles.reviewDocItem}>
              <Image source={{ uri: aadhaarFront?.uri }} style={styles.reviewDocImage} />
              <Text style={styles.reviewDocText}>Aadhaar Front</Text>
            </View>
            <View style={styles.reviewDocItem}>
              <Image source={{ uri: aadhaarBack?.uri }} style={styles.reviewDocImage} />
              <Text style={styles.reviewDocText}>Aadhaar Back</Text>
            </View>
            <View style={styles.reviewDocItem}>
              <Image source={{ uri: panCard?.uri }} style={styles.reviewDocImage} />
              <Text style={styles.reviewDocText}>PAN Card</Text>
            </View>
            {isLegalSecretary && (
              <View style={styles.reviewDocItem}>
                <Image source={{ uri: llbSupportDoc?.uri }} style={styles.reviewDocImage} />
                <Text style={styles.reviewDocText}>LLB Support</Text>
              </View>
            )}
          </ScrollView>
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>Details</Text>
          <View style={styles.reviewDetails}>
            <View style={styles.reviewDetailRow}>
              <Text style={styles.reviewDetailLabel}>Membership ID:</Text>
              <Text style={styles.reviewDetailValue}>{membershipId}</Text>
            </View>
            <View style={styles.reviewDetailRow}>
              <Text style={styles.reviewDetailLabel}>Aadhaar Number:</Text>
              <Text style={styles.reviewDetailValue}>{aadhaarNumber}</Text>
            </View>
            <View style={styles.reviewDetailRow}>
              <Text style={styles.reviewDetailLabel}>PAN Number:</Text>
              <Text style={styles.reviewDetailValue}>{panNumber}</Text>
            </View>
            {isLegalSecretary && (
              <View style={styles.reviewDetailRow}>
                <Text style={styles.reviewDetailLabel}>LLB Reg. No.:</Text>
                <Text style={styles.reviewDetailValue}>{llbRegistrationNumber || '-'}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.stepActions}>
        <Pressable style={styles.secondaryBtn} onPress={() => setStep(2)}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#111" />
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>

        <Pressable
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.primaryBtnText}>Submitting…</Text>
            </>
          ) : (
            <>
              <Text style={styles.primaryBtnText}>Submit KYC</Text>
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );

  // Success step removed; we redirect to dashboard after submit

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3].map((stepNum) => (
        <View key={stepNum} style={styles.progressStep}>
          <View style={[
            styles.progressDot,
            step >= stepNum && styles.progressDotActive,
            step > stepNum && styles.progressDotComplete
          ]}>
            {step > stepNum ? (
              <MaterialCommunityIcons name="check" size={16} color="#fff" />
            ) : (
              <Text style={[styles.progressDotText, step >= stepNum && styles.progressDotTextActive]}>
                {stepNum}
              </Text>
            )}
          </View>
          {stepNum < 3 && (
            <View style={[styles.progressLine, step > stepNum && styles.progressLineActive]} />
          )}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => safeBack(router, '/news')}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#111" />
          </Pressable>
          <Text style={styles.headerTitle}>Complete KYC</Text>
          <View style={{ width: 40 }} />
        </View>

  {/* Progress */}
  {renderProgressBar()}

        {/* Content */}
        <View style={styles.content}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {/* Success step removed; redirect happens after submit */}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Lightweight pulsing skeleton block for loading states
function SkeletonBox({ style }: { style?: any }) {
  const opacity = useRef(new Animated.Value(0.6));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity.current, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity.current, { toValue: 0.6, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[{ backgroundColor: '#e5e7eb' }, style, { opacity: opacity.current }]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 20,
    backgroundColor: '#fff',
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: Colors.light.primary,
  },
  progressDotComplete: {
    backgroundColor: '#10b981',
  },
  progressDotText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  progressDotTextActive: {
    color: '#fff',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#10b981',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stepHeader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
  documentsContainer: {
    gap: 16,
  },
  docCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    ...makeShadow(2, { opacity: 0.1, blur: 8, y: 2 }),
  },
  docCardUploading: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  docCardComplete: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  docCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  docCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  docCardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  docPreview: {
    marginTop: 16,
    alignItems: 'center',
  },
  docImage: {
    width: 120,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  docStatus: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    fontWeight: '600',
  },
  permBanner: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  permBannerText: { color: '#92400E', fontWeight: '700', flex: 1 },
  permAction: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F59E0B' },
  permActionText: { color: '#fff', fontWeight: '800' },
  formContainer: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  panPart: {
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    color: '#6b7280',
  },
  reviewContainer: {
    gap: 24,
  },
  reviewSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    ...makeShadow(2, { opacity: 0.1, blur: 8, y: 2 }),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  reviewSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
  },
  reviewDocs: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 4,
  },
  reviewDocItem: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reviewDocImage: {
    width: 80,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    resizeMode: 'cover',
  },
  reviewDocText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  reviewDetails: {
    gap: 12,
  },
  reviewDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewDetailLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  reviewDetailValue: {
    fontSize: 14,
    color: '#111',
    fontWeight: '700',
  },
  stepActions: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 24,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 12,
    ...makeShadow(4, { opacity: 0.2, blur: 12, y: 4 }),
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  primaryBtnFull: {
    flex: 0,
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: 480,
  },
  successButton: {
    marginTop: 8,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  btnDisabled: {
    backgroundColor: '#e5e7eb',
    borderColor: '#e5e7eb',
  },
  btnTextDisabled: {
    color: '#9CA3AF',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successAnimation: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  successDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
});