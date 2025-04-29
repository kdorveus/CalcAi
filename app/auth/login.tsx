import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import GoogleLogo from '../components/GoogleLogo';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signInWithGoogle, authError } = useAuth();

  useEffect(() => {
    if (authError) {
      Alert.alert('Error', authError);
    }
  }, [authError]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Input Error', 'Please enter both email and password');
      return;
    }
    setLocalLoading(true);
    console.log("Attempting email/password login...");
    await signIn(email, password);
    setLocalLoading(false);
  };

  const navigateToSignUp = () => {
    router.push('/auth/signup');
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    console.log("Attempting Google Sign-In...");
    await signInWithGoogle();
    setGoogleLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.formContainer}>
        <View style={styles.headerContainer}>
          <MaterialIcons name="calculate" size={60} color="#fff" />
          <Text style={styles.title}>CalcAI</Text>
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
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={localLoading}
        >
          {localLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
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
          <TouchableOpacity onPress={navigateToSignUp}>
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
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
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
});
