import { Colors } from '@/constants/Colors';
import { getKYCStatus, KYCStatus } from '@/services/kyc';
import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View
} from 'react-native';

interface KYCGateProps {
  isLoggedIn: boolean;
  membershipId?: string;
  children: React.ReactNode;
}

export default function KYCGate({ isLoggedIn, membershipId, children }: KYCGateProps) {
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [showKycModal, setShowKycModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkKYCStatus = useCallback(async () => {
    if (!membershipId) return;
    
    try {
      setLoading(true);
      const response = await getKYCStatus();
      setKycStatus(response.status);
      
      // Show modal if KYC is not verified
      if (
        response.status === 'PENDING' ||
        response.status === 'REJECTED' ||
        response.status === 'NOT_STARTED'
      ) {
        setShowKycModal(true);
      }
    } catch (error) {
      console.error('KYC status check error:', error);
      // Don't show error for KYC check failures, just log
    } finally {
      setLoading(false);
    }
  }, [membershipId]);

  useEffect(() => {
    if (isLoggedIn && membershipId) {
      checkKYCStatus();
    }
  }, [isLoggedIn, membershipId, checkKYCStatus]);

  const handleStartKYC = () => {
    setShowKycModal(false);
    router.push('/hrci/kyc/complete');
  };

  const handleSkipForNow = () => {
    setShowKycModal(false);
    // You might want to set a timestamp to remind later
  };

  const renderKYCModal = () => (
    <Modal
      visible={showKycModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowKycModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Pressable 
              style={styles.closeBtn} 
              onPress={() => setShowKycModal(false)}
            >
              <MaterialCommunityIcons name="close" size={24} color="#64748b" />
            </Pressable>
          </View>

          {/* KYC Status Content */}
          <View style={styles.kycContent}>
            {kycStatus === 'PENDING' ? (
              <>
                <LottieView 
                  source={require('@/assets/lotti/hrci_loader_svg.json')} 
                  autoPlay 
                  loop 
                  style={styles.statusAnimation} 
                />
                <Text style={styles.statusTitle}>KYC Verification Pending</Text>
                <Text style={styles.statusDescription}>
                  Your documents are being reviewed. This usually takes 24-48 hours. 
                  You&apos;ll be notified once verification is complete.
                </Text>
                
                <View style={styles.actionButtons}>
                  <Pressable style={styles.primaryBtn} onPress={() => setShowKycModal(false)}>
                    <Text style={styles.primaryBtnText}>Got it</Text>
                  </Pressable>
                </View>
              </>
            ) : kycStatus === 'REJECTED' ? (
              <>
                <View style={styles.rejectedIcon}>
                  <MaterialCommunityIcons name="alert-circle" size={80} color="#ef4444" />
                </View>
                <Text style={styles.statusTitle}>KYC Verification Failed</Text>
                <Text style={styles.statusDescription}>
                  Your documents couldn&apos;t be verified. Please upload clear, valid documents 
                  and try again.
                </Text>
                
                <View style={styles.actionButtons}>
                  <Pressable style={styles.secondaryBtn} onPress={handleSkipForNow}>
                    <Text style={styles.secondaryBtnText}>Skip for now</Text>
                  </Pressable>
                  <Pressable style={styles.primaryBtn} onPress={handleStartKYC}>
                    <Text style={styles.primaryBtnText}>Retry KYC</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View style={styles.kycRequiredIcon}>
                  <MaterialCommunityIcons name="shield-check" size={80} color={Colors.light.primary} />
                </View>
                <Text style={styles.statusTitle}>Complete Your KYC</Text>
                <Text style={styles.statusDescription}>
                  To ensure the security of your account and comply with regulations, 
                  please complete your KYC verification.
                </Text>
                
                <View style={styles.benefitsList}>
                  <View style={styles.benefitItem}>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#10b981" />
                    <Text style={styles.benefitText}>Secure your account</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#10b981" />
                    <Text style={styles.benefitText}>Access all features</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#10b981" />
                    <Text style={styles.benefitText}>Higher transaction limits</Text>
                  </View>
                </View>
                
                <View style={styles.actionButtons}>
                  <Pressable style={styles.secondaryBtn} onPress={handleSkipForNow}>
                    <Text style={styles.secondaryBtnText}>Skip for now</Text>
                  </Pressable>
                  <Pressable style={styles.primaryBtn} onPress={handleStartKYC}>
                    <Text style={styles.primaryBtnText}>Complete KYC</Text>
                    <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  // Show loading state during KYC check
  if (isLoggedIn && loading) {
    return (
      <View style={styles.loadingContainer}>
        <LottieView 
          source={require('@/assets/lotti/hrci_loader_svg.json')} 
          autoPlay 
          loop 
          style={styles.loadingAnimation} 
        />
        <Text style={styles.loadingText}>Checking verification status...</Text>
      </View>
    );
  }

  return (
    <>
      {children}
      {renderKYCModal()}
    </>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingTop: 60, // Account for status bar
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kycContent: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 40,
    alignItems: 'center',
  },
  statusAnimation: {
    width: 120,
    height: 120,
    marginBottom: 32,
  },
  kycRequiredIcon: {
    marginBottom: 32,
  },
  rejectedIcon: {
    marginBottom: 32,
  },
  statusTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  statusDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  benefitsList: {
    alignSelf: 'stretch',
    gap: 16,
    marginBottom: 40,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  benefitText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
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
    alignItems: 'center',
    justifyContent: 'center',
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingAnimation: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
});