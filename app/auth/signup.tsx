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
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const { signUp, authError } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (authError && authError !== "Please check your email to verify your account.") {
        Alert.alert(t('auth.error'), authError);
    }
  }, [authError]);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert(t('auth.error'), t('auth.fillAllFields'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert(t('auth.error'), t('auth.validEmailRequired'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('auth.error'), t('auth.passwordsDoNotMatch'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('auth.error'), t('auth.passwordMinLength'));
      return;
    }

    setLocalLoading(true);
    console.log("Attempting sign up...");
    const { error, session, user } = await signUp(email);
    setLocalLoading(false);

    if (error) {
      console.error("Sign up failed:", error.message);
    } else if (!session && user) {
       Alert.alert(
         t('auth.signUpPending'),
         t('auth.checkEmailVerification'),
         [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
       );
    } else if (session) {
      console.log("Sign up successful, session created.");
    }
  };

  const navigateToLogin = () => {
    router.push('/auth/login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.formContainer}>
        <View style={styles.headerContainer}>
          <MaterialIcons name="calculate" size={60} color="#fff" />
          <Text style={styles.title}>{t('auth.calculatorApp')}</Text>
          <Text style={styles.subtitle}>{t('auth.createNewAccount')}</Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={t('forms.email')}
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder={t('forms.passwordMinChars')}
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder={t('forms.confirmPassword')}
            placeholderTextColor="#666"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleSignUp}
          disabled={localLoading}
        >
          {localLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t('auth.signUp')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footerContainer}>
          <TouchableOpacity onPress={navigateToLogin}>
            <Text style={styles.loginText}>{t('auth.alreadyHaveAccount')}</Text>
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
  loginText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
});
