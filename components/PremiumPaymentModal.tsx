import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
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

  const handlePayment = async () => {
    setIsLoading(true);
    await showPremiumPayment();
    setIsLoading(false);
    // We don't close the modal here because we don't know if payment was successful
    // The premium status will be checked in PremiumContext after payment
  };

  const handleClose = () => {
    if (!isLoading) {
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
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('premium.unlockPremiumFeatures')}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <AppIcon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/images/LOGO.png')} 
              style={styles.logo}
              fadeDuration={0}
              defaultSource={require('../assets/images/LOGO.png')}
            />
            <Text style={styles.premiumText}>{t('premium.premium')}</Text>
          </View>

          <View style={styles.contentContainer}>
            <Text style={styles.description}>
              {t('premium.upgradeDescription')}
            </Text>
            
            <View style={styles.featuresContainer}>
              <View style={styles.featureItem}>
                <AppIcon name="check-circle" size={24} color="#4CAF50" />
                <Text style={styles.featureText}>{t('premium.features.sendWebhooks')}</Text>
              </View>
              <View style={styles.featureItem}>
                <AppIcon name="check-circle" size={24} color="#4CAF50" />
                <Text style={styles.featureText}>{t('premium.features.unlimitedHistory')}</Text>
              </View>
              <View style={styles.featureItem}>
                <AppIcon name="check-circle" size={24} color="#4CAF50" />
                <Text style={styles.featureText}>{t('premium.features.lifetimeAccess')}</Text>
              </View>
            </View>

            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>
                {Platform.OS !== 'web' && productInfo ? productInfo.price : '$4.99'}
              </Text>
              <Text style={styles.oneTimeText}>{t('premium.oneTimePayment')}</Text>
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
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: Platform.OS === 'web' ? 400 : '90%',
    maxWidth: 450,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    position: 'relative',
  },
  logo: {
    width: 150,
    height: 60,
    resizeMode: 'contain',
  },
  premiumText: {
    position: 'absolute',
    top: -5,
    right: 80,
    backgroundColor: '#ff9500',
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  contentContainer: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  featuresContainer: {
    marginVertical: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 10,
  },
  priceContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  priceText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  oneTimeText: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  paymentButton: {
    backgroundColor: '#ff9500',
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 10,
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default PremiumPaymentModal;
