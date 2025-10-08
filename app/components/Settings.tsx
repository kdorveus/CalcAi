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
  Keyboard,
  StatusBar,
  Alert,
  Settings,
  Image,
  Animated,
  Linking,
} from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
// Using our bundled AppIcon component instead of MaterialCommunityIcons
import AppIcon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { usePremium } from '../../contexts/PremiumContext';
import GoogleLogo from '../components/GoogleLogo';
import PremiumPaymentModal from '../../components/PremiumPaymentModal';
import { router } from 'expo-router'; // Keep commented if not needed for direct nav
import { useTranslation } from '../../hooks/useTranslation';
import { SUPPORTED_LANGUAGES } from '../../constants/Languages';

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
  historyEnabled?: boolean;
  setHistoryEnabled?: (value: boolean) => void;
  continuousMode?: boolean;
  setContinuousMode?: (value: boolean) => void;
}

export const WebhookSettingsComponent: React.FC<WebhookSettingsProps> = ({
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
  historyEnabled = true,
  setHistoryEnabled,
  continuousMode = false,
  setContinuousMode,
}) => {
  const { user, loading, signOut, authError, signInWithGoogle } = useAuth();
  const { isPremium, checkPremiumStatus, premiumLoading } = usePremium();
  const { t, language, setLanguage } = useTranslation();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [lastAttemptedAction, setLastAttemptedAction] = useState<(() => void) | null>(null);
  const [localWebhookUrls, setLocalWebhookUrls] = useState<WebhookItem[]>(webhookUrls || []);
  const [localWebhookTitle, setLocalWebhookTitle] = useState<string>(newWebhookTitle || '');
  const [localWebhookUrl, setLocalWebhookUrl] = useState<string>(newWebhookUrl || '');
  const [editingWebhookUrl, setEditingWebhookUrl] = useState<string | null>(null);
  const [editingWebhookValue, setEditingWebhookValue] = useState<string>('');
  const [editingWebhookTitle, setEditingWebhookTitle] = useState<string>('');
  
  // Auth state
  const [isLoading, setIsLoading] = useState(false);

  // Auth error display
  useEffect(() => {
    if (authError) {
      Alert.alert(t('auth.authError'), authError);
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
  const [languageSectionOpen, setLanguageSectionOpen] = useState<boolean>(false);
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
      Alert.alert(t('auth.error'), error.message || t('auth.failedToSignOut'));
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
      handleGoogleLogin();
      return;
    }
    action();
  };

  // Wrap actions that need premium
  const requirePremium = async (action: () => void) => {
    // Check if user has premium
    const hasPremium = await checkPremiumStatus();
    if (!hasPremium) {
      setLastAttemptedAction(() => action);
      setShowPremiumModal(true);
      return;
    }
    
    // User has premium, execute the action
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
    requirePremium(async () => {
      // Sanitize inputs
      const sanitizedTitle = sanitizeInput(localWebhookTitle);
      const validatedUrl = validateWebhookUrl(localWebhookUrl);
      
      if (!validatedUrl) {
        Alert.alert(t('settings.webhooks.invalidUrl'), t('settings.webhooks.invalidUrlMessage'));
        return;
      }
      
      const urlExists = localWebhookUrls.some(webhook => webhook.url === validatedUrl);
      
      if (validatedUrl && !urlExists) {
        // Add new webhook with active state set to true and include title if provided
        const newWebhook = { 
          url: validatedUrl, 
          active: false,
          title: sanitizedTitle || undefined // Only include title if it's not empty
        };
        
        const updatedWebhooks = [...localWebhookUrls, newWebhook];
        setLocalWebhookUrls(updatedWebhooks);
        
        // Update parent state if setter provided
        if (setWebhookUrls) {
          setWebhookUrls(updatedWebhooks);
        }
        
        // Save to AsyncStorage (no console logs)
        AsyncStorage.setItem('webhookUrls', JSON.stringify(updatedWebhooks)).catch(() => {});
        
        // Clear input fields
        setLocalWebhookUrl('');
        updateLocalWebhookUrl('');
        setLocalWebhookTitle('');
        updateLocalWebhookTitle('');
      } else if (urlExists) {
        Alert.alert(t('common.duplicate'), t('common.urlAlreadyAdded'));
      }
    });
  };
  
  const handleToggleWebhookWrapped = (url: string, active: boolean) => {
    requirePremium(() => handleToggleWebhook(url, active));
  };
  
  const handleDeleteWebhookWrapped = (url: string) => {
    requirePremium(() => handleDeleteWebhook(url));
  };
  
  const handleSendSingleItemWrapped = (item: BulkDataItem) => {
    requirePremium(() => handleSendSingleItem(item));
  };
  
  const handleSendBulkDataWrapped = () => {
    requirePremium(() => handleSendBulkData());
  };
  
  const clearBulkDataWrapped = () => {
    requirePremium(() => clearBulkData());
  };

  // Language selection handler
  const handleLanguageSelect = (languageCode: string) => {
    setLanguage(languageCode);
  };

  // Auth handlers
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);
    if (!error) {
      if (lastAttemptedAction) {
        lastAttemptedAction();
        setLastAttemptedAction(null);
      }
    } else {
      Alert.alert(t('auth.error'), error.message);
    }
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
      Alert.alert(t('settings.webhooks.invalidUrl'), t('settings.webhooks.invalidUrlMessage'));
      return;
    }
    
    if (
      localWebhookUrls.some(
        (w) => w.url === validatedUrl && w.url !== oldUrl
      )
    ) {
      Alert.alert(t('settings.webhooks.duplicateUrl'), t('settings.webhooks.duplicateUrlMessage'));
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
      
      Alert.alert(t('settings.webhooks.success'), t('settings.webhooks.webhookUpdated'));
    } catch (e) {
      Alert.alert(t('settings.webhooks.saveError'), t('settings.webhooks.couldNotSave'));
    }
  };

  // Function to handle sending an individual bulk data item
  const handleSendSingleItem = async (item: BulkDataItem) => {
    const activeWebhooks = webhookUrls.filter(webhook => webhook.active);
    
    if (activeWebhooks.length === 0) {
      Alert.alert(t('settings.bulkData.noActiveUrls'), t('settings.bulkData.activateMessage'));
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
        t('settings.bulkData.sendComplete'),
        `${t('settings.bulkData.successfullySentTo')} ${successes} ${successes !== 1 ? t('settings.bulkData.endpoints') : t('settings.bulkData.endpoint')}.
${failures > 0 ? `${t('settings.bulkData.failedToSendTo')} ${failures} ${failures !== 1 ? t('settings.bulkData.endpoints') : t('settings.bulkData.endpoint')}.` : ''}`
      );
      
    } catch (error: unknown) {
      Alert.alert(t('settings.bulkData.sendError'), t('settings.bulkData.errorSending'));
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
    // Avoid redundant writes by checking for actual changes
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
        Alert.alert(t('settings.webhooks.saveError'), t('settings.bulkData.saveErrorMessage'));
      });
  };
  
  // Function to delete a bulk data item
  const deleteBulkItem = (itemId: string | number) => {
    // Guard deletion to only write when list actually shrank
    const updatedBulkData = bulkData.filter(item => item.id !== itemId);
    AsyncStorage.setItem('bulkData', JSON.stringify(updatedBulkData))
      .then(() => {
        setBulkData(updatedBulkData);
      })
      .catch(() => {
        Alert.alert(t('settings.bulkData.deleteError'), t('settings.bulkData.deleteErrorMessage'));
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
                <AppIcon name="cog" size={20} color="#888" style={{ marginRight: 8 }} />
                <Text style={styles.subHeader}>{t('settings.general.title')}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <AppIcon
                name={optionsOpen ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
            {optionsOpen && (
              <View>
                <View style={styles.optionsDropdownMenu}>
                  <Text style={[styles.settingLabel, { color: '#888', fontSize: 14, marginBottom: 8 }]}>{t('settings.general.inputBehavior')}</Text>
                  <View style={styles.settingRowCompact}>
                    <Text style={styles.settingLabel}>{t('settings.general.muteVoiceOutput')}</Text>
                    <Switch
                      value={isSpeechMuted}
                      onValueChange={() => toggleSpeechMute?.()}
                      trackColor={{ false: "#333", true: "#0066cc" }}
                      thumbColor={isSpeechMuted ? "#0066cc" : "#f4f3f4"}
                    />
                  </View>
                  <View style={styles.settingRowCompact}>
                    <Text style={styles.settingLabel}>Continuous Mode</Text>
                    <Switch
                      value={continuousMode}
                      onValueChange={v => requirePremium(() => setContinuousMode?.(v))}
                      trackColor={{ false: "#333", true: "#0066cc" }}
                      thumbColor={continuousMode ? "#0066cc" : "#f4f3f4"}
                      disabled={loading}
                    />
                  </View>
                  <View style={styles.settingRowCompact}>
                    <Text style={styles.settingLabel}>{t('settings.general.newLineOnSend')}</Text>
                    <Switch
                      value={enterKeyNewLine}
                      onValueChange={v => setEnterKeyNewLine?.(v)}
                      trackColor={{ false: "#333", true: "#0066cc" }}
                      thumbColor={enterKeyNewLine ? "#0066cc" : "#f4f3f4"}
                    />
                  </View>
                  {Platform.OS !== 'web' && (
                    <View style={styles.settingRowCompact}>
                      <Text style={styles.settingLabel}>{t('settings.general.enableVibration')}</Text>
                      <Switch
                        value={vibrationEnabled}
                        onValueChange={v => setVibrationEnabled?.(v)}
                        trackColor={{ false: "#333", true: "#0066cc" }}
                        thumbColor={vibrationEnabled ? "#0066cc" : "#f4f3f4"}
                      />
                    </View>
                  )}
                  {Platform.OS !== 'web' && (
                    <View style={styles.settingRowCompact}>
                      <Text style={styles.settingLabel}>{t('settings.general.openInCalcMode')}</Text>
                      <Switch
                        value={openInCalcMode}
                        onValueChange={v => setOpenInCalcMode?.(v)}
                        trackColor={{ false: "#333", true: "#0066cc" }}
                        thumbColor={openInCalcMode ? "#0066cc" : "#f4f3f4"}
                      />
                    </View>
                  )}
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#333' }}>
                    <Text style={[styles.settingLabel, { color: '#888', fontSize: 14, marginBottom: 8 }]}>{t('settings.general.webhooksSection')}</Text>
                  </View>
                  <View style={styles.settingRowCompact}>
                    <Text style={styles.settingLabel}>{t('settings.general.sendAnswerWithoutEquation')}</Text>
                    <Switch
                      value={!sendEquation}
                      onValueChange={v => requirePremium(() => setSendEquation(!v))}
                      trackColor={{ false: "#333", true: "#0066cc" }}
                      thumbColor={!sendEquation ? "#0066cc" : "#f4f3f4"}
                    />
                  </View>
                  <View style={styles.settingRowCompact}>
                    <Text style={styles.settingLabel}>{t('settings.general.queueResultsForManualSending')}</Text>
                    <Switch
                      value={!streamResults}
                      onValueChange={v => requirePremium(() => setStreamResults(!v))}
                      trackColor={{ false: "#333", true: "#0066cc" }}
                      thumbColor={!streamResults ? "#0066cc" : "#f4f3f4"}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Language Section */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 }}
              onPress={() => setLanguageSectionOpen((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppIcon name="language" size={20} color="#888" style={{ marginRight: 8 }} />
                <Text style={styles.subHeader}>{t('settings.language.title')}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <AppIcon
                name={languageSectionOpen ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
            {languageSectionOpen && (
              <View>
                <View style={styles.optionsDropdownMenu}>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <TouchableOpacity
                      key={lang.code}
                      style={styles.languageOption}
                      onPress={() => handleLanguageSelect(lang.code)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.languageOptionContent}>
                        <Text style={styles.languageName}>{lang.nativeName}</Text>
                      </View>
                      {language === lang.code && (
                        <AppIcon name="check" size={20} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
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
                <AppIcon name="webhook" size={20} color="#888" style={{ marginRight: 8 }} />
                <Text style={styles.subHeader}>{t('settings.webhooks.title')}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <AppIcon
                name={webhookTitleOpen ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
            
            {webhookTitleOpen && (
              <View>
                <View>
                  <Text style={styles.sectionSubtitle}>{t('settings.webhooks.createNew')}</Text>
                  <View style={[styles.addWebhookContainer, styles.sectionPadding]}>
                    <TextInput
                      style={styles.webhookInput}
                      placeholder={t('settings.webhooks.enterTitle')}
                      placeholderTextColor="#888"
                      value={localWebhookTitle}
                      onChangeText={updateLocalWebhookTitle}
                      autoCapitalize="sentences"
                    />
                    <TextInput
                      style={styles.webhookInput}
                      placeholder={t('settings.webhooks.enterUrl')}
                      placeholderTextColor="#888"
                      value={localWebhookUrl}
                      onChangeText={updateLocalWebhookUrl}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                    <TouchableOpacity
                      style={[
                        styles.addButton, 
                        (!isPremium || !/^https?:\/\//.test(localWebhookUrl.trim())) && styles.addButtonDisabled
                      ]}
                      onPress={handleAddWebhookLocal}
                      disabled={!isPremium || !/^https?:\/\//.test(localWebhookUrl.trim())}
                    >
                      <Text style={styles.addButtonText}>
                        {!isPremium ? t('common.pro') : t('settings.webhooks.add')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.sectionDivider} />
                  
                  <Text style={[styles.sectionSubtitle, styles.sectionTopMargin]}>{t('settings.webhooks.myWebhooks')}</Text>
                  {localWebhookUrls.length > 0 ? (
                    <View style={styles.webhookList}>
                      {localWebhookUrls.map((item) => (
                        <View key={item.url} style={[styles.webhookItem, styles.sectionPadding]}>
                          {editingWebhookUrl === item.url ? (
                            // Editing UI
                            <View style={styles.webhookEditRow}>
                              <View style={styles.webhookEditInputsContainer}>
                                <TextInput
                                  style={styles.webhookInput}
                                  placeholder={t('settings.webhooks.webhookTitle')}
                                  placeholderTextColor="#888"
                                  value={editingWebhookTitle}
                                  onChangeText={setEditingWebhookTitle}
                                  autoCapitalize="sentences"
                                />
                                <TextInput
                                  style={styles.webhookInput}
                                  placeholder={t('settings.webhooks.webhookUrl')}
                                  placeholderTextColor="#888"
                                  value={editingWebhookValue}
                                  onChangeText={setEditingWebhookValue}
                                  autoCapitalize="none"
                                  keyboardType="url"
                                />
                              </View>
                              <View style={styles.webhookEditControls}>
                                <TouchableOpacity
                                  style={[styles.editButton, styles.saveButton]}
                                  onPress={() => saveEditedWebhook(item.url)}
                                >
                                  <AppIcon name="check" size={24} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.editButton, styles.cancelButton]}
                                  onPress={cancelEditingWebhook}
                                >
                                  <AppIcon name="close" size={24} color="#FF3B30" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            // Display UI
                            <>
                              <Text style={styles.webhookUrlText} numberOfLines={1} ellipsizeMode="middle">
                                {item.title ? item.title : item.url}
                              </Text>
                              <View style={styles.webhookItemControls}>
                                <Switch
                                  value={item.active}
                                  onValueChange={(value) => {
                                    requirePremium(() => {
                                      handleToggleWebhook(item.url, value);
                                      const updated = localWebhookUrls.map(webhook => 
                                        webhook.url === item.url ? { ...webhook, active: value } : webhook
                                      );
                                      setLocalWebhookUrls(updated);
                                    });
                                  }}
                                  trackColor={{ false: "#333", true: "#0066cc" }}
                                  thumbColor={item.active ? "#0066cc" : "#f4f3f4"}
                                  style={styles.webhookSwitch}
                                />
                                <TouchableOpacity
                                  onPress={() => startEditingWebhook(item.url)}
                                  style={styles.editButton}
                                >
                                  <AppIcon name="pencil" size={20} color="#888888" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => {
                                    handleDeleteWebhookWrapped(item.url);
                                    const updated = localWebhookUrls.filter(webhook => webhook.url !== item.url);
                                    setLocalWebhookUrls(updated);
                                  }}
                                  style={styles.deleteButton}
                                >
                                  <AppIcon name="close" size={20} color="#888888" />
                                </TouchableOpacity>
                              </View>
                            </>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyListText}>{t('settings.webhooks.noWebhooksYet')}</Text>
                  )}
                </View>
              </View>
            )}
          </View>
          
          {/* Bulk Send Button and Data Display */}
          {bulkData.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.bulkHeaderContainer}>
                <Text style={styles.subHeader}>{t('settings.bulkData.title')} ({bulkData.length} {t('settings.bulkData.items')})</Text>
                <TouchableOpacity 
                  onPress={clearBulkDataWrapped} 
                  style={styles.deleteAllButton} 
                  disabled={isSendingBulk} 
                >
                  <Text style={[styles.deleteAllButtonText, isSendingBulk && styles.disabledText]}>{t('settings.bulkData.deleteAll')}</Text> 
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
                            <AppIcon name="check" size={18} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.editButton, styles.cancelButton]}
                            onPress={cancelEditing}
                          >
                            <AppIcon name="close" size={18} color="#fff" />
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
                              <AppIcon name="pencil" size={18} color="#ccc" />
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={styles.bulkItemAction}
                              onPress={() => handleSendSingleItemWrapped(item)}
                              disabled={sendingItemId === item.id || localWebhookUrls.filter(webhook => webhook.active).length === 0}
                            >
                              {sendingItemId === item.id ? (
                                <ActivityIndicator size="small" color="#0066cc" />
                              ) : (
                                <AppIcon 
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
                              <AppIcon name="close" size={18} color="#888888" />
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
                <AppIcon name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.bulkSendText}>
                  {isSendingBulk ? t('settings.bulkData.sending') : `${t('settings.bulkData.send')} ${bulkData.length} ${bulkData.length !== 1 ? t('settings.bulkData.items') : t('settings.bulkData.item')}`}
                </Text>
                {isSendingBulk && <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 10 }} />}
              </TouchableOpacity>
              {localWebhookUrls.filter(webhook => webhook.active).length === 0 && bulkData.length > 0 && !isSendingBulk && (
                <Text style={styles.warningText}>{t('settings.bulkData.activateWebhook')}</Text>
              )}
            </View>
          )}
          
          {/* Authentication Section */}
          <View style={[styles.sectionCard, styles.authSection]}>
            <View style={{ alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4 }}>
              {/* Avatar */}
              {user ? (
                user.picture ? (
                  <Image 
                    source={{ uri: user.picture }} 
                    style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 12 }}
                  />
                ) : (
                  <AppIcon name="account-circle" size={72} color="#888" style={{ marginBottom: 12 }} />
                )
              ) : (
                <Image 
                  source={require('../../assets/images/cat.webp')} 
                  style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 12 }}
                />
              )}

              {/* Text */}
              <Text style={[styles.subHeader, { fontSize: 18, marginBottom: 2, fontWeight: 'bold', color: '#fff', textAlign: 'center' }]}>
                {user ? (user.name || 'User') : t('auth.anonymousCat')}
              </Text>
              <Text style={[styles.userSubtitle, { fontSize: 14, color: '#888', textAlign: 'center' }]}>
                {user ? user.email : t('auth.guestUser')}
              </Text>

              {/* Button */}
              {user ? (
                <TouchableOpacity
                  style={[styles.signOutButton, { marginTop: 12 }]}
                  onPress={handleSignOut}
                >
                  <AppIcon name="logout" size={18} color="#888" style={{ marginRight: 8 }} />
                  <Text style={styles.signOutButtonText}>{t('auth.signOut')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.googleButton, { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 }]}
                  onPress={handleGoogleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#0066cc" size="small" />
                  ) : (
                    <>
                      <GoogleLogo size={18} />
                      <Text style={[styles.googleButtonText, { fontSize: 14 }]}>{t('auth.continueWithGoogle')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Legal Links at the bottom of ScrollView */}
          <View style={styles.legalLinksContainer}>
            <TouchableOpacity 
              onPress={() => {
                onClose();
                router.push('/privacy');
              }}
            >
              <Text style={styles.legalLinkText}>{t('common.privacyPolicy')}</Text>
            </TouchableOpacity>
            <Text style={styles.legalLinkSeparator}> • </Text>
            <TouchableOpacity 
              onPress={() => {
                onClose();
                router.push('/terms');
              }}
            >
              <Text style={styles.legalLinkText}>{t('common.termsOfService')}</Text>
            </TouchableOpacity>
            {user && (
              <>
                <Text style={styles.legalLinkSeparator}> • </Text>
                <TouchableOpacity 
                  onPress={() => {
                    onClose();
                    router.push('/contact');
                  }}
                >
                  <Text style={styles.legalLinkText}>Contact Us</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

        </ScrollView>
  );
  
  return (
    <>
      <Modal
        visible={visible}
        animationType={Platform.OS === 'web' ? "none" : "slide"}
        transparent={false}
        onRequestClose={onClose}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#121212' }}>
          <View style={{ flex: 1, backgroundColor: '#121212' }}>
          <View style={styles.header}>
            {/* New Back Button on Left */}
            <TouchableOpacity onPress={onClose} style={styles.headerBackButton}>
              <AppIcon name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            
            {/* Title and Settings Icon (centered group) */}
            <View style={styles.headerTitleGroup}>
              <AppIcon name="cog" size={24} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>{t('settings.title')}</Text>
            </View>
            
            {/* Premium Button - only shown for non-premium users */}
            {!isPremium ? (
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0, elevation: 0, shadowOpacity: 0 }}
                onPress={() => setShowPremiumModal(true)}
                activeOpacity={0.7}
              >
                <AppIcon name="crown-outline" size={22} color="#ff9500" />
                <Text style={{ color: '#ff9500', fontWeight: 'bold', fontSize: 14, marginLeft: 4 }}>{t('common.pro')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerRightPlaceholder} />
            )}
          </View>
          
          {ScrollViewContent}
        </View>
        </SafeAreaView>
        <PremiumPaymentModal
          visible={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          onSuccess={() => {
            setShowPremiumModal(false);
            if (lastAttemptedAction) {
              lastAttemptedAction();
              setLastAttemptedAction(null);
            }
          }}
        />
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  optionsDropdownMenu: {
    // backgroundColor: '#0F0F0F', // Removed to blend with sectionCard
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10, // Keep this for internal spacing of rows
    // marginTop: 2, // Removed
    // marginBottom: 6, // Removed
    gap: 6,
    // shadowColor: '#000', // Removed
    // shadowOpacity: 0.10, // Removed
    // shadowRadius: 4, // Removed
    // shadowOffset: { width: 0, height: 2 }, // Removed
    // elevation: 1, // Removed
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
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  webhookEditInputsContainer: {
    flex: 1,
    gap: 8,
  },
  webhookEditControls: {
    flexDirection: 'row',
    gap: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#121212',
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
    backgroundColor: '#121212',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 16,
  },
  sectionCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  authSection: {
    backgroundColor: 'transparent',
    borderWidth: 0,
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
    backgroundColor: '#0F0F0F',
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
    backgroundColor: '#0F0F0F',
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    paddingHorizontal: 0, // Parent optionsDropdownMenu handles horizontal padding
    // marginRight: 12, // Removed, label should handle its own margin if needed
  },
  settingLabel: {
    color: '#fff',
    fontSize: 15,
    flexShrink: 1, // Allows text to shrink if switch takes up space
    marginRight: 12, // Space between label and switch
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
    backgroundColor: '#0F0F0F',
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
    backgroundColor: '#0F0F0F',
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
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  cancelButton: {
    backgroundColor: '#444',
    paddingVertical: 6,
    paddingHorizontal: 10,
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
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#0F0F0F',
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
    backgroundColor: 'transparent',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 10,
  },
  signOutButtonText: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'normal',
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
    backgroundColor: '#0F0F0F',
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
  googleButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
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
  loginPromptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
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
    backgroundColor: '#2C2C2E',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#444',
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
  premiumTryButton: {
    backgroundColor: '#FFD700',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 3px rgba(255, 215, 0, 0.3)',
      }
    }),
  },
  premiumTryText: {
    color: '#121212',
    fontWeight: 'bold',
    fontSize: 12,
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
    color: '#e0e0e0',
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
  // Legal Links Styles
  legalLinksContainer: {
    marginTop: 24,
    marginBottom: 16, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  legalLinkText: {
    fontSize: 13,
    color: '#AEAEB2',
    textDecorationLine: 'underline',
  },
  legalLinkSeparator: {
    fontSize: 13,
    color: '#AEAEB2',
    marginHorizontal: 6,
  },
  headerBackButton: {
    padding: 8, 
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRightPlaceholder: {
    width: 24 + 8 + 8,
  },
  // Language section styles
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  languageOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  languageFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  languageName: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  languageEnglishName: {
    fontSize: 14,
    color: '#888',
  },
});

export default WebhookSettingsComponent;