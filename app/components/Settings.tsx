import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Switch,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Platform,
  Modal,
  ScrollView,
  StatusBar,
  Alert,
  Settings,
  Image,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import GoogleLogo from '../components/GoogleLogo';
// import { router } from 'expo-router'; // Keep commented if not needed for direct nav

interface BulkDataItem {
  id: string | number;
  timestamp: number;
  data: string;
}

interface WebhookItem {
  url: string;
  active: boolean;
  title?: string;
}

interface WebhookSettingsProps {
  visible: boolean;
  onClose: () => void;
  webhookUrls: WebhookItem[];
  newWebhookUrl: string;
  setNewWebhookUrl: (url: string) => void;
  newWebhookTitle: string;
  setNewWebhookTitle: (title: string) => void;
  handleAddWebhook: () => void;
  handleDeleteWebhook: (url: string) => void;
  handleToggleWebhook: (url: string, active: boolean) => void;
  sendEquation: boolean;
  setSendEquation: (value: boolean) => void;
  streamResults: boolean;
  setStreamResults: (value: boolean) => void;
  bulkData: BulkDataItem[];
  setBulkData: (data: BulkDataItem[]) => void;
  clearBulkData: () => void;
  isSendingBulk: boolean;
  handleSendBulkData: () => void;
  setWebhookUrls?: (urls: WebhookItem[]) => void;
  enterKeyNewLine?: boolean;
  setEnterKeyNewLine?: (value: boolean) => void;
  isSpeechMuted?: boolean;
  toggleSpeechMute?: () => void;
  vibrationEnabled?: boolean;
  setVibrationEnabled?: (value: boolean) => void;
  openInCalcMode?: boolean;
  setOpenInCalcMode?: (value: boolean) => void;
}

const WebhookSettings: React.FC<WebhookSettingsProps> = ({
  visible,
  onClose,
  webhookUrls,
  newWebhookUrl,
  setNewWebhookUrl,
  newWebhookTitle,
  setNewWebhookTitle,
  handleAddWebhook,
  handleDeleteWebhook,
  handleToggleWebhook,
  sendEquation,
  setSendEquation,
  streamResults,
  setStreamResults,
  bulkData,
  setBulkData,
  clearBulkData,
  isSendingBulk,
  handleSendBulkData,
  setWebhookUrls,
  enterKeyNewLine = false,
  setEnterKeyNewLine,
  isSpeechMuted = false,
  toggleSpeechMute,
  vibrationEnabled = false,
  setVibrationEnabled,
  openInCalcMode = false,
  setOpenInCalcMode,
}) => {
  const { user, loading, signOut, authError, signIn, signInWithGoogle, verifyOtp } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [lastAttemptedAction, setLastAttemptedAction] = useState<(() => void) | null>(null);
  const [localWebhookUrls, setLocalWebhookUrls] = useState<WebhookItem[]>(webhookUrls || []);
  const [localWebhookTitle, setLocalWebhookTitle] = useState<string>(newWebhookTitle || '');
  const [localWebhookUrl, setLocalWebhookUrl] = useState<string>(newWebhookUrl || '');
  const [editingWebhookUrl, setEditingWebhookUrl] = useState<string | null>(null);
  const [editingWebhookValue, setEditingWebhookValue] = useState<string>('');
  const [editingWebhookTitle, setEditingWebhookTitle] = useState<string>('');
  
  // Auth state
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Auth error display
  useEffect(() => {
    if (authError) {
      Alert.alert('Auth Error', authError);
    }
  }, [authError]);
  
  // Sync local webhooks with parent component webhooks
  useEffect(() => {
    setLocalWebhookUrls(webhookUrls);
  }, [webhookUrls]);
  
  // Component state
  const [editingItemId, setEditingItemId] = useState<string | number | null>(null);
  const [editingItemValue, setEditingItemValue] = useState('');
  const [sendingItemId, setSendingItemId] = useState<string | number | null>(null);
  const [optionsOpen, setOptionsOpen] = useState<boolean>(false);
  const [webhookTitleOpen, setWebhookTitleOpen] = useState<boolean>(false);
  const [authSectionOpen, setAuthSectionOpen] = useState<boolean>(!user); // Only open for non-logged in users
  
  // Sync local state with parent component
  useEffect(() => {
    setLocalWebhookTitle(newWebhookTitle);
  }, [newWebhookTitle]);
  
  useEffect(() => {
    setLocalWebhookUrl(newWebhookUrl);
  }, [newWebhookUrl]);
  
  // Use the real signOut handler from context
  const handleSignOut = async () => {
    try {
      await signOut(); // Use context signOut
      onClose(); // Close the modal first
      // No need to redirect here, _layout protection will handle it
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign out');
    }
  };
  
  // Local webhook state update handlers
  const updateLocalWebhookTitle = (text: string) => {
    setLocalWebhookTitle(text);
    if (setNewWebhookTitle) {
      setNewWebhookTitle(text);
    }
  };
  
  const updateLocalWebhookUrl = (text: string) => {
    setLocalWebhookUrl(text);
    if (setNewWebhookUrl) {
      setNewWebhookUrl(text);
    }
  };
  
  // Wrap actions that need auth
  const requireAuth = (action: () => void) => {
    if (!user) {
      setLastAttemptedAction(() => action);
      setShowLoginModal(true);
      return;
    }
    action();
  };

  // Helper function to sanitize user input
  const sanitizeInput = (input: string): string => {
    if (!input) return '';
    
    // Remove any HTML/script tags
    let sanitized = input.replace(/<[^>]*>/g, '');
    
    // Encode special characters
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
      
    // Limit the length to prevent DoS
    return sanitized.substring(0, 500);
  };

  // Helper function to validate webhook URLs
  const validateWebhookUrl = (url: string): string | null => {
    try {
      // Basic URL validation
      if (!url || typeof url !== 'string') return null;
      
      const trimmedUrl = url.trim();
      
      // Must start with http:// or https://
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) return null;
      
      // Create URL object to validate and parse
      const parsedUrl = new URL(trimmedUrl);
      
      // Check for valid protocol (extra safety)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null;
      
      return trimmedUrl;
    } catch (e) {
      // If URL parsing fails, return null
      return null;
    }
  };

  const handleAddWebhookLocal = () => {
    requireAuth(() => {
      // Sanitize inputs
      const sanitizedTitle = sanitizeInput(localWebhookTitle);
      const validatedUrl = validateWebhookUrl(localWebhookUrl);
      
      if (!validatedUrl) {
        Alert.alert("Invalid URL", "Webhook URL must be a valid URL starting with http:// or https://");
        return;
      }
      
      const urlExists = localWebhookUrls.some(webhook => webhook.url === validatedUrl);
      
      if (validatedUrl && !urlExists) {
        // Add new webhook with active state set to true and include title if provided
        const newWebhook = { 
          url: validatedUrl, 
          active: true,
          title: sanitizedTitle || undefined // Only include title if it's not empty
        };
        
        const updatedWebhooks = [...localWebhookUrls, newWebhook];
        setLocalWebhookUrls(updatedWebhooks);
        
        // Update parent state if setter provided
        if (setWebhookUrls) {
          setWebhookUrls(updatedWebhooks);
        }
        
        // Save to AsyncStorage
        AsyncStorage.setItem('webhookUrls', JSON.stringify(updatedWebhooks))
          .catch(error => {
            console.error('Error saving webhooks:', error);
          });
        
        // Clear input fields
        setLocalWebhookUrl('');
        updateLocalWebhookUrl('');
        setLocalWebhookTitle('');
        updateLocalWebhookTitle('');
        
        // Close dropdown if it's open
        setWebhookTitleOpen(false);
      } else if (urlExists) {
        Alert.alert("Duplicate", "This URL is already added.");
      }
    });
  };
  
  const handleToggleWebhookWrapped = (url: string, active: boolean) => {
    requireAuth(() => handleToggleWebhook(url, active));
  };
  
  const handleDeleteWebhookWrapped = (url: string) => {
    requireAuth(() => handleDeleteWebhook(url));
  };
  
  const handleSendSingleItemWrapped = (item: BulkDataItem) => {
    requireAuth(() => handleSendSingleItem(item));
  };
  
  const handleSendBulkDataWrapped = () => {
    requireAuth(() => handleSendBulkData());
  };
  
  const clearBulkDataWrapped = () => {
    requireAuth(() => clearBulkData());
  };

  // Auth handlers
  const handleEmailLogin = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (otpSent && !otp) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    setIsLoading(true);
    
    if (otpSent) {
      const { error } = await verifyOtp(email, otp);
      if (!error) {
        setShowLoginModal(false);
        if (lastAttemptedAction) {
          lastAttemptedAction();
          setLastAttemptedAction(null);
        }
      }
    } else {
      const { error } = await signIn(email);
      if (!error) {
        setOtpSent(true);
      }
    }
    
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);
    if (!error) {
      setShowLoginModal(false);
      if (lastAttemptedAction) {
        lastAttemptedAction();
        setLastAttemptedAction(null);
      }
    } else {
      Alert.alert('Error', error.message);
    }
  };

  // Login Modal Component
  const LoginModal = () => {
    const [email, setEmail] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleEmailLogin = async () => {
      if (!email) {
        Alert.alert('Error', 'Please enter your email');
        return;
      }

      if (otpSent && !otp) {
        Alert.alert('Error', 'Please enter the verification code');
        return;
      }

      setIsLoading(true);
      
      if (otpSent) {
        const { error } = await verifyOtp(email, otp);
        if (!error) {
          setShowLoginModal(false);
          if (lastAttemptedAction) {
            lastAttemptedAction();
            setLastAttemptedAction(null);
          }
        }
      } else {
        const { error } = await signIn(email);
        if (!error) {
          setOtpSent(true);
        }
      }
      
      setIsLoading(false);
    };

    const handleGoogleLogin = async () => {
      setIsLoading(true);
      const { error } = await signInWithGoogle();
      setIsLoading(false);
      if (!error) {
        setShowLoginModal(false);
        if (lastAttemptedAction) {
          lastAttemptedAction();
          setLastAttemptedAction(null);
        }
      } else {
        Alert.alert('Error', error.message);
      }
    };

    return (
      <Modal
        visible={showLoginModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLoginModal(false)}
      >
        <View style={styles.loginModalOverlay}>
          <View style={styles.loginModalContent}>
            <View style={styles.loginModalHeader}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/images/LOGO.png')} 
                  style={{ width: 180, height: 72, marginBottom: 20, resizeMode: 'contain' }} 
                />
                <Text style={styles.betaText}>BETA</Text>
              </View>
              <Text style={styles.loginModalTitle}>Sign in to continue</Text>
              <TouchableOpacity 
                style={styles.loginModalClose}
                onPress={() => setShowLoginModal(false)}
              >
                <MaterialIcons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={styles.loginInputContainer}>
              <TouchableOpacity 
                style={styles.googleButton}
                onPress={handleGoogleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#0066cc" />
                ) : (
                  <>
                    <GoogleLogo size={20} />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.loginSeparator}>
                <View style={styles.loginSeparatorLine} />
                <Text style={styles.loginSeparatorText}>or</Text>
                <View style={styles.loginSeparatorLine} />
              </View>

              <TextInput
                style={styles.loginInput}
                placeholder="Enter your email"
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
                    style={styles.loginInput}
                    placeholder="Enter verification code"
                    placeholderTextColor="#666"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                  />
                </>
              )}
              <TouchableOpacity 
                style={styles.loginButton}
                onPress={handleEmailLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>
                    {otpSent ? 'Verify Code' : 'Continue with Email'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const startEditingWebhook = (url: string) => {
    setEditingWebhookUrl(url);
    setEditingWebhookValue(url);
    const found = localWebhookUrls.find(w => w.url === url);
    setEditingWebhookTitle(found?.title || '');
  };

  const cancelEditingWebhook = () => {
    setEditingWebhookUrl(null);
    setEditingWebhookValue('');
    setEditingWebhookTitle('');
  };

  const saveEditedWebhook = async (oldUrl: string) => {
    const sanitizedTitle = sanitizeInput(editingWebhookTitle);
    const validatedUrl = validateWebhookUrl(editingWebhookValue);
    
    if (!validatedUrl) {
      Alert.alert('Invalid URL', 'Please enter a valid URL that starts with http:// or https://');
      return;
    }
    
    if (
      localWebhookUrls.some(
        (w) => w.url === validatedUrl && w.url !== oldUrl
      )
    ) {
      Alert.alert('Duplicate URL', 'This webhook URL already exists.');
      return;
    }
    
    const updated = localWebhookUrls.map((w) =>
      w.url === oldUrl ? { 
        ...w, 
        url: validatedUrl, 
        title: sanitizedTitle 
      } : w
    );
    
    try {
      await AsyncStorage.setItem('webhookUrls', JSON.stringify(updated));
      
      // Update local state
      setLocalWebhookUrls(updated);
      
      // Call the parent handler to update state
      if (setWebhookUrls) {
        setWebhookUrls(updated);
      }
      
      // Reset editing state
      setEditingWebhookUrl(null);
      setEditingWebhookValue('');
      setEditingWebhookTitle('');
      
      Alert.alert('Success', 'Webhook updated successfully!');
    } catch (e) {
      Alert.alert('Save Error', 'Could not save the webhook URL.');
    }
  };

  // Function to handle sending an individual bulk data item
  const handleSendSingleItem = async (item: BulkDataItem) => {
    const activeWebhooks = webhookUrls.filter(webhook => webhook.active);
    
    if (activeWebhooks.length === 0) {
      Alert.alert("No Active URLs", "Please activate at least one webhook URL.");
      return;
    }
    
    setSendingItemId(item.id);
    
    try {
      // Create an array of promises for each active webhook URL
      const promises = activeWebhooks.map(webhook => {
        return axios.post(webhook.url, { data: item.data }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        });
      });
      
      // Wait for all promises to resolve
      const results = await Promise.allSettled(promises);
      
      // Count successes and failures
      const successes = results.filter(result => result.status === 'fulfilled').length;
      const failures = results.filter(result => result.status === 'rejected').length;
      
      // Show result to user
      Alert.alert(
        "Send Complete",
        `Successfully sent to ${successes} endpoint${successes !== 1 ? 's' : ''}.
${failures > 0 ? `Failed to send to ${failures} endpoint${failures !== 1 ? 's' : ''}.` : ''}`
      );
      
    } catch (error: unknown) {
      Alert.alert("Send Error", "An error occurred while sending the data.");
    } finally {
      setSendingItemId(null);
    }
  };
  
  // Function to handle editing a bulk data item
  const startEditingItem = (item: BulkDataItem) => {
    setEditingItemId(item.id);
    setEditingItemValue(item.data);
  };
  
  // Function to save edited bulk data item
  const saveEditedItem = (itemId: string | number) => {
    const updatedBulkData = bulkData.map(item => 
      item.id === itemId ? { ...item, data: editingItemValue } : item
    );
    
    AsyncStorage.setItem('bulkData', JSON.stringify(updatedBulkData))
      .then(() => {
        setEditingItemId(null);
        setEditingItemValue('');
        setBulkData(updatedBulkData);
      })
      .catch(() => {
        Alert.alert("Save Error", "An error occurred while saving the edited data.");
      });
  };
  
  // Function to delete a bulk data item
  const deleteBulkItem = (itemId: string | number) => {
    const updatedBulkData = bulkData.filter(item => item.id !== itemId);
    
    AsyncStorage.setItem('bulkData', JSON.stringify(updatedBulkData))
      .then(() => {
        setBulkData(updatedBulkData);
      })
      .catch(() => {
        Alert.alert("Delete Error", "An error occurred while deleting the item.");
      });
  };
  
  // Function to cancel editing
  const cancelEditing = () => {
    setEditingItemId(null);
    setEditingItemValue('');
  };

  const ScrollViewContent = (
    <ScrollView style={styles.scrollableArea} contentContainerStyle={styles.contentContainer}>
          {/* Settings Section */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 }}
              onPress={() => setOptionsOpen((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="settings" size={20} color="#888" style={{ marginRight: 8 }} />
                <Text style={styles.subHeader}>General</Text>
              </View>
              <View style={{ flex: 1 }} />
              <MaterialIcons
                name={optionsOpen ? 'expand-less' : 'expand-more'}
                size={24}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
            {optionsOpen && (
              <View>
                <View style={styles.optionsDropdownMenu}>
                  <Text style={[styles.settingLabel, { color: '#888', fontSize: 14, marginBottom: 8 }]}>Input Behavior</Text>
                  <View style={styles.settingRowCompact}>
                    <Text style={styles.settingLabel}>Mute Voice Output (M)</Text>
                    <Switch
                      value={isSpeechMuted}
                      onValueChange={() => requireAuth(() => toggleSpeechMute?.())}
                      trackColor={{ false: "#333", true: "#0066cc" }}
                      thumbColor={isSpeechMuted ? "#0066cc" : "#f4f3f4"}
                    />
                  </View>
                  <View style={styles.settingRowCompact}>
                    <Text style={styles.settingLabel}>New Line on Send</Text>
                    <Switch
                      value={enterKeyNewLine}
                      onValueChange={v => requireAuth(() => setEnterKeyNewLine?.(v))}
                      trackColor={{ false: "#333", true: "#0066cc" }}
                      thumbColor={enterKeyNewLine ? "#0066cc" : "#f4f3f4"}
                    />
                  </View>
                  {Platform.OS !== 'web' && (
                    <View style={styles.settingRowCompact}>
                      <Text style={styles.settingLabel}>Enable Vibration</Text>
                      <Switch
                        value={vibrationEnabled}
                        onValueChange={v => requireAuth(() => setVibrationEnabled?.(v))}
                        trackColor={{ false: "#333", true: "#0066cc" }}
                        thumbColor={vibrationEnabled ? "#0066cc" : "#f4f3f4"}
                      />
                    </View>
                  )}
                  {Platform.OS !== 'web' && (
                    <View style={styles.settingRowCompact}>
                      <Text style={styles.settingLabel}>Open in Calculator Mode</Text>
                      <Switch
                        value={openInCalcMode}
                        onValueChange={v => requireAuth(() => setOpenInCalcMode?.(v))}
                        trackColor={{ false: "#333", true: "#0066cc" }}
                        thumbColor={openInCalcMode ? "#0066cc" : "#f4f3f4"}
                      />
                    </View>
                  )}
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#333' }}>
                    <Text style={[styles.settingLabel, { color: '#888', fontSize: 14, marginBottom: 8 }]}>Webhooks</Text>
                  </View>
                  <View style={styles.settingRowCompact}>
                    <Text style={styles.settingLabel}>Send Answer Without Equation</Text>
                    <Switch
                      value={!sendEquation}
                      onValueChange={v => requireAuth(() => setSendEquation(!v))}
                      trackColor={{ false: "#333", true: "#0066cc" }}
                      thumbColor={!sendEquation ? "#0066cc" : "#f4f3f4"}
                    />
                  </View>
                  <View style={styles.settingRowCompact}>
                    <Text style={styles.settingLabel}>Queue Results for Manual Sending</Text>
                    <Switch
                      value={!streamResults}
                      onValueChange={v => requireAuth(() => setStreamResults(!v))}
                      trackColor={{ false: "#333", true: "#0066cc" }}
                      thumbColor={!streamResults ? "#0066cc" : "#f4f3f4"}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
          
          {/* Webhook Section */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 }}
              onPress={() => setWebhookTitleOpen((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="webhook" size={20} color="#888" style={{ marginRight: 8 }} />
                <Text style={styles.subHeader}>Webhooks</Text>
              </View>
              <View style={{ flex: 1 }} />
              <MaterialIcons
                name={webhookTitleOpen ? 'expand-less' : 'expand-more'}
                size={24}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
            
            {webhookTitleOpen && (
              <View>
                <View>
                  <Text style={styles.sectionSubtitle}>Create a new webhook</Text>
                  <View style={[styles.addWebhookContainer, styles.sectionPadding]}>
                    <TextInput
                      style={styles.webhookInput}
                      placeholder="Enter webhook title (optional)"
                      placeholderTextColor="#888"
                      value={localWebhookTitle}
                      onChangeText={updateLocalWebhookTitle}
                      autoCapitalize="sentences"
                    />
                    <TextInput
                      style={styles.webhookInput}
                      placeholder="Enter webhook URL (http:// or https://)..."
                      placeholderTextColor="#888"
                      value={localWebhookUrl}
                      onChangeText={updateLocalWebhookUrl}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                    <TouchableOpacity
                      style={[styles.addButton, !/^https?:\/\//.test(localWebhookUrl.trim()) && styles.addButtonDisabled]}
                      onPress={handleAddWebhookLocal}
                      disabled={!/^https?:\/\//.test(localWebhookUrl.trim())}
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.sectionDivider} />
                  
                  <Text style={[styles.sectionSubtitle, styles.sectionTopMargin]}>My webhooks</Text>
                  {localWebhookUrls.length > 0 ? (
                    <View style={styles.webhookList}>
                      {localWebhookUrls.map((item) => (
                        <View key={item.url} style={[styles.webhookItem, styles.sectionPadding]}>
                          <Text style={styles.webhookUrlText} numberOfLines={1} ellipsizeMode="middle">
                            {item.title ? item.title : item.url}
                          </Text>
                          <View style={styles.webhookItemControls}>
                            <Switch
                              value={item.active}
                              onValueChange={(value) => {
                                handleToggleWebhookWrapped(item.url, value);
                                const updated = localWebhookUrls.map(webhook => 
                                  webhook.url === item.url ? { ...webhook, active: value } : webhook
                                );
                                setLocalWebhookUrls(updated);
                              }}
                              trackColor={{ false: "#333", true: "#0066cc" }}
                              thumbColor={item.active ? "#0066cc" : "#f4f3f4"}
                              style={styles.webhookSwitch}
                            />
                            <TouchableOpacity
                              onPress={() => startEditingWebhook(item.url)}
                              style={styles.editButton}
                            >
                              <MaterialIcons name="edit" size={20} color="#888888" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                handleDeleteWebhookWrapped(item.url);
                                const updated = localWebhookUrls.filter(webhook => webhook.url !== item.url);
                                setLocalWebhookUrls(updated);
                              }}
                              style={styles.deleteButton}
                            >
                              <MaterialIcons name="close" size={20} color="#888888" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyListText}>No webhooks added yet</Text>
                  )}
                </View>
              </View>
            )}
          </View>
          
          {/* Bulk Send Button and Data Display */}
          {bulkData.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.bulkHeaderContainer}>
                <Text style={styles.subHeader}>Bulk Data ({bulkData.length} items)</Text>
                <TouchableOpacity 
                  onPress={clearBulkDataWrapped} 
                  style={styles.deleteAllButton} 
                  disabled={isSendingBulk} 
                >
                  <Text style={[styles.deleteAllButtonText, isSendingBulk && styles.disabledText]}>Delete All</Text> 
                </TouchableOpacity>
              </View>
              
              {/* Display the bulk data items with edit/delete/send controls */}
              <View style={styles.bulkDataContainer}>
                {bulkData.map((item, index) => (
                  <View key={item.id} style={styles.bulkDataItem}>
                    <Text style={styles.bulkDataIndex}>{index + 1}.</Text>
                    <View style={{ flex: 1 }}>
                      {editingItemId === item.id ? (
                        // Editing mode
                        <View style={styles.editItemContainer}>
                          <TextInput
                            style={styles.editItemInput}
                            value={editingItemValue}
                            onChangeText={setEditingItemValue}
                            autoFocus
                          />
                          <TouchableOpacity 
                            style={[styles.editButton, styles.saveButton]}
                            onPress={() => saveEditedItem(item.id)}
                          >
                            <MaterialIcons name="check" size={18} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.editButton, styles.cancelButton]}
                            onPress={cancelEditing}
                          >
                            <MaterialIcons name="close" size={18} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        // Display mode with actions
                        <View style={styles.bulkItemWithActions}>
                          <View style={styles.bulkDataContentContainer}>
                            <Text style={styles.bulkDataContent} numberOfLines={1} ellipsizeMode="tail">
                              {item.data}
                            </Text>
                          </View>
                          <View style={styles.bulkItemActions}>
                            <TouchableOpacity 
                              style={styles.bulkItemAction}
                              onPress={() => startEditingItem(item)}
                            >
                              <MaterialIcons name="edit" size={18} color="#ccc" />
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={styles.bulkItemAction}
                              onPress={() => handleSendSingleItemWrapped(item)}
                              disabled={sendingItemId === item.id || localWebhookUrls.filter(webhook => webhook.active).length === 0}
                            >
                              {sendingItemId === item.id ? (
                                <ActivityIndicator size="small" color="#0066cc" />
                              ) : (
                                <MaterialIcons 
                                  name="send" 
                                  size={18} 
                                  color={localWebhookUrls.filter(webhook => webhook.active).length > 0 ? "#0066cc" : "#666"} 
                                />
                              )}
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={styles.bulkItemAction}
                              onPress={() => deleteBulkItem(item.id)}
                            >
                              <MaterialIcons name="close" size={18} color="#888888" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
              
              <TouchableOpacity
                style={[
                  styles.bulkSendButton,
                  (bulkData.length === 0 || localWebhookUrls.filter(webhook => webhook.active).length === 0 || isSendingBulk) && styles.disabledButton
                ]}
                onPress={handleSendBulkDataWrapped}
                disabled={bulkData.length === 0 || localWebhookUrls.filter(webhook => webhook.active).length === 0 || isSendingBulk}
              >
                <MaterialIcons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.bulkSendText}>
                  {isSendingBulk ? "Sending..." : `Send ${bulkData.length} Item${bulkData.length !== 1 ? 's' : ''}`}
                </Text>
                {isSendingBulk && <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 10 }} />}
              </TouchableOpacity>
              {localWebhookUrls.filter(webhook => webhook.active).length === 0 && bulkData.length > 0 && !isSendingBulk && (
                <Text style={styles.warningText}>Activate at least one webhook to enable sending</Text>
              )}
            </View>
          )}
          
          {/* Authentication Section */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 }}
              onPress={() => setAuthSectionOpen((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {user ? (
                  user.user_metadata?.avatar_url ? (
                    <Image 
                      source={{ uri: user.user_metadata.avatar_url }} 
                      style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                    />
                  ) : (
                    <MaterialIcons name="account-circle" size={40} color="#888" style={{ marginRight: 12 }} />
                  )
                ) : (
                  <Image 
                    source={require('../../assets/images/cat.webp')} 
                    style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                  />
                )}
                <View>
                  <Text style={[styles.subHeader, { fontSize: 18, marginBottom: 2, fontWeight: 'bold', color: '#fff' }]}>
                    {user ? (user.user_metadata?.full_name || 'User') : 'Anonymous Cat'}
                  </Text>
                  <Text style={[styles.userSubtitle, { fontSize: 14, color: '#888' }]}>
                    {user ? user.email : 'Guest User'}
                  </Text>
                </View>
              </View>
              <MaterialIcons
                name={authSectionOpen ? 'expand-less' : 'expand-more'}
                size={24}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
            
            {authSectionOpen && (
              <View>
                <View style={styles.optionsDropdownMenu}>
                   {/* Use actual user state */}
                  {user ? ( 
                    <View style={styles.authContainer}>
                      <TouchableOpacity
                        style={styles.signOutButton}
                        onPress={handleSignOut}
                      >
                        <MaterialIcons name="logout" size={18} color="#FF3B30" style={{ marginRight: 8 }} />
                        <Text style={styles.signOutButtonText}>Sign Out</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.authContainer}>
                      <View style={styles.promoContainer}>
                        <View style={styles.logoContainer}>
                          <Image 
                            source={require('../../assets/images/LOGO.png')} 
                            style={{ width: 180, height: 72, marginBottom: 20, resizeMode: 'contain' }} 
                          />
                          <Text style={styles.betaText}>BETA</Text>
                        </View>
                        <Text style={styles.limitedTimeOffer}>First 100 Users Get Lifetime Access</Text>
                        <Text style={[styles.limitedTimeOffer, { color: '#e0e0e0' }]}>to Premium! - Sign up here </Text>
                        <View style={styles.promoFeatures}>
                          <Text style={styles.promoFeature}>
                            <MaterialIcons name="verified" size={16} color="#fff" /> Unlimited Calculations
                          </Text>
                          <Text style={styles.promoFeature}>
                            <MaterialIcons name="webhook" size={16} color="#fff" /> Webhook Integration
                          </Text>
                          <Text style={styles.promoFeature}>
                            <MaterialIcons name="history" size={16} color="#fff" /> History & Sync
                            <Text style={styles.comingSoon}> (soon)</Text>
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity 
                        style={styles.googleButton}
                        onPress={handleGoogleLogin}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <ActivityIndicator color="#0066cc" />
                        ) : (
                          <>
                            <GoogleLogo size={20} />
                            <Text style={styles.googleButtonText}>Continue with Google</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <View style={styles.loginSeparator}>
                        <View style={styles.loginSeparatorLine} />
                        <Text style={styles.loginSeparatorText}>or</Text>
                        <View style={styles.loginSeparatorLine} />
                      </View>

                      <TextInput
                        style={styles.authInput}
                        placeholder="Enter your email"
                        placeholderTextColor="#666"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        editable={!otpSent}
                      />
                      {otpSent && (
                        <TextInput
                          style={styles.authInput}
                          placeholder="Enter verification code"
                          placeholderTextColor="#666"
                          value={otp}
                          onChangeText={setOtp}
                          keyboardType="number-pad"
                        />
                      )}
                      <TouchableOpacity
                        style={styles.authButton}
                        onPress={handleEmailLogin}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.authButtonText}>
                            {otpSent ? 'Verify Code' : 'Continue with Email'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
  );
  
  const [mounted, setMounted] = useState(false);
  const [opacity] = useState(new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      setMounted(true);
    } else {
      setTimeout(() => setMounted(false), 200);
    }
  }, [visible]);

  if (!mounted && !visible) {
    return null;
  }

  return (
    <>
      <Modal
        visible={visible}
        animationType={Platform.OS === 'web' ? "none" : "slide"}
        transparent={false}
        onRequestClose={onClose}
      >
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="webhook" size={24} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>Settings</Text>
            </View>
            <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {ScrollViewContent}
        </SafeAreaView>
      </Modal>
      <LoginModal />
    </>
  );
};

const styles = StyleSheet.create({
  optionsDropdownMenu: {
    backgroundColor: '#181818',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 2,
    marginBottom: 6,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  settingRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingHorizontal: 0,
    borderBottomWidth: 0,
    marginBottom: 2,
    gap: 8,
  },
  addWebhookContainer: {
    marginTop: 12,
    marginBottom: 16,
    gap: 12,
    flexDirection: 'column',
    paddingHorizontal: 8,
  },
  webhookEditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  webhookEditInputsContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
    marginRight: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  scrollableArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 16,
  },
  sectionCard: {
    backgroundColor: '#18181a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webhookInput: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 12,
    borderRadius: 4,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  addButton: {
    backgroundColor: '#0066cc',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonDisabled: {
    backgroundColor: '#888',
    opacity: 0.7,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  subHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#888',
    marginBottom: 8,
    marginLeft: 16,
  },
  webhookList: {
    marginTop: 12,
    marginBottom: 8,
  },
  webhookItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    marginHorizontal: 4,
  },
  webhookItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webhookSwitch: {
    marginRight: 8,
  },
  webhookUrlText: {
    color: '#fff',
    flex: 1,
    marginRight: 12,
    fontSize: 15,
  },
  deleteButton: {
    padding: 4,
  },
  emptyListText: {
    color: '#fff',
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#111',
    borderRadius: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  settingLabel: {
    color: '#fff',
    fontSize: 15,
    flexShrink: 1,
    marginRight: 12,
  },
  bulkSendButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  bulkSendText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  bulkDataContainer: {
    marginVertical: 10,
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 10,
    maxHeight: 300,
    width: '100%',
  },
  bulkDataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    width: '100%',
  },
  bulkDataIndex: {
    color: '#fff',
    width: 25,
    fontSize: 14,
    textAlign: 'center',
    marginRight: 5,
  },
  bulkDataContentContainer: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  bulkDataContent: {
    color: '#eee',
    fontSize: 14,
  },
  bulkDataMore: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bulkItemWithActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bulkItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingLeft: 10,
  },
  bulkItemAction: {
    padding: 8,
    marginLeft: 5,
  },
  editItemContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editItemInput: {
    backgroundColor: '#333',
    color: '#fff',
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    flex: 1,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#0066cc',
  },
  cancelButton: {
    backgroundColor: '#444',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyBulkData: {
    color: '#fff',
    textAlign: 'center',
    padding: 10,
    fontStyle: 'italic',
  },
  warningText: {
    color: '#FFCC00',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  closeIcon: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  bulkHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deleteAllButton: {
    backgroundColor: '#FF3B30',
    padding: 5,
    borderRadius: 4,
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  deleteAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#666',
  },
  sectionPadding: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 16,
    marginHorizontal: 12,
  },
  sectionTopMargin: {
    marginTop: 8,
  },
  // Auth styles
  authContainer: {
    padding: 10,
  },
  authTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  authInput: {
    backgroundColor: '#1C1C1E',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 16,
  },
  authButton: {
    backgroundColor: '#0066cc',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  switchAuthModeButton: {
    alignItems: 'center',
    marginTop: 10,
  },
  switchAuthModeText: {
    color: '#0066cc',
    fontSize: 14,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#1C1C1E',
    padding: 12,
    borderRadius: 12,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfoContainer: {
    flex: 1,
  },
  emailText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userSubtitle: {
    color: '#888',
    fontSize: 14,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 10,
  },
  signOutButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  loginModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginModalContent: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  loginModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  loginModalTitle: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 12,
  },
  loginModalClose: {
    position: 'absolute',
    right: -12,
    top: -12,
    padding: 8,
  },
  loginInputContainer: {
    gap: 16,
  },
  loginInput: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 15,
    color: '#fff',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
  },
  loginSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  loginSeparatorText: {
    color: '#888',
    marginHorizontal: 10,
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  loginContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loginPromptText: {
    color: '#888',
    fontSize: 16,
    marginBottom: 16,
  },
  loginPromptButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginPromptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  otpMessage: {
    color: '#0066cc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  limitedTimeOffer: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  limitedTimeSubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  promoContainer: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#1C1C1E',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
      }
    }),
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
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(255, 215, 0, 0.1)',
      }
    }),
  },
  promoBadgeText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  promoFeatures: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 20,
  },
  promoFeature: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    opacity: 0.95,
  },
  comingSoon: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default WebhookSettings;