import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import GoogleLogo from '../_components/GoogleLogo';

export default function Login() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signInWithGoogle, authError } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (authError) {
      Alert.alert(t('auth.error'), authError);
    }
  }, [authError, t]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    await signInWithGoogle();
    setGoogleLoading(false);
    // Let useProtectedRoute handle navigation after successful login
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.formContainer}>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/images/LOGO.webp')} style={styles.logo} />
          <Text style={styles.betaText}>BETA</Text>
        </View>

        <View style={styles.headerContainer}>
          <Text style={styles.subtitle}>{t('auth.signInSubtitle')}</Text>
        </View>

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleLogin}
          disabled={googleLoading}
          activeOpacity={0.8}
        >
          <View style={styles.googleButtonContentWrapper}>
            {googleLoading ? (
              <ActivityIndicator color="#4285F4" style={{ marginRight: 12 }} />
            ) : (
              <View style={styles.googleButtonIcon}>
                <GoogleLogo size={20} />
              </View>
            )}
            <Text style={styles.googleButtonContents}>{t('auth.continueWithGoogle')}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.legalLinksContainer}>
          <TouchableOpacity onPress={() => router.push('/privacy')}>
            <Text style={styles.legalLinkText}>{t('common.privacyPolicy')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalLinkSeparator}> • </Text>
          <TouchableOpacity onPress={() => router.push('/terms')}>
            <Text style={styles.legalLinkText}>{t('common.termsOfService')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 30,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 80,
    resizeMode: 'contain',
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
    alignSelf: 'center',
  },
  betaText: {
    position: 'absolute',
    top: 10,
    right: -42,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff9500',
    color: '#ff9500',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 18,
    color: '#AEAEB2',
    marginTop: 5,
    fontWeight: '400',
    textAlign: 'center',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#747775',
    borderRadius: 20,
    height: 40,
    padding: 0,
    paddingHorizontal: 12,
    marginBottom: 20,
    marginTop: 20,
    position: 'relative',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  googleButtonContentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  googleButtonIcon: {
    height: 20,
    width: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonContents: {
    fontWeight: '500',
    fontSize: 14,
    color: '#1f1f1f',
    letterSpacing: 0.25,
  },
  legalLinksContainer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalLinkText: {
    fontSize: 12,
    color: '#AEAEB2',
    textDecorationLine: 'underline',
  },
  legalLinkSeparator: {
    fontSize: 12,
    color: '#AEAEB2',
    marginHorizontal: 8,
  },
});
