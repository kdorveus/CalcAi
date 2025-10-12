import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GoogleLogo from '../app/components/GoogleLogo';
import { useAuth } from '../contexts/AuthContext';
import { usePostHog } from '../contexts/PostHogContext';
import { usePremium } from '../contexts/PremiumContext';
import { useTranslation } from '../hooks/useTranslation';
// Using our bundled AppIcon component instead of MaterialCommunityIcons
import AppIcon from './AppIcon';

interface PremiumPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type PlanType = 'yearly' | 'lifetime';

const PremiumPaymentModal: React.FC<PremiumPaymentModalProps> = ({ visible, onClose }) => {
  const { showPremiumPayment, premiumLoading } = usePremium();
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
  }, [visible, captureEvent]);

  const handlePayment = async () => {
    // If not logged in, trigger login first
    if (!user) {
      setIsLoading(true);
      try {
        const loginResult = await signInWithGoogle();
        // After successful login, redirect to payment
        if (loginResult) {
          captureEvent('payment_initiated', {
            plan: selectedPlan,
            price: selectedPlan === 'yearly' ? '$49' : '$89',
          });
          await showPremiumPayment(selectedPlan);
        }
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
    if (!user) {
      return t('premium.modal.continueWithGoogle');
    }
    switch (selectedPlan) {
      case 'yearly':
        return t('premium.modal.getYearlyAccess');
      case 'lifetime':
        return t('premium.modal.getLifetimeAccess');
      default:
        return t('premium.modal.getAccess');
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <AppIcon name="close" size={24} color="#fff" />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Single Price Display with Header */}
            <View style={styles.priceDisplayContainer}>
              <View style={styles.priceBox}>
                {/* Header with Crown */}
                <View style={styles.headerContainer}>
                  <View style={styles.titleWithIcon}>
                    <AppIcon name="crown" size={24} color="#ff9500" />
                    <Text style={styles.mainTitle}>{t('premium.modal.unlockCalcAIPremium')}</Text>
                  </View>
                </View>

                {/* Price Display */}
                <View style={styles.priceSection}>
                  <View style={styles.priceRow}>
                    <Text style={styles.oldPrice}>
                      {selectedPlan === 'yearly' ? '$69' : '$129'}
                    </Text>
                    <Text style={styles.planPrice}>
                      {selectedPlan === 'yearly' ? '$49' : '$89'}
                    </Text>
                  </View>
                </View>

                {/* Plan Selection Buttons */}
                <View style={styles.planSelectionContainer}>
                  {/* Yearly Option */}
                  <TouchableOpacity
                    style={[
                      styles.planOption,
                      selectedPlan === 'yearly' && styles.planOptionSelected,
                    ]}
                    onPress={() => handlePlanSelection('yearly')}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.radioButton,
                        selectedPlan === 'yearly' && styles.radioButtonSelected,
                      ]}
                    >
                      {selectedPlan === 'yearly' && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text
                      style={[
                        styles.planOptionText,
                        selectedPlan === 'yearly' && styles.planOptionTextSelected,
                      ]}
                    >
                      {t('premium.modal.yearly')}
                    </Text>
                  </TouchableOpacity>

                  {/* Lifetime Option */}
                  <TouchableOpacity
                    style={[
                      styles.planOption,
                      selectedPlan === 'lifetime' && styles.planOptionSelected,
                    ]}
                    onPress={() => handlePlanSelection('lifetime')}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.radioButton,
                        selectedPlan === 'lifetime' && styles.radioButtonSelected,
                      ]}
                    >
                      {selectedPlan === 'lifetime' && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text
                      style={[
                        styles.planOptionText,
                        selectedPlan === 'lifetime' && styles.planOptionTextSelected,
                      ]}
                    >
                      {t('premium.modal.lifetime')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Payment Frequency Text */}
                <Text style={styles.paymentFrequency}>
                  {selectedPlan === 'yearly'
                    ? t('premium.modal.onceAYear')
                    : t('premium.modal.oneTimePayment')}
                </Text>
              </View>
            </View>

            {/* Benefits Section */}
            <View style={styles.benefitsSection}>
              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <AppIcon name="check" size={20} color="#ff9500" />
                  <Text style={styles.benefitText}>
                    {t('premium.modal.benefits.unlimitedVoice')}
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <AppIcon name="check" size={20} color="#ff9500" />
                  <Text style={styles.benefitText}>
                    {t('premium.modal.benefits.webhookIntegrations')}
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <AppIcon name="check" size={20} color="#ff9500" />
                  <Text style={styles.benefitText}>{t('premium.modal.benefits.earlyAccess')}</Text>
                </View>
                <View style={styles.benefitItem}>
                  <AppIcon name="check" size={20} color="#ff9500" />
                  <Text style={styles.benefitText}>{t('premium.modal.benefits.adFree')}</Text>
                </View>
                <View style={styles.benefitItem}>
                  <AppIcon name="check" size={20} color="#ff9500" />
                  <Text style={styles.benefitText}>
                    {t('premium.modal.benefits.exportHistory')}
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <AppIcon name="check" size={20} color="#ff9500" />
                  <Text style={styles.benefitText}>
                    {t('premium.modal.benefits.advancedVoice')}
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <AppIcon name="check" size={20} color="#ff9500" />
                  <Text style={styles.benefitText}>
                    {t('premium.modal.benefits.prioritySupport')}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={!user ? styles.googleButton : styles.paymentButton}
              onPress={handlePayment}
              disabled={isLoading || premiumLoading}
            >
              {isLoading || premiumLoading ? (
                <ActivityIndicator color={!user ? '#4285F4' : '#000'} />
              ) : (
                <View style={styles.buttonContentWrapper}>
                  {!user && (
                    <View style={styles.googleIconWrapper}>
                      <GoogleLogo size={20} />
                    </View>
                  )}
                  <Text style={!user ? styles.googleButtonText : styles.paymentButtonText}>
                    {getPlanButtonText()}
                  </Text>
                </View>
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
                  <AppIcon name="refresh" size={16} color="#999" />
                  <Text style={styles.restoreButtonText}>{t('premium.modal.restorePurchase')}</Text>
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
    borderWidth: 2,
    borderColor: '#ff9500',
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
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mainTitle: {
    fontSize: Platform.OS === 'web' ? 28 : 24,
    fontWeight: 'bold',
    color: '#ff9500',
  },
  planSelectionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  planOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3C3C3E',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  planOptionSelected: {
    borderColor: '#ff9500',
    backgroundColor: 'transparent',
  },
  planOptionText: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#999',
    fontWeight: '500',
  },
  planOptionTextSelected: {
    color: '#ff9500',
    fontWeight: 'bold',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3C3C3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#ff9500',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff9500',
  },
  priceDisplayContainer: {
    marginBottom: 32,
  },
  priceBox: {
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    padding: Platform.OS === 'web' ? 32 : 24,
    paddingTop: Platform.OS === 'web' ? 24 : 20,
    alignItems: 'center',
  },
  priceSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  oldPrice: {
    fontSize: Platform.OS === 'web' ? 24 : 20,
    fontWeight: '500',
    color: '#999',
    textDecorationLine: 'line-through',
  },
  planPrice: {
    fontSize: Platform.OS === 'web' ? 48 : 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  paymentFrequency: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    color: '#666',
    textAlign: 'center',
  },
  discountText: {
    color: '#000',
    fontSize: Platform.OS === 'web' ? 14 : 12,
    fontWeight: 'bold',
  },
  benefitsSection: {
    marginBottom: 24,
  },
  benefitsList: {
    gap: Platform.OS === 'web' ? 14 : 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Platform.OS === 'web' ? 12 : 10,
  },
  benefitText: {
    fontSize: Platform.OS === 'web' ? 15 : 14,
    color: '#fff',
    flex: 1,
    lineHeight: Platform.OS === 'web' ? 22 : 20,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#747775',
    borderRadius: 20,
    height: 40,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  buttonContentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  googleIconWrapper: {
    height: 20,
    width: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonText: {
    fontWeight: '500',
    fontSize: 14,
    color: '#1f1f1f',
    letterSpacing: 0.25,
  },
  paymentButton: {
    backgroundColor: '#ff9500',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#ff9500',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 8px rgba(255, 149, 0, 0.4)',
      },
    }),
  },
  paymentButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
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
    color: '#999',
    fontSize: 12,
    fontWeight: 'normal',
    letterSpacing: 0.5,
  },
});

export default PremiumPaymentModal;
