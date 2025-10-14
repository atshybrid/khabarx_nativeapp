import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
    Alert,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { refreshTokens } from '../../services/auth';
import { emit } from '../../services/events';
import { request } from '../../services/http';
import { ensureIdCardGenerated, getMembershipProfile } from '../../services/membership';

export default function ProfilePhotoScreen() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    console.log('[ProfilePhoto] 📱 Gallery picker launched');
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('[ProfilePhoto] 📸 Gallery picker result:', {
        cancelled: result.canceled,
        hasAssets: (result.assets?.length || 0) > 0,
        timestamp: new Date().toISOString()
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log('[ProfilePhoto] ✅ Image selected from gallery:', {
          uri: imageUri?.slice(0, 50) + '...',
          width: result.assets[0].width,
          height: result.assets[0].height,
          fileSize: result.assets[0].fileSize || 'N/A'
        });
        setSelectedImage(imageUri);
      }
    } catch (e: any) {
      console.error('[ProfilePhoto] ❌ Gallery picker failed:', {
        error: e?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      });
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    console.log('[ProfilePhoto] 📷 Camera launch requested');
    
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      console.log('[ProfilePhoto] 🔐 Camera permission:', {
        granted: permission.granted,
        status: permission.status,
        timestamp: new Date().toISOString()
      });
      
      if (!permission.granted) {
        console.log('[ProfilePhoto] ❌ Camera permission denied');
        Alert.alert('Permission Required', 'Camera access is needed to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('[ProfilePhoto] 📸 Camera result:', {
        cancelled: result.canceled,
        hasAssets: (result.assets?.length || 0) > 0,
        timestamp: new Date().toISOString()
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log('[ProfilePhoto] ✅ Photo captured:', {
          uri: imageUri?.slice(0, 50) + '...',
          width: result.assets[0].width,
          height: result.assets[0].height,
          fileSize: result.assets[0].fileSize || 'N/A'
        });
        setSelectedImage(imageUri);
      }
    } catch (e: any) {
      console.error('[ProfilePhoto] ❌ Camera failed:', {
        error: e?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      });
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const uploadPhoto = async () => {
    if (!selectedImage) {
      console.log('[ProfilePhoto] ⚠️  No image selected for upload');
      Alert.alert('No Image', 'Please select an image first.');
      return;
    }

    console.log('[ProfilePhoto] 🚀 Starting photo upload...');
    console.log('[ProfilePhoto] 🔗 API Call: POST /profiles/me/photo');
    console.log('[ProfilePhoto] 📁 Upload Details:', {
      imageUri: selectedImage?.slice(0, 50) + '...',
      fileType: 'image/jpeg',
      fileName: 'profile-photo.jpg',
      timestamp: new Date().toISOString()
    });

    setUploading(true);
    try {
      const startTime = Date.now();
      
      const formData = new FormData();
      formData.append('file', {
        uri: selectedImage,
        type: 'image/jpeg',
        name: 'profile-photo.jpg',
      } as any);

      let response = await request<any>('/profiles/me/photo', {
        method: 'POST',
        body: formData,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`[ProfilePhoto] ✅ Upload successful (${duration}ms)`);
      console.log('[ProfilePhoto] 📄 Upload Response:', {
        success: response?.success || true,
        photoUrl: response?.data?.profilePhotoUrl?.slice(0, 50) + '...' || 'N/A',
        responseSize: JSON.stringify(response).length,
        timestamp: new Date().toISOString()
      });

      // Fetch combined membership profile
      const combined = await getMembershipProfile();
      const currentStatus = combined?.membership?.idCardStatus || combined?.card?.status;
      console.log('[ProfilePhoto] 🪪 Current ID card status after upload:', currentStatus);
      if (currentStatus !== 'GENERATED') {
        console.log('[ProfilePhoto] 🧾 Attempting to issue ID card...');
        const ensured = await ensureIdCardGenerated();
        const finalStatus = ensured?.membership?.idCardStatus || ensured?.card?.status;
        console.log('[ProfilePhoto] 🧾 Final ID card status:', finalStatus);
      }

      // Broadcast profile update so other screens (dashboard, tech tab) can refresh
      try { emit('profile:updated', { photoUrl: response?.data?.profilePhotoUrl }); } catch {}

      Alert.alert('Success', 'Profile photo updated and ID card refreshed!', [
        { text: 'OK', onPress: () => { try { router.back(); } catch {} } }
      ]);
    } catch (e: any) {
      console.error('[ProfilePhoto] ❌ Upload Failed:', {
        error: e?.message || 'Unknown error',
        status: e?.status || 'N/A',
        timestamp: new Date().toISOString(),
        stack: e?.stack?.slice(0, 200) || 'No stack trace'
      });
      
      if (e?.status === 401) {
        console.log('[ProfilePhoto] 🔐 Auth error - trying token refresh then retry upload');
        try {
          await refreshTokens();
          // retry upload once after refresh
          const formData = new FormData();
          formData.append('file', {
            uri: selectedImage,
            type: 'image/jpeg',
            name: 'profile-photo.jpg',
          } as any);
          await request<any>('/profiles/me/photo', {
            method: 'POST',
            body: formData,
          });
          console.log('[ProfilePhoto] ✅ Retry upload successful after refresh');
          await ensureIdCardGenerated();
          try { emit('profile:updated', { photoUrl: selectedImage }); } catch {}
          Alert.alert('Success', 'Profile photo updated!', [ { text: 'OK', onPress: () => { try { router.back(); } catch {} } } ]);
        } catch (re: any) {
          console.warn('[ProfilePhoto] Retry after refresh failed', re?.message || re);
          Alert.alert('Unauthorized', 'Please login again to upload your photo.');
        }
      } else {
        Alert.alert('Upload Failed', e?.message || 'Failed to upload photo. Please try again.');
      }
    } finally {
      setUploading(false);
      console.log('[ProfilePhoto] 🏁 Upload process completed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Photo</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <MaterialCommunityIcons name="information" size={24} color="#FE0002" />
          <Text style={styles.instructionsTitle}>Upload Your Profile Photo</Text>
          <Text style={styles.instructionsText}>
            Please upload a clear photo of yourself for your HRCI membership profile and ID card.
          </Text>
        </View>

        {/* Photo Preview */}
        <View style={styles.photoContainer}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialCommunityIcons name="camera" size={48} color="#9ca3af" />
              <Text style={styles.placeholderText}>No photo selected</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
            <MaterialCommunityIcons name="image" size={24} color="#FE0002" />
            <Text style={styles.actionText}>Choose from Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
            <MaterialCommunityIcons name="camera" size={24} color="#FE0002" />
            <Text style={styles.actionText}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Upload Button */}
        {selectedImage && (
          <TouchableOpacity
            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
            onPress={uploadPhoto}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <MaterialCommunityIcons name="loading" size={20} color="#ffffff" />
                <Text style={styles.uploadButtonText}>Uploading...</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="upload" size={20} color="#ffffff" />
                <Text style={styles.uploadButtonText}>Upload Photo</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Guidelines */}
        <View style={styles.guidelinesCard}>
          <Text style={styles.guidelinesTitle}>Photo Guidelines</Text>
          <View style={styles.guidelinesList}>
            <View style={styles.guidelineItem}>
              <MaterialCommunityIcons name="check" size={16} color="#1D0DA1" />
              <Text style={styles.guidelineText}>Clear, well-lit photo</Text>
            </View>
            <View style={styles.guidelineItem}>
              <MaterialCommunityIcons name="check" size={16} color="#1D0DA1" />
              <Text style={styles.guidelineText}>Face should be clearly visible</Text>
            </View>
            <View style={styles.guidelineItem}>
              <MaterialCommunityIcons name="check" size={16} color="#1D0DA1" />
              <Text style={styles.guidelineText}>Square aspect ratio preferred</Text>
            </View>
            <View style={styles.guidelineItem}>
              <MaterialCommunityIcons name="check" size={16} color="#1D0DA1" />
              <Text style={styles.guidelineText}>Professional appearance</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { flex: 1, padding: 16 },
  instructionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
    ...makeShadow(2, { opacity: 0.05, blur: 12, y: 1 })
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  photoPreview: {
    width: 200,
    height: 200,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: '#FE0002',
  },
  photoPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    ...makeShadow(2, { opacity: 0.05, blur: 12, y: 1 })
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FE0002',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FE0002',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
    ...makeShadow(4, { opacity: 0.1, blur: 16, y: 2 })
  },
  uploadButtonDisabled: { opacity: 0.7 },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  guidelinesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    ...makeShadow(2, { opacity: 0.05, blur: 12, y: 1 })
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  guidelinesList: { gap: 8 },
  guidelineItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  guidelineText: { fontSize: 14, color: '#374151', flex: 1 },
});