import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import GoogleLogo from '../components/GoogleLogo';

export default function LoginScreen() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signInWithGoogle, authError } = useAuth();

  useEffect(() => {
    if (authError) {
      Alert.alert('Error', authError);
    }
  }, [authError]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    console.log("Attempting Google Sign-In...");
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
          <Image 
            source={require('../../assets/images/LOGO.png')} 
            style={styles.logo}
          />
          <Text style={styles.betaText}>BETA</Text>
        </View>

        <View style={styles.headerContainer}>
          <Text style={styles.subtitle}>Sign in to experience the future of calculation</Text>
        </View>

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleLogin}
          disabled={googleLoading}
          activeOpacity={0.8}
        >
          <View style={styles.googleButtonContentWrapper}>
            {googleLoading ? (
              <ActivityIndicator color="#4285F4" style={{marginRight: 12}} />
            ) : (
              <View style={styles.googleButtonIcon}>
                <GoogleLogo size={20} />
              </View>
            )}
            <Text style={styles.googleButtonContents}>Sign in with Google</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.privacyPolicyContainer}
          onPress={() => Linking.openURL('https://example.com/privacy')}
        >
          <Text style={styles.privacyPolicyText}>Privacy Policy</Text>
        </TouchableOpacity>

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
    backgroundColor: '#0066cc',
    color: '#fff',
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
  privacyPolicyContainer: {
    marginTop: 20, 
    alignItems: 'center', 
  },
  privacyPolicyText: {
    fontSize: 12,
    color: '#AEAEB2', 
    textDecorationLine: 'underline',
  },
});
