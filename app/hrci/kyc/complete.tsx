import { Colors } from '@/constants/Colors';
import { submitKYC, uploadKYCDocument } from '@/services/kyc';
import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
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
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Documents, 2: Details, 3: Review, 4: Success
  
  // Document states
  const [aadhaarFront, setAadhaarFront] = useState<DocumentUpload | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<DocumentUpload | null>(null);
  const [panCard, setPanCard] = useState<DocumentUpload | null>(null);
  
  // Form states
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [membershipId, setMembershipId] = useState(''); // This should come from auth context
  
  // Upload states
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const formatAadhaar = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const formatted = cleaned.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3');
    return formatted.slice(0, 14); // Limit to 12 digits + 2 hyphens
  };

  const formatPAN = (text: string) => {
    return text.toUpperCase().slice(0, 10);
  };

  const validateAadhaar = (aadhaar: string) => {
    const cleaned = aadhaar.replace(/\D/g, '');
    return cleaned.length === 12;
  };

  const validatePAN = (pan: string) => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  };

  const pickDocument = async (docType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card') => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload documents.');
        return;
      }

      Alert.alert(
        'Select Document',
        'Choose how you want to add your document',
        [
          { text: 'Camera', onPress: () => takePhoto(docType) },
          { text: 'Gallery', onPress: () => pickFromGallery(docType) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to access documents. Please try again.');
    }
  };

  const takePhoto = async (docType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card') => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow camera access to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const pickFromGallery = async (docType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      console.error('Error picking from gallery:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const setDocumentState = (docType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card', document: DocumentUpload) => {
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
    }
  };

  const uploadDocument = async (document: DocumentUpload, docType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card') => {
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
    return aadhaarFront?.uploadedUrl && aadhaarBack?.uploadedUrl && panCard?.uploadedUrl;
  };

  const canProceedToStep3 = () => {
    return validateAadhaar(aadhaarNumber) && validatePAN(panNumber) && membershipId.trim();
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
      
      await submitKYC({
        membershipId: membershipId.trim(),
        aadhaarNumber: aadhaarNumber.replace(/\D/g, ''),
        aadhaarFrontUrl: aadhaarFront.uploadedUrl,
        aadhaarBackUrl: aadhaarBack.uploadedUrl,
        panNumber: panNumber.trim(),
        panCardUrl: panCard.uploadedUrl
      });

      setStep(4); // Success step
      
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
    docType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card',
    icon: string
  ) => (
    <Pressable
      style={[styles.docCard, document?.uploadedUrl && styles.docCardComplete]}
      onPress={() => pickDocument(docType)}
      disabled={uploadingDoc === docType}
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
        {uploadingDoc === docType ? (
          <LottieView source={require('@/assets/lotti/hrci_loader_svg.json')} autoPlay loop style={{ width: 24, height: 24 }} />
        ) : document?.uploadedUrl ? (
          <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
        ) : (
          <MaterialCommunityIcons name="camera" size={24} color="#9CA3AF" />
        )}
      </View>
      
      {document && (
        <View style={styles.docPreview}>
          <Image
            source={{ uri: document.uri }}
            style={[
              styles.docImage,
              document.uploadedUrl ? { borderColor: '#10b981', borderWidth: 2 } : null
            ]}
          />
          <Text style={[styles.docStatus, uploadingDoc === docType ? { color: '#ffffff' } : null]}>
            {uploadingDoc === docType ? 'Uploading...' :
             document.uploadedUrl ? 'Uploaded Successfully' : 'Upload Pending'}
          </Text>
        </View>
      )}
    </Pressable>
  );

  const renderStep1 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
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
          <TextInput
            style={styles.textInput}
            value={membershipId}
            onChangeText={setMembershipId}
            placeholder="Enter your membership ID"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Aadhaar Number</Text>
          <TextInput
            style={styles.textInput}
            value={aadhaarNumber}
            onChangeText={(text) => setAadhaarNumber(formatAadhaar(text))}
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
          <TextInput
            style={styles.textInput}
            value={panNumber}
            onChangeText={(text) => setPanNumber(formatPAN(text))}
            placeholder="ABCDE1234F"
            placeholderTextColor="#9CA3AF"
            maxLength={10}
            autoCapitalize="characters"
          />
          {panNumber && !validatePAN(panNumber) && (
            <Text style={styles.errorText}>Please enter a valid PAN number</Text>
          )}
        </View>
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
          <View style={styles.reviewDocs}>
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
          </View>
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
            <LottieView source={require('@/assets/lotti/hrci_loader_svg.json')} autoPlay loop style={{ width: 20, height: 20 }} />
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

  const renderStep4 = () => (
    <View style={styles.successContainer}>
      <LottieView 
        source={require('@/assets/lotti/hrci_loader_svg.json')} 
        autoPlay 
        loop={false}
        style={styles.successAnimation} 
      />
      <Text style={styles.successTitle}>KYC Submitted Successfully!</Text>
      <Text style={styles.successDescription}>
        Your documents have been submitted for verification. You will be notified once the verification is complete.
      </Text>
      
      <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
        <Text style={styles.primaryBtnText}>Continue</Text>
      </Pressable>
    </View>
  );

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4].map((stepNum) => (
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
          {stepNum < 4 && (
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
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#111" />
          </Pressable>
          <Text style={styles.headerTitle}>Complete KYC</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Progress */}
        {step < 4 && renderProgressBar()}

        {/* Content */}
        <View style={styles.content}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  reviewContainer: {
    gap: 24,
  },
  reviewSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    ...makeShadow(2, { opacity: 0.1, blur: 8, y: 2 }),
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
  },
  reviewDocItem: {
    alignItems: 'center',
    gap: 8,
  },
  reviewDocImage: {
    width: 80,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
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
    opacity: 0.5,
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