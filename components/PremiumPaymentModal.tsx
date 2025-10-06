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
import { usePostHog } from '../contexts/PostHogContext';

interface PremiumPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type PlanType = 'yearly' | 'lifetime';

const PremiumPaymentModal: React.FC<PremiumPaymentModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { showPremiumPayment, premiumLoading, productInfo } = usePremium();
  const { user, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const { captureEvent } = usePostHog();
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('lifetime');

  // Track when the modal becomes visible
  React.useEffect(() => {
    if (visible) {
      captureEvent('premium_modal_viewed');
    }
  }, [visible]);

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
    captureEvent('payment_initiated', {
      plan: selectedPlan,
      price: selectedPlan === 'yearly' ? '$49' : '$89',
    });
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

  const handlePlanSelection = (plan: PlanType) => {
    setSelectedPlan(plan);
    captureEvent('plan_selected', { plan });
  };

  const getPlanButtonText = () => {
    const prefix = !user ? 'Login & ' : '';
    switch (selectedPlan) {
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
              {/* Yearly Plan */}
              <TouchableOpacity 
                style={[
                  styles.priceBox,
                  selectedPlan === 'yearly' && styles.selectedBox
                ]}
                onPress={() => handlePlanSelection('yearly')}
                activeOpacity={0.7}
              >
                {selectedPlan === 'yearly' && <View style={styles.selectedBanner} />}
                
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>Pro</Text>
                </View>
                
                <View style={styles.priceSection}>
                  <Text style={styles.planPrice}>$49</Text>
                  <Text style={styles.planBilling}>/year</Text>
                </View>
                
                <Text style={styles.planSubtext}>Ideal for growing teams and businesses</Text>
                
                <View style={styles.benefitsList}>
                  <View style={styles.benefitItem}>
                    <AppIcon name="check" size={16} color="#ff9500" />
                    <Text style={styles.benefitText}>Continuous Mode</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <AppIcon name="check" size={16} color="#ff9500" />
                    <Text style={styles.benefitText}>History & Sync</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <AppIcon name="check" size={16} color="#ff9500" />
                    <Text style={styles.benefitText}>Webhooks</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <AppIcon name="check" size={16} color="#ff9500" />
                    <Text style={styles.benefitText}>Priority Support</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Lifetime Plan */}
              <TouchableOpacity 
                style={[
                  styles.priceBox,
                  selectedPlan === 'lifetime' && styles.selectedBox
                ]}
                onPress={() => handlePlanSelection('lifetime')}
                activeOpacity={0.7}
              >
                {selectedPlan === 'lifetime' && <View style={styles.selectedBanner} />}
                
                <View style={styles.planHeader}>
                  <AppIcon name="crown" size={20} color="#ff9500" />
                  <Text style={styles.planName}>Lifetime</Text>
                </View>
                
                <View style={styles.priceSection}>
                  <Text style={styles.planPrice}>$89</Text>
                  <Text style={styles.planBilling}> lifetime</Text>
                </View>
                
                <Text style={styles.planSubtext}>One-time payment, yours forever</Text>
                
                <View style={styles.benefitsList}>
                  <View style={styles.benefitItem}>
                    <AppIcon name="check" size={16} color="#ff9500" />
                    <Text style={styles.benefitText}>Continuous Mode</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <AppIcon name="check" size={16} color="#ff9500" />
                    <Text style={styles.benefitText}>History & Sync</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <AppIcon name="check" size={16} color="#ff9500" />
                    <Text style={styles.benefitText}>Webhooks</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <AppIcon name="check" size={16} color="#ff9500" />
                    <Text style={styles.benefitText}>Priority Support</Text>
                  </View>
                </View>
              </TouchableOpacity>
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
  pricingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: Platform.OS === 'web' ? 16 : 12,
  },
  priceBox: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: Platform.OS === 'web' ? 20 : 16,
    borderWidth: 2,
    borderColor: '#3C3C3E',
    minWidth: 0,
  },
  selectedBox: {
    borderColor: '#ff9500',
    borderWidth: 3,
    backgroundColor: '#2C2C2E',
  },
  popularBadge: {
    position: 'absolute',
    top: -2,
    left: 0,
    right: 0,
    backgroundColor: '#ff9500',
    paddingVertical: Platform.OS === 'web' ? 6 : 5,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  popularBadgeText: {
    color: '#000',
    fontSize: Platform.OS === 'web' ? 10 : 9,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Platform.OS === 'web' ? 16 : 12,
    marginTop: Platform.OS === 'web' ? 8 : 6,
  },
  planName: {
    fontSize: Platform.OS === 'web' ? 20 : 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Platform.OS === 'web' ? 12 : 10,
  },
  planPrice: {
    fontSize: Platform.OS === 'web' ? 32 : 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  planBilling: {
    fontSize: Platform.OS === 'web' ? 16 : 13,
    color: '#999',
  },
  planSubtext: {
    fontSize: Platform.OS === 'web' ? 13 : 11,
    color: '#999',
    marginBottom: Platform.OS === 'web' ? 20 : 16,
    lineHeight: Platform.OS === 'web' ? 18 : 15,
  },
  benefitsList: {
    gap: Platform.OS === 'web' ? 12 : 10,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.OS === 'web' ? 10 : 8,
  },
  benefitText: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    color: '#fff',
    flex: 1,
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
