import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import GoogleLogo from '../components/GoogleLogo';

interface Benefit {
  icon: 'speed' | 'history' | 'webhook' | 'lightbulb';
  text: string;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, verifyOtp, signInWithGoogle, authError } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { width } = Dimensions.get('window');
  const contentWidth = width * 0.8; // 80% of screen width for text

  const benefits: Benefit[] = [
    { icon: 'lightbulb', text: 'You can use voice recognition to calculate 3x faster than traditional methods' },
    { icon: 'lightbulb', text: 'You can use magic history to never forget a calculation... Never' },
    { icon: 'lightbulb', text: 'You can use webhooks to send results where they matter, instantly' },
  ];

  useEffect(() => {
    if (authError) {
      Alert.alert('Error', authError);
    }
  }, [authError]);

  useEffect(() => {
    const animateNext = () => {
      // Start animation from current position
      slideAnim.setValue(0);
      
      // Animate slide out to left
      Animated.timing(slideAnim, {
        toValue: -contentWidth,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }).start(() => {
        // Update content and reset position
        setCurrentIndex((prev) => (prev + 1) % benefits.length);
        slideAnim.setValue(contentWidth);
        
        // Animate slide in from right
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }).start();
      });
    };

    const timer = setInterval(animateNext, 4000);
    return () => clearInterval(timer);
  }, [slideAnim, contentWidth, benefits.length]);

  const handleLogin = async () => {
    if (!email) {
      Alert.alert('Input Error', 'Please enter your email');
      return;
    }

    if (otpSent && !otp) {
      Alert.alert('Input Error', 'Please enter the verification code from your email');
      return;
    }

    setLocalLoading(true);
    
    if (otpSent) {
      // Verify OTP
      const { error } = await verifyOtp(email, otp);
      if (!error) {
        // OTP verified successfully, let useProtectedRoute handle navigation
        setOtp('');
        setOtpSent(false);
      }
    } else {
      // Send OTP
      const { error } = await signIn(email);
      if (!error) {
        setOtpSent(true);
      }
    }
    
    setLocalLoading(false);
  };

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

        <View style={styles.benefitsContainer}>
          <View style={styles.benefitsClipContainer}>
            <Animated.View 
              style={[
                styles.benefitItem,
                {
                  transform: [{ translateX: slideAnim }],
                  width: contentWidth,
                }
              ]}
            >
              <Text style={styles.benefitText}>
                {benefits[currentIndex].text}
              </Text>
            </Animated.View>
          </View>
        </View>

        <View style={styles.headerContainer}>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!otpSent}
          />
          {otpSent && (
            <>
              <Text style={styles.otpMessage}>Check your email for the verification code</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter verification code"
                placeholderTextColor="#666"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
              />
            </>
          )}
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={localLoading}
        >
          {localLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {otpSent ? 'Verify Code' : 'Send Login Link'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.separatorContainer}>
          <View style={styles.separator} />
          <Text style={styles.separatorText}>or</Text>
          <View style={styles.separator} />
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

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/auth/signup')}>
            <Text style={styles.signUpText}>Sign Up</Text>
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
    padding: 20,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 200,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 20,
    alignSelf: 'center',
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  betaText: {
    position: 'absolute',
    top: 10,
    right: -40,
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
    fontSize: 16,
    color: '#aaa',
    marginTop: 5,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#aaa',
    marginRight: 5,
  },
  signUpText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  // Google button styles
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#747775',
    borderRadius: 20,
    height: 40,
    padding: 0,
    paddingHorizontal: 12,
    marginBottom: 20,
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
  // Separator styles
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  separator: {
    flex: 1,
    height: 1,
    backgroundColor: '#DADCE0',
  },
  separatorText: {
    color: '#8E8E93',
    paddingHorizontal: 10,
    fontSize: 14,
  },
  otpMessage: {
    color: '#0066cc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  benefitsContainer: {
    height: 70,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  benefitsClipContainer: {
    width: '80%',
    alignItems: 'center',
    position: 'relative',
    minHeight: 70,
  },
  benefitItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
  },
  benefitText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.5,
    lineHeight: 22,
  },
});
