import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
// Using our bundled AppIcon component instead of MaterialCommunityIcons
import AppIcon from './AppIcon';
import { usePremium } from '../contexts/PremiumContext';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';

interface PremiumPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type PlanType = 'monthly' | 'yearly' | 'lifetime';

const PremiumPaymentModal: React.FC<PremiumPaymentModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { showPremiumPayment, premiumLoading, productInfo } = usePremium();
  const { user, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('yearly');

  const handlePayment = async () => {
    // If not logged in, trigger login first
    if (!user) {
      setIsLoading(true);
      try {
        await signInWithGoogle();
        // After login, the payment flow will continue
      } catch (error) {
        console.error('Login failed:', error);
      }
      setIsLoading(false);
      return;
    }

    // User is logged in, proceed with payment
    setIsLoading(true);
    await showPremiumPayment(selectedPlan);
    setIsLoading(false);
    // We don't close the modal here because we don't know if payment was successful
    // The premium status will be checked in PremiumContext after payment
  };

  const handleRestorePurchase = async () => {
    setIsRestoring(true);
    // TODO: Implement restore purchase logic
    // This would typically call a restore function from PremiumContext
    setTimeout(() => {
      setIsRestoring(false);
    }, 1000);
  };

  const handleClose = () => {
    if (!isLoading && !isRestoring) {
      onClose();
    }
  };

  const getPlanButtonText = () => {
    const prefix = !user ? 'Login & ' : '';
    switch (selectedPlan) {
      case 'monthly':
        return `${prefix}Get Monthly Access`;
      case 'yearly':
        return `${prefix}Get Yearly Access`;
      case 'lifetime':
        return `${prefix}Get Lifetime Access`;
      default:
        return `${prefix}Get Access`;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <AppIcon name="close" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Premium Header */}
          <View style={styles.premiumHeader}>
            <AppIcon name="crown" size={16} color="#ff9500" />
            <Text style={styles.premiumHeaderText}>PREMIUM</Text>
          </View>
          <View style={styles.headerSeparator} />

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerContainer}>
              <Text style={styles.mainTitle}>World's Most Advanced</Text>
              <Text style={styles.mainTitle}>Voice Calculator</Text>
            </View>

            <View style={styles.pricingContainer}>
              {/* Monthly Plan */}
              <TouchableOpacity 
                style={[
                  styles.priceBox,
                  selectedPlan === 'monthly' && styles.selectedBox
                ]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.7}
              >
                <View style={styles.priceHeader}>
                  <View style={{ height: 24 }} />
                </View>
                <Text style={styles.planName}>Monthly</Text>
                <Text style={styles.planPrice}>$5</Text>
                <Text style={styles.planBilling}>Cancel Anytime</Text>
              </TouchableOpacity>

              {/* Yearly Plan - Most Popular */}
              <TouchableOpacity 
                style={[
                  styles.priceBox,
                  selectedPlan === 'yearly' && styles.selectedBox
                ]}
                onPress={() => setSelectedPlan('yearly')}
                activeOpacity={0.7}
              >
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
                <View style={styles.priceHeader}>
                  <View style={{ height: 24 }} />
                </View>
                <Text style={styles.planName}>Yearly</Text>
                <Text style={styles.planPrice}>$50</Text>
                <Text style={styles.planBilling}>Cancel Anytime</Text>
              </TouchableOpacity>

              {/* Lifetime Plan */}
              <TouchableOpacity 
                style={[
                  styles.priceBox,
                  selectedPlan === 'lifetime' && styles.selectedBox
                ]}
                onPress={() => setSelectedPlan('lifetime')}
                activeOpacity={0.7}
              >
                <View style={styles.priceHeader}>
                  <AppIcon name="crown" size={24} color="#ff9500" />
                </View>
                <Text style={styles.planName}>Lifetime</Text>
                <Text style={styles.planPrice}>$99</Text>
                <Text style={styles.planBilling}>Updates Forever</Text>
              </TouchableOpacity>
            </View>

            {/* Advantages List */}
            <View style={styles.advantagesContainer}>
              <View style={styles.advantageItem}>
                <AppIcon name="microphone" size={16} color="#fff" />
                <Text style={styles.advantageText}>Continuous Mode</Text>
              </View>
              <View style={styles.advantageItem}>
                <AppIcon name="history" size={16} color="#fff" />
                <Text style={styles.advantageText}>History & Sync</Text>
              </View>
              <View style={styles.advantageItem}>
                <AppIcon name="webhook" size={16} color="#fff" />
                <Text style={styles.advantageText}>Webhooks</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.paymentButton}
              onPress={handlePayment}
              disabled={isLoading || premiumLoading}
            >
              {isLoading || premiumLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.paymentButtonText}>{getPlanButtonText()}</Text>
              )}
            </TouchableOpacity>

            {/* Restore Purchase Button */}
            <TouchableOpacity 
              style={styles.restoreButton}
              onPress={handleRestorePurchase}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <AppIcon name="refresh" size={16} color="#fff" />
                  <Text style={styles.restoreButtonText}>RESTORE PURCHASE</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '95%',
    maxWidth: Platform.OS === 'web' ? 650 : '95%',
    maxHeight: '90%',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  scrollContent: {
    padding: Platform.OS === 'web' ? 24 : 16,
    paddingTop: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 6,
    right: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  premiumHeaderText: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#fff',
    letterSpacing: 1.5,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: '#333',
    marginHorizontal: 0,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 8,
  },
  mainTitle: {
    fontSize: Platform.OS === 'web' ? 28 : 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  advantagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
    marginTop: 8,
  },
  advantageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  advantageText: {
    fontSize: 12,
    color: '#fff',
  },
  pricingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  priceBox: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: '#3C3C3E',
    alignItems: 'center',
    minWidth: 0,
  },
  selectedBox: {
    borderColor: '#ff9500',
    borderWidth: 3,
    backgroundColor: '#3C3C3E',
  },
  popularBadge: {
    position: 'absolute',
    top: -2,
    left: 0,
    right: 0,
    backgroundColor: '#ff9500',
    paddingVertical: 6,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  popularBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  priceHeader: {
    marginBottom: 6,
    marginTop: 4,
  },
  planName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff9500',
    marginBottom: 4,
  },
  planBilling: {
    fontSize: 9,
    color: '#999',
  },
  paymentButton: {
    backgroundColor: '#ff9500',
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 8,
    shadowColor: '#ff9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  paymentButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  restoreButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 16,
    gap: 8,
  },
  restoreButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'normal',
    letterSpacing: 0.5,
  },
});

export default PremiumPaymentModal;
