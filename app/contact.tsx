import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WORKER_URL } from '../constants/Config';
import { useAuth } from '../contexts/AuthContext';

const MAX_MESSAGE_LENGTH = 1000;

export default function Contact() {
  const { user, loading: authLoading } = useAuth();
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/login');
    }
  }, [user, authLoading]);

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to send a message');
      return;
    }

    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      Alert.alert('Error', `Message must be ${MAX_MESSAGE_LENGTH} characters or less`);
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem('@calcai_session_token');

      if (!token) {
        Alert.alert('Error', 'Session expired. Please log in again.');
        router.replace('/auth/login');
        return;
      }

      const response = await fetch(`${WORKER_URL}/contact/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      Alert.alert(
        'Success',
        `Thank you, ${user.name}!\n\nWe will answer at ${user.email} within 48-72 hours.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );

      setMessage('');
    } catch (error: any) {
      console.error('Contact form error:', error);
      Alert.alert('Error', error.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
        </View>
      </SafeAreaView>
    );
  }

  // Don't render if not logged in (will redirect)
  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons
            name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Us</Text>
        <TouchableOpacity
          style={styles.sendButtonHeader}
          onPress={handleSubmit}
          disabled={!message.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#0066cc" />
          ) : (
            <Text
              style={[
                styles.sendButtonText,
                (!message.trim() || isSubmitting) && styles.sendButtonTextDisabled,
              ]}
            >
              Send
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <TextInput
          style={styles.messageInput}
          placeholder="Type your message here..."
          placeholderTextColor="#666"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          textAlignVertical="top"
          autoFocus
        />
        <View style={styles.charCounterContainer}>
          <Text style={styles.charCounter}>
            {message.length}/{MAX_MESSAGE_LENGTH}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  sendButtonHeader: {
    padding: 8,
    marginRight: -8,
  },
  sendButtonText: {
    color: '#0066cc',
    fontSize: 17,
    fontWeight: '600',
  },
  sendButtonTextDisabled: {
    color: '#666',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
    position: 'relative',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#121212',
    color: '#fff',
    fontSize: 16,
    padding: 20,
    paddingBottom: 60,
    lineHeight: 24,
  },
  charCounterContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  charCounter: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
});
