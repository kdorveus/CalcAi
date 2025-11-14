import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Path, Svg } from 'react-native-svg';
import GoogleLogo from '../app/components/GoogleLogo';
import { useAuth } from '../contexts/AuthContext';
import { usePostHog } from '../contexts/PostHogContext';
import { usePremium } from '../contexts/PremiumContext';
import { useTranslation } from '../hooks/useTranslation';
// Using our bundled AppIcon component instead of MaterialCommunityIcons
import AppIcon from './AppIcon';

// Shield icon for ad-free experience (represents protection from ads)
const AdFreeIcon = ({ size = 16, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <Path d="M9 12l2 2 4-4" />
  </Svg>
);

interface PremiumPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  forceFullModal?: boolean; // Force full modal even on web
  onSuccess?: () => void;
}

type PlanType = 'yearly' | 'lifetime';

// Extract web bubble component to reduce complexity
const WebBubble: React.FC<{
  visible: boolean;
  bubbleOpacity: Animated.Value;
  bubbleTranslateY: Animated.Value;
  bubbleScale: Animated.Value;
  animatedTransform: string;
  onPress: () => void;
  onClose: () => void;
  captureEvent: (event: string) => void;
  isMobile: boolean;
  t: (key: string) => string;
}> = ({
  visible,
  bubbleOpacity,
  bubbleTranslateY,
  bubbleScale,
  animatedTransform,
  onPress,
  onClose,
  captureEvent,
  isMobile,
  t,
}) => {
  if (!visible) return null;

  return (
    <View style={[styles.webBubbleContainer, isMobile && styles.webBubbleContainerMobile]}>
      <Animated.View
        style={{
          opacity: bubbleOpacity,
          ...Platform.select({
            web: {
              transform: animatedTransform,
            },
            default: {
              transform: [{ translateY: bubbleTranslateY }, { scale: bubbleScale }],
            },
          }),
        }}
      >
        <TouchableOpacity
          style={[styles.webBubble, isMobile && styles.webBubbleMobile]}
          onPress={() => {
            onPress();
            captureEvent('premium_bubble_clicked');
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.webBubbleContent, isMobile && styles.webBubbleContentMobile]}>
            <View
              style={[styles.webBubbleIconWrapper, isMobile && styles.webBubbleIconWrapperMobile]}
            >
              <AppIcon name="crown" size={isMobile ? 18 : 20} color="#ff9500" />
            </View>
            <Text
              style={[styles.webBubbleText, isMobile && styles.webBubbleTextMobile]}
              numberOfLines={1}
            >
              {t('premium.unlockPremiumFeatures')}?
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.webBubbleClose, isMobile && styles.webBubbleCloseMobile]}
            onPress={(e) => {
              e.stopPropagation();
              onClose();
              captureEvent('premium_bubble_dismissed');
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View
              style={[
                styles.webBubbleCloseIconWrapper,
                isMobile && styles.webBubbleCloseIconWrapperMobile,
              ]}
            >
              <AppIcon name="close" size={isMobile ? 14 : 16} color="#999" />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const PremiumPaymentModal: React.FC<PremiumPaymentModalProps> = ({
  visible,
  onClose,
  forceFullModal = false,
  onSuccess,
}) => {
  const { isPremium, showPremiumPayment, premiumLoading } = usePremium();
  const { user, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const { captureEvent } = usePostHog();
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('lifetime');
  const [showFullModal, setShowFullModal] = useState(false);

  // Animation constants
  const ANIMATION_DURATION = 400;
  const SPRING_TENSION = 50;
  const SPRING_FRICTION = 7;
  const INITIAL_TRANSLATE_Y = -20;
  const INITIAL_SCALE = 0.9;

  // Animation values for bubble entrance
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const bubbleTranslateY = useRef(new Animated.Value(INITIAL_TRANSLATE_Y)).current;
  const bubbleScale = useRef(new Animated.Value(INITIAL_SCALE)).current;
  const [animatedTransform, setAnimatedTransform] = useState(
    `translateX(-50%) translateY(${INITIAL_TRANSLATE_Y}px) scale(${INITIAL_SCALE})`
  );

  // Track animation values safely without private API
  const translateYValueRef = useRef(INITIAL_TRANSLATE_Y);
  const scaleValueRef = useRef(INITIAL_SCALE);

  // Helper to build transform string
  const buildTransformString = useCallback((translateY: number, scale: number) => {
    return `translateX(-50%) translateY(${translateY}px) scale(${scale})`;
  }, []);

  // Responsive check for mobile
  const [isMobile, setIsMobile] = useState(() => {
    if (Platform.OS === 'web' && globalThis.window !== undefined) {
      return Dimensions.get('window').width <= 580;
    }
    return Platform.OS !== 'web';
  });

  const isWeb = Platform.OS === 'web';

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const updateLayout = () => {
        setIsMobile(Dimensions.get('window').width <= 580);
      };
      const subscription = Dimensions.addEventListener('change', updateLayout);
      return () => subscription.remove();
    }
  }, []);

  // Track when the modal becomes visible
  React.useEffect(() => {
    if (visible) {
      captureEvent('premium_modal_viewed');
    }
  }, [visible, captureEvent]);

  // Helper: Reset animation values to initial state
  const resetAnimationValues = useCallback(() => {
    bubbleOpacity.setValue(0);
    bubbleTranslateY.setValue(INITIAL_TRANSLATE_Y);
    bubbleScale.setValue(INITIAL_SCALE);
    translateYValueRef.current = INITIAL_TRANSLATE_Y;
    scaleValueRef.current = INITIAL_SCALE;
    setAnimatedTransform(buildTransformString(INITIAL_TRANSLATE_Y, INITIAL_SCALE));
  }, [bubbleOpacity, bubbleTranslateY, bubbleScale, buildTransformString]);

  // Helper: Create animation listeners
  const createAnimationListeners = useCallback(
    (isMountedRef: React.MutableRefObject<boolean>) => {
      const translateYListener = bubbleTranslateY.addListener(({ value }) => {
        if (!isMountedRef.current) return;
        translateYValueRef.current = value;
        setAnimatedTransform(buildTransformString(value, scaleValueRef.current));
      });

      const scaleListener = bubbleScale.addListener(({ value }) => {
        if (!isMountedRef.current) return;
        scaleValueRef.current = value;
        setAnimatedTransform(buildTransformString(translateYValueRef.current, value));
      });

      return { translateYListener, scaleListener };
    },
    [bubbleTranslateY, bubbleScale, buildTransformString]
  );

  // Helper: Start bubble entrance animation
  const startBubbleAnimation = useCallback(
    (listeners: { translateYListener: string; scaleListener: string }) => {
      Animated.parallel([
        Animated.timing(bubbleOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: false,
        }),
        Animated.spring(bubbleTranslateY, {
          toValue: 0,
          tension: SPRING_TENSION,
          friction: SPRING_FRICTION,
          useNativeDriver: false,
        }),
        Animated.spring(bubbleScale, {
          toValue: 1,
          tension: SPRING_TENSION,
          friction: SPRING_FRICTION,
          useNativeDriver: false,
        }),
      ]).start(() => {
        bubbleTranslateY.removeListener(listeners.translateYListener);
        bubbleScale.removeListener(listeners.scaleListener);
      });
    },
    [bubbleOpacity, bubbleTranslateY, bubbleScale]
  );

  // Animate bubble entrance
  useEffect(() => {
    const isMountedRef = { current: true };
    let listeners: { translateYListener: string; scaleListener: string } | null = null;

    const shouldShowBubble = visible && isWeb && !showFullModal && !forceFullModal && !isPremium;

    if (shouldShowBubble) {
      resetAnimationValues();
      listeners = createAnimationListeners(isMountedRef);
      startBubbleAnimation(listeners);
    } else {
      resetAnimationValues();
    }

    return () => {
      isMountedRef.current = false;
      if (listeners) {
        bubbleTranslateY.removeListener(listeners.translateYListener);
        bubbleScale.removeListener(listeners.scaleListener);
      }
    };
  }, [
    visible,
    isWeb,
    showFullModal,
    forceFullModal,
    isPremium,
    resetAnimationValues,
    createAnimationListeners,
    startBubbleAnimation,
    bubbleTranslateY,
    bubbleScale,
  ]);

  const handleLoginAndPayment = useCallback(async () => {
    setIsLoading(true);
    try {
      const loginResult = await signInWithGoogle();
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
  }, [signInWithGoogle, captureEvent, selectedPlan, showPremiumPayment]);

  const processPayment = useCallback(async () => {
    captureEvent('payment_initiated', {
      plan: selectedPlan,
      price: selectedPlan === 'yearly' ? '$49' : '$89',
    });
    setIsLoading(true);
    await showPremiumPayment(selectedPlan);
    setIsLoading(false);
  }, [captureEvent, selectedPlan, showPremiumPayment]);

  const handlePayment = async () => {
    if (!user) {
      await handleLoginAndPayment();
      return;
    }
    await processPayment();
  };

  // Helper: Check if platform supports restore purchase
  const isMobilePlatform = useCallback(() => {
    return Platform.OS === 'android' || Platform.OS === 'ios';
  }, []);

  // Helper: Restore purchases on mobile platform
  const restoreMobilePurchases = useCallback(async () => {
    const PurchasesModule = require('react-native-purchases').default;
    if (!PurchasesModule) {
      return false;
    }

    const customerInfo = await PurchasesModule.restorePurchases();
    return customerInfo.entitlements.active.premium;
  }, []);

  // Helper: Handle restore purchase result
  const handleRestoreResult = useCallback(
    (hasPremium: boolean) => {
      if (hasPremium) {
        Alert.alert('Success', 'Your purchases have been restored.');
        onClose();
      } else {
        Alert.alert('No Purchases', 'No previous purchases found to restore.');
      }
    },
    [onClose]
  );

  const handleRestorePurchase = useCallback(async () => {
    setIsRestoring(true);
    try {
      if (!isMobilePlatform()) {
        Alert.alert('Not Available', 'Restore purchase is only available on mobile devices.');
        return;
      }

      const hasPremium = await restoreMobilePurchases();
      handleRestoreResult(hasPremium);
    } catch {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  }, [isMobilePlatform, restoreMobilePurchases, handleRestoreResult]);

  const handleClose = () => {
    if (!isLoading && !isRestoring) {
      setShowFullModal(false);
      onClose();
      if (isPremium && onSuccess) {
        onSuccess();
      }
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

  // Web: Show non-intrusive bubble, Mobile: Show full modal
  // If user clicks bubble, showFullModal becomes true and full modal appears
  // If forceFullModal is true (e.g., from PRO button), skip bubble and show full modal
  // Premium users never see the upgrade bubble.
  if (isWeb && visible && !showFullModal && !forceFullModal && !isPremium) {
    return (
      <WebBubble
        visible={visible}
        bubbleOpacity={bubbleOpacity}
        bubbleTranslateY={bubbleTranslateY}
        bubbleScale={bubbleScale}
        animatedTransform={animatedTransform}
        onPress={() => setShowFullModal(true)}
        onClose={handleClose}
        captureEvent={captureEvent}
        isMobile={isMobile}
        t={t}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        setShowFullModal(false);
        handleClose();
      }}
    >
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity
          style={[styles.modalWrapper, isMobile && styles.modalWrapperMobile]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.modalContainer, isMobile && styles.modalContainerMobile]}>
            {/* Image Container */}
            <View style={[styles.imageContainer, isMobile && styles.imageContainerMobile]}>
              <Image
                source={require('../assets/images/popup.webp')}
                style={styles.image}
                resizeMode="cover"
              />
              <View style={styles.logoOverlay}>
                <Image
                  source={require('../assets/images/icon.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Text Container with Glass Morphism */}
            <View style={[styles.textContainer, isMobile && styles.textContainerMobile]}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              >
                <View style={styles.content}>
                  {/* Title */}
                  <View style={styles.titleContainer}>
                    <Text style={styles.title} numberOfLines={1}>
                      {t('premium.unlockPremiumFeatures').toUpperCase()}
                    </Text>
                  </View>

                  {/* Plan Selection */}
                  <View style={styles.planSelectionContainer}>
                    <TouchableOpacity
                      style={[
                        styles.planOption,
                        selectedPlan === 'yearly' && styles.planOptionSelected,
                      ]}
                      onPress={() => handlePlanSelection('yearly')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.planOptionText,
                          selectedPlan === 'yearly' && styles.planOptionTextSelected,
                        ]}
                      >
                        {t('premium.modal.yearly')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.planOption,
                        selectedPlan === 'lifetime' && styles.planOptionSelected,
                      ]}
                      onPress={() => handlePlanSelection('lifetime')}
                      activeOpacity={0.8}
                    >
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

                  {/* Price Display - Only show when user is logged in */}
                  {user && (
                    <View style={styles.priceRow}>
                      <Text style={styles.oldPrice}>
                        {selectedPlan === 'yearly' ? '$69' : '$129'}
                      </Text>
                      <Text style={styles.planPrice}>
                        {selectedPlan === 'yearly' ? '$49' : '$89'}
                      </Text>
                      <Text style={styles.paymentFrequency}>
                        {selectedPlan === 'yearly'
                          ? t('premium.modal.onceAYear')
                          : t('premium.modal.oneTimePayment')}
                      </Text>
                    </View>
                  )}

                  {/* Features List */}
                  <View style={styles.featuresList}>
                    <View style={styles.featureItem}>
                      <AppIcon name="microphone" size={16} color="#fff" />
                      <Text style={styles.featureText}>
                        {t('premium.modal.benefits.unlimitedVoice')}
                      </Text>
                    </View>
                    <View style={styles.featureItem}>
                      <AppIcon name="webhook" size={16} color="#fff" />
                      <Text style={styles.featureText}>
                        {t('premium.modal.benefits.webhookIntegrations')}
                      </Text>
                    </View>
                    <View style={styles.featureItem}>
                      <AppIcon name="check-decagram" size={16} color="#fff" />
                      <Text style={styles.featureText}>
                        {t('premium.modal.benefits.earlyAccess')}
                      </Text>
                    </View>
                    <View style={styles.featureItem}>
                      <AdFreeIcon size={16} color="#fff" />
                      <Text style={styles.featureText}>{t('premium.modal.benefits.adFree')}</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <AppIcon name="history" size={16} color="#fff" />
                      <Text style={styles.featureText}>
                        {t('premium.modal.benefits.exportHistory')}
                      </Text>
                    </View>
                    <View style={styles.featureItem}>
                      <AppIcon name="audio-lines" size={16} color="#fff" />
                      <Text style={styles.featureText}>
                        {t('premium.modal.benefits.advancedVoice')}
                      </Text>
                    </View>
                  </View>

                  {/* Payment Button */}
                  <TouchableOpacity
                    style={[
                      styles.paymentButton,
                      !user && styles.googleButton,
                      (isLoading || premiumLoading) && styles.buttonDisabled,
                    ]}
                    onPress={handlePayment}
                    disabled={isLoading || premiumLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading || premiumLoading ? (
                      <ActivityIndicator color={user ? '#fff' : '#4285F4'} />
                    ) : (
                      <View style={styles.buttonContentWrapper}>
                        {user ? null : (
                          <View style={styles.googleIconWrapper}>
                            <GoogleLogo size={20} />
                          </View>
                        )}
                        <Text style={user ? styles.paymentButtonText : styles.googleButtonText}>
                          {getPlanButtonText()}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Restore Purchase Button - Only show when user is logged in */}
                  {user && (
                    <TouchableOpacity
                      style={styles.restoreButton}
                      onPress={handleRestorePurchase}
                      disabled={isRestoring}
                    >
                      {isRestoring ? (
                        <ActivityIndicator color="#999" size="small" />
                      ) : (
                        <>
                          <AppIcon name="refresh" size={16} color="#999" />
                          <Text style={styles.restoreButtonText}>
                            {t('premium.modal.restorePurchase')}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '95%',
    width: Platform.OS === 'web' ? undefined : 550,
    alignSelf: 'center',
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        top: '50%' as any,
        left: '50%' as any,
        transform: 'translate(-50%, -50%)' as any,
        zIndex: 2000,
        width: 'fit-content' as any,
      },
    }),
  },
  modalWrapperMobile: {
    flexDirection: 'column',
    maxWidth: '95%',
    minWidth: 320,
    width: '95%',
    alignSelf: 'center',
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        top: '50%' as any,
        left: '50%' as any,
        transform: 'translate(-50%, -50%)' as any,
        zIndex: 2000,
        width: 'fit-content' as any,
        maxWidth: 'min(95vw, 400px)' as any,
      },
    }),
  },
  modalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalContainerMobile: {
    flexDirection: 'column',
    gap: 4,
    alignItems: 'center',
    width: '100%',
  },
  imageContainer: {
    width: 250,
    height: 360,
    overflow: 'hidden',
    backgroundColor: '#141414',
    borderRadius: 20,
    flexShrink: 0,
  },
  imageContainerMobile: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 16 / 9,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  logoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 60,
    height: 60,
    borderRadius: 0,
    borderBottomLeftRadius: 20,
    padding: 8,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    width: 300,
    backgroundColor: 'rgba(20, 20, 20, 0.98)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    minHeight: 400,
    position: 'relative',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)' as any,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)' as any,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  textContainerMobile: {
    width: '100%',
    maxWidth: 320,
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexDirection: 'column',
    width: '100%',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 28,
    textAlign: 'left',
    flexShrink: 1,
  },
  titleLogo: {
    height: 32,
    width: 400,
    flexShrink: 1,
  },
  planSelectionContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  planOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  planOptionSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  planOptionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  planOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  oldPrice: {
    fontSize: 40,
    fontWeight: '500',
    color: '#999',
    textDecorationLine: 'line-through',
  },
  planPrice: {
    fontSize: 36,
    fontWeight: '500',
    color: '#fff',
  },
  paymentFrequency: {
    fontSize: 12,
    color: '#666',
  },
  featuresList: {
    marginTop: 12,
    marginBottom: 0,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: '#b0b0b0',
  },
  featureTextNormal: {
    color: '#b0b0b0',
  },
  featureTextBold: {
    color: '#ffffff',
    fontWeight: '700',
  },
  paymentButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    display: 'flex',
    backgroundColor: '#0084ff',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #0084ff 0%, #00d4ff 100%)' as any,
        boxShadow: '0 4px 20px rgba(0, 132, 255, 0.3)' as any,
      },
      ios: {
        shadowColor: '#0084ff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#747775',
    ...Platform.select({
      web: {
        backgroundImage: 'none' as any,
        boxShadow: 'none' as any,
      },
      ios: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleIconWrapper: {
    height: 20,
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  restoreButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 0,
    marginBottom: 16,
    gap: 8,
  },
  restoreButtonText: {
    color: '#999',
    fontSize: 12,
    fontWeight: 'normal',
    letterSpacing: 0.5,
  },
  // Web bubble styles (non-intrusive)
  webBubbleContainer: {
    position: 'fixed' as any,
    top: 60,
    left: '50%' as any,
    zIndex: 9999,
    ...Platform.select({
      web: {
        pointerEvents: 'auto' as any,
      },
    }),
  },
  webBubbleContainerMobile: {
    top: 20,
    left: '50%' as any,
    ...Platform.select({
      web: {
        width: 'auto' as any,
        maxWidth: 'calc(100vw - 32px)' as any,
      },
    }),
  },
  webBubble: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.4)',
    minWidth: 240,
    maxWidth: 320,
    ...Platform.select({
      web: {
        boxShadow:
          '0 0 20px rgba(255, 149, 0, 0.4), 0 0 40px rgba(255, 149, 0, 0.2), 0 8px 32px rgba(0, 0, 0, 0.4)' as any,
        backdropFilter: 'blur(10px)' as any,
        cursor: 'pointer' as any,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease' as any,
        willChange: 'transform, opacity' as any,
      },
      ios: {
        shadowColor: '#ff9500',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  webBubbleMobile: {
    width: 'auto' as any,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row' as any,
    alignItems: 'center' as any,
    alignSelf: 'center' as any,
    ...Platform.select({
      web: {
        boxShadow:
          '0 0 15px rgba(255, 149, 0, 0.3), 0 0 30px rgba(255, 149, 0, 0.15), 0 6px 24px rgba(0, 0, 0, 0.3)' as any,
        maxWidth: 'calc(100vw - 32px)' as any,
      },
    }),
  },
  webBubbleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  webBubbleContentMobile: {
    flexDirection: 'row' as any,
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  webBubbleText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'left' as any,
  },
  webBubbleTextMobile: {
    fontSize: 13,
    textAlign: 'left' as any,
    flexShrink: 0,
  },
  webBubbleIconWrapper: {
    flexShrink: 0,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBubbleIconWrapperMobile: {
    width: 18,
    height: 18,
  },
  webBubbleClose: {
    padding: 4,
    borderRadius: 4,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBubbleCloseMobile: {
    padding: 4,
    minWidth: 22,
    minHeight: 22,
  },
  webBubbleCloseIconWrapper: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  webBubbleCloseIconWrapperMobile: {
    width: 14,
    height: 14,
  },
});

export default PremiumPaymentModal;
