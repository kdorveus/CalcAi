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
import { useTranslation } from '../hooks/useTranslation';

interface PremiumPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PremiumPaymentModal: React.FC<PremiumPaymentModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { showPremiumPayment, premiumLoading, productInfo } = usePremium();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handlePayment = async () => {
    setIsLoading(true);
    await showPremiumPayment();
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
              <View style={styles.priceBox}>
                <View style={styles.priceHeader}>
                  <AppIcon name="calendar" size={32} color="#ff9500" />
                </View>
                <Text style={styles.planName}>Monthly</Text>
                <Text style={styles.planPrice}>$5.00</Text>
                <Text style={styles.planBilling}>Cancel Anytime</Text>
              </View>

              {/* Yearly Plan - Most Popular */}
              <View style={[styles.priceBox, styles.popularBox]}>
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
                <View style={styles.priceHeader}>
                  <AppIcon name="star" size={32} color="#ff9500" />
                </View>
                <Text style={styles.planName}>Yearly</Text>
                <Text style={styles.planPrice}>$50.00</Text>
                <Text style={styles.planBilling}>Cancel Anytime</Text>
              </View>

              {/* Lifetime Plan */}
              <View style={styles.priceBox}>
                <View style={styles.priceHeader}>
                  <AppIcon name="crown" size={32} color="#ff9500" />
                </View>
                <Text style={styles.planName}>Lifetime</Text>
                <Text style={styles.planPrice}>$99.00</Text>
                <Text style={styles.planBilling}>Updates Forever</Text>
              </View>
            </View>

            {/* Advantages List */}
            <View style={styles.advantagesContainer}>
              <View style={styles.advantageItem}>
                <AppIcon name="check" size={18} color="#fff" />
                <Text style={styles.advantageText}>Continuous Mode</Text>
              </View>
              <View style={styles.advantageItem}>
                <AppIcon name="check" size={18} color="#fff" />
                <Text style={styles.advantageText}>History & Sync</Text>
              </View>
              <View style={styles.advantageItem}>
                <AppIcon name="check" size={18} color="#fff" />
                <Text style={styles.advantageText}>Webhooks</Text>
              </View>
              <View style={styles.advantageItem}>
                <AppIcon name="check" size={18} color="#fff" />
                <Text style={styles.advantageText}>Priority Support</Text>
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
                <>
                  <AppIcon name="lock-open" size={20} color="#fff" />
                  <Text style={styles.paymentButtonText}>{t('premium.getLifetimeAccess')}</Text>
                </>
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
    width: Platform.OS === 'web' ? 600 : '95%',
    maxWidth: 650,
    maxHeight: '90%',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
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
    fontWeight: 'bold',
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
    fontSize: 28,
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
    fontSize: 14,
    color: '#fff',
  },
  pricingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  priceBox: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#3C3C3E',
    alignItems: 'center',
  },
  popularBox: {
    backgroundColor: '#2C2C2E',
    borderColor: '#ff9500',
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
    shadowColor: '#ff9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    marginBottom: 12,
    marginTop: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ff9500',
    marginBottom: 4,
  },
  planBilling: {
    fontSize: 12,
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
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default PremiumPaymentModal;
