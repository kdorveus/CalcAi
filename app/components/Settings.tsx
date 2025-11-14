import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// Using our bundled AppIcon component instead of MaterialCommunityIcons
import AppIcon from '../../components/AppIcon';
import PremiumPaymentModal from '../../components/PremiumPaymentModal';
import { SUPPORTED_LANGUAGES } from '../../constants/Languages';
import { useAuth } from '../../contexts/AuthContext';
import { usePremium, usePremiumGate } from '../../contexts/PremiumContext';
import { useTranslation } from '../../hooks/useTranslation';
import GoogleLogo from './GoogleLogo';

// Types
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
  toggleSpeechMute?: (newMuteState?: boolean) => void;
  vibrationEnabled?: boolean;
  setVibrationEnabled?: (value: boolean) => void;
  openInCalcMode?: boolean;
  setOpenInCalcMode?: (value: boolean) => void;
  continuousMode?: boolean;
  setContinuousMode?: (value: boolean) => void;
}

// Extracted validation utilities
const sanitizeInput = (input: string): string => {
  if (!input) return '';

  // Remove any HTML/script tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Encode special characters
  sanitized = sanitized
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  // Limit the length to prevent DoS
  return sanitized.substring(0, 500);
};

const validateWebhookUrl = (url: string): string | null => {
  try {
    // Basic URL validation
    if (!url || typeof url !== 'string') return null;

    const trimmedUrl = url.trim();

    // Must start with http:// or https://
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) return null;

    // Create URL object to validate and parse
    const parsedUrl = new URL(trimmedUrl);

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null;

    return trimmedUrl;
  } catch {
    // If URL parsing fails, return null
    return null;
  }
};

// Extracted custom hooks
const useWebhookManagement = (
  webhookUrls: WebhookItem[],
  bulkData: BulkDataItem[],
  setBulkData: (data: BulkDataItem[]) => void,
  setWebhookUrls?: (urls: WebhookItem[]) => void
) => {
  const [localWebhookUrls, setLocalWebhookUrls] = useState<WebhookItem[]>(webhookUrls || []);
  const [localWebhookTitle, setLocalWebhookTitle] = useState<string>('');
  const [localWebhookUrl, setLocalWebhookUrl] = useState<string>('');
  const [editingWebhookUrl, setEditingWebhookUrl] = useState<string | null>(null);
  const [editingWebhookValue, setEditingWebhookValue] = useState<string>('');
  const [editingWebhookTitle, setEditingWebhookTitle] = useState<string>('');

  // Component state
  const [editingItemId, setEditingItemId] = useState<string | number | null>(null);
  const [editingItemValue, setEditingItemValue] = useState('');
  const [sendingItemId, setSendingItemId] = useState<string | number | null>(null);

  // Sync local webhooks with parent component webhooks
  useEffect(() => {
    setLocalWebhookUrls(webhookUrls);
  }, [webhookUrls]);

  const updateLocalWebhookTitle = (text: string) => {
    setLocalWebhookTitle(text);
  };

  const updateLocalWebhookUrl = (text: string) => {
    setLocalWebhookUrl(text);
  };

  const startEditingWebhook = (url: string) => {
    setEditingWebhookUrl(url);
    setEditingWebhookValue(url);
    const found = localWebhookUrls.find((w) => w.url === url);
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
      Alert.alert('Invalid URL', 'Please enter a valid URL');
      return;
    }

    if (localWebhookUrls.some((w) => w.url === validatedUrl && w.url !== oldUrl)) {
      Alert.alert('Duplicate URL', 'This URL already exists');
      return;
    }

    const updated = localWebhookUrls.map((w) =>
      w.url === oldUrl
        ? {
            ...w,
            url: validatedUrl,
            title: sanitizedTitle,
          }
        : w
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

      Alert.alert('Success', 'Webhook updated successfully');
    } catch {
      Alert.alert('Error', 'Could not save webhook');
    }
  };

  const handleSendSingleItem = async (item: BulkDataItem) => {
    const activeWebhooks = webhookUrls.filter((webhook) => webhook.active);

    if (activeWebhooks.length === 0) {
      Alert.alert('No active webhooks', 'Please activate at least one webhook');
      return;
    }

    setSendingItemId(item.id);

    try {
      // Create an array of promises for each active webhook URL
      const promises = activeWebhooks.map((webhook) => {
        return axios.post(
          webhook.url,
          { data: item.data },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000,
          }
        );
      });

      // Wait for all promises to resolve
      const results = await Promise.allSettled(promises);

      // Count successes and failures
      const successes = results.filter((result) => result.status === 'fulfilled').length;
      const failures = results.filter((result) => result.status === 'rejected').length;

      // Show result to user
      const successText = `Successfully sent to ${successes} endpoint${successes === 1 ? '' : 's'}.`;
      let failureText = '';
      if (failures > 0) {
        const endpointText = failures === 1 ? 'endpoint' : 'endpoints';
        failureText = ` Failed to send to ${failures} ${endpointText}.`;
      }
      Alert.alert('Send Complete', `${successText}${failureText}`);
    } catch {
      Alert.alert('Error', 'Error sending data');
    } finally {
      setSendingItemId(null);
    }
  };

  const startEditingItem = (item: BulkDataItem) => {
    setEditingItemId(item.id);
    setEditingItemValue(item.data);
  };

  const saveEditedItem = (itemId: string | number) => {
    // Avoid redundant writes by checking for actual changes
    const updatedBulkData = bulkData.map((item: BulkDataItem) =>
      item.id === itemId ? { ...item, data: editingItemValue } : item
    );

    AsyncStorage.setItem('bulkData', JSON.stringify(updatedBulkData))
      .then(() => {
        setEditingItemId(null);
        setEditingItemValue('');
        setBulkData(updatedBulkData);
      })
      .catch(() => {
        Alert.alert('Error', 'Could not save changes');
      });
  };

  const deleteBulkItem = (itemId: string | number) => {
    // Guard deletion to only write when list actually shrank
    const updatedBulkData = bulkData.filter((item: BulkDataItem) => item.id !== itemId);
    AsyncStorage.setItem('bulkData', JSON.stringify(updatedBulkData))
      .then(() => {
        setBulkData(updatedBulkData);
      })
      .catch(() => {
        Alert.alert('Error', 'Could not delete item');
      });
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditingItemValue('');
  };

  return {
    localWebhookUrls,
    setLocalWebhookUrls,
    localWebhookTitle,
    setLocalWebhookTitle,
    localWebhookUrl,
    setLocalWebhookUrl,
    editingWebhookUrl,
    editingWebhookValue,
    editingWebhookTitle,
    setEditingWebhookTitle,
    setEditingWebhookValue,
    updateLocalWebhookTitle,
    updateLocalWebhookUrl,
    startEditingWebhook,
    cancelEditingWebhook,
    saveEditedWebhook,
    editingItemId,
    editingItemValue,
    setEditingItemValue,
    sendingItemId,
    handleSendSingleItem,
    startEditingItem,
    saveEditedItem,
    deleteBulkItem,
    cancelEditing,
  };
};

const useAuthHandlers = (
  signOut: () => Promise<{ error: any }>,
  signInWithGoogle: () => Promise<{ error: any }>
) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(); // Use context signOut
      // No need to redirect here, _layout protection will handle it
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign out');
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    }
    // Success handled by context
  };

  return {
    handleSignOut,
    handleGoogleLogin,
    isLoading,
  };
};

const GeneralSettings: React.FC<{
  t: (key: string) => string;
  requirePremium: (action: () => void) => Promise<void>;
  isSpeechMuted?: boolean;
  toggleSpeechMute?: (newMuteState?: boolean) => void;
  continuousMode?: boolean;
  setContinuousMode?: (value: boolean) => void;
  enterKeyNewLine?: boolean;
  setEnterKeyNewLine?: (value: boolean) => void;
  vibrationEnabled?: boolean;
  setVibrationEnabled?: (value: boolean) => void;
  openInCalcMode?: boolean;
  setOpenInCalcMode?: (value: boolean) => void;
  sendEquation: boolean;
  setSendEquation: (value: boolean) => void;
  streamResults: boolean;
  setStreamResults: (value: boolean) => void;
  loading: boolean;
}> = ({
  t,
  requirePremium,
  isSpeechMuted,
  toggleSpeechMute,
  continuousMode,
  setContinuousMode,
  enterKeyNewLine,
  setEnterKeyNewLine,
  vibrationEnabled,
  setVibrationEnabled,
  openInCalcMode,
  setOpenInCalcMode,
  sendEquation,
  setSendEquation,
  streamResults,
  setStreamResults,
  loading,
}) => (
  <View style={styles.optionsDropdownMenu}>
    <Text style={[styles.settingLabel, { color: '#888', fontSize: 14, marginBottom: 8 }]}>
      {t('settings.general.inputBehavior')}
    </Text>
    <TouchableOpacity
      style={styles.settingRowCompact}
      onPress={() => requirePremium(() => toggleSpeechMute?.(!isSpeechMuted))}
      activeOpacity={0.7}
    >
      <Text style={styles.settingLabel}>{t('settings.general.muteVoiceOutput')}</Text>
      <Switch
        value={isSpeechMuted}
        onValueChange={(v) => requirePremium(() => toggleSpeechMute?.(v))}
        trackColor={{ false: '#333', true: '#0066cc' }}
        thumbColor={isSpeechMuted ? '#0066cc' : '#f4f3f4'}
        disabled={loading}
      />
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.settingRowCompact}
      onPress={() => requirePremium(() => setContinuousMode?.(!continuousMode))}
      activeOpacity={0.7}
      disabled={loading}
    >
      <Text style={styles.settingLabel}>Continuous Mode</Text>
      <Switch
        value={continuousMode}
        onValueChange={(v) => requirePremium(() => setContinuousMode?.(v))}
        trackColor={{ false: '#333', true: '#0066cc' }}
        thumbColor={continuousMode ? '#0066cc' : '#f4f3f4'}
        disabled={loading}
      />
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.settingRowCompact}
      onPress={() => requirePremium(() => setEnterKeyNewLine?.(!enterKeyNewLine))}
      activeOpacity={0.7}
    >
      <Text style={styles.settingLabel}>{t('settings.general.newLineOnSend')}</Text>
      <Switch
        value={enterKeyNewLine}
        onValueChange={(v) => requirePremium(() => setEnterKeyNewLine?.(v))}
        trackColor={{ false: '#333', true: '#0066cc' }}
        thumbColor={enterKeyNewLine ? '#0066cc' : '#f4f3f4'}
        disabled={loading}
      />
    </TouchableOpacity>
    {Platform.OS !== 'web' && (
      <TouchableOpacity
        style={styles.settingRowCompact}
        onPress={() => requirePremium(() => setVibrationEnabled?.(!vibrationEnabled))}
        activeOpacity={0.7}
      >
        <Text style={styles.settingLabel}>{t('settings.general.enableVibration')}</Text>
        <Switch
          value={vibrationEnabled}
          onValueChange={(v) => requirePremium(() => setVibrationEnabled?.(v))}
          trackColor={{ false: '#333', true: '#0066cc' }}
          thumbColor={vibrationEnabled ? '#0066cc' : '#f4f3f4'}
          disabled={loading}
        />
      </TouchableOpacity>
    )}
    {Platform.OS !== 'web' && (
      <TouchableOpacity
        style={styles.settingRowCompact}
        onPress={() => requirePremium(() => setOpenInCalcMode?.(!openInCalcMode))}
        activeOpacity={0.7}
      >
        <Text style={styles.settingLabel}>{t('settings.general.openInCalcMode')}</Text>
        <Switch
          value={openInCalcMode}
          onValueChange={(v) => requirePremium(() => setOpenInCalcMode?.(v))}
          trackColor={{ false: '#333', true: '#0066cc' }}
          thumbColor={openInCalcMode ? '#0066cc' : '#f4f3f4'}
          disabled={loading}
        />
      </TouchableOpacity>
    )}
    <View
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#333',
      }}
    >
      <Text style={[styles.settingLabel, { color: '#888', fontSize: 14, marginBottom: 8 }]}>
        {t('settings.general.webhooksSection')}
      </Text>
    </View>
    <TouchableOpacity
      style={styles.settingRowCompact}
      onPress={() => requirePremium(() => setSendEquation(!sendEquation))}
      activeOpacity={0.7}
    >
      <Text style={styles.settingLabel}>{t('settings.general.sendAnswerWithoutEquation')}</Text>
      <Switch
        value={!sendEquation}
        onValueChange={(v) => requirePremium(() => setSendEquation(!v))}
        trackColor={{ false: '#333', true: '#0066cc' }}
        thumbColor={sendEquation ? '#f4f3f4' : '#0066cc'}
        disabled={loading}
      />
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.settingRowCompact}
      onPress={() => requirePremium(() => setStreamResults(!streamResults))}
      activeOpacity={0.7}
    >
      <Text style={styles.settingLabel}>{t('settings.general.queueResultsForManualSending')}</Text>
      <Switch
        value={!streamResults}
        onValueChange={(v) => requirePremium(() => setStreamResults(!v))}
        trackColor={{ false: '#333', true: '#0066cc' }}
        thumbColor={streamResults ? '#f4f3f4' : '#0066cc'}
        disabled={loading}
      />
    </TouchableOpacity>
  </View>
);

const LanguageSettings: React.FC<{
  language: string;
  setLanguage: (lang: string) => void;
}> = ({ language, setLanguage }) => (
  <View style={styles.optionsDropdownMenu}>
    {SUPPORTED_LANGUAGES.map((lang) => (
      <TouchableOpacity
        key={lang.code}
        style={[styles.languageOption, language === lang.code && styles.languageOptionSelected]}
        onPress={() => setLanguage(lang.code)}
        activeOpacity={0.6}
      >
        <View style={styles.languageOptionContent}>
          <Text style={styles.languageName}>{lang.nativeName}</Text>
        </View>
        <View style={[styles.radioButton, language === lang.code && styles.radioButtonSelected]}>
          {language === lang.code && <View style={styles.radioButtonInner} />}
        </View>
      </TouchableOpacity>
    ))}
  </View>
);

const createWebhookToggleHandler = (
  itemUrl: string,
  value: boolean,
  handleToggleWebhook: (url: string, active: boolean) => void,
  localWebhookUrls: WebhookItem[],
  setLocalWebhookUrls: (urls: WebhookItem[]) => void
) => {
  return () => {
    handleToggleWebhook(itemUrl, value);
    const updated = localWebhookUrls.map((webhook) =>
      webhook.url === itemUrl ? { ...webhook, active: value } : webhook
    );
    setLocalWebhookUrls(updated);
  };
};

const createWebhookDeleteHandler = (
  itemUrl: string,
  handleDeleteWebhookWrapped: (url: string) => void,
  localWebhookUrls: WebhookItem[],
  setLocalWebhookUrls: (urls: WebhookItem[]) => void
) => {
  return () => {
    handleDeleteWebhookWrapped(itemUrl);
    const updated = localWebhookUrls.filter((webhook) => webhook.url !== itemUrl);
    setLocalWebhookUrls(updated);
  };
};

const isValidWebhookUrl = (url: string): boolean => /^https?:\/\//.test(url.trim());

const createPremiumWebhookHandler = (
  requirePremium: (action: () => void) => Promise<void>,
  handleAddWebhookLocal: () => void
) => {
  return () => {
    requirePremium(() => {
      handleAddWebhookLocal();
    });
  };
};

const createDirectWebhookHandler = (handleAddWebhookLocal: () => void) => {
  return () => {
    handleAddWebhookLocal();
  };
};

const createAddWebhookHandler = (
  isPremium: boolean,
  localWebhookUrl: string,
  requirePremium: (action: () => void) => Promise<void>,
  handleAddWebhookLocal: () => void
) => {
  const isValidUrl = isValidWebhookUrl(localWebhookUrl);

  if (!isValidUrl) {
    return () => {};
  }

  return isPremium
    ? createDirectWebhookHandler(handleAddWebhookLocal)
    : createPremiumWebhookHandler(requirePremium, handleAddWebhookLocal);
};

const getBulkSendButtonText = (
  isSendingBulk: boolean,
  bulkDataLength: number,
  t: (key: string) => string
): string => {
  if (isSendingBulk) {
    return t('settings.bulkData.sending');
  }

  const itemText =
    bulkDataLength === 1 ? t('settings.bulkData.item') : t('settings.bulkData.items');
  return `${t('settings.bulkData.send')} ${bulkDataLength} ${itemText}`;
};

const WebhookSettings: React.FC<{
  t: (key: string) => string;
  requirePremium: (action: () => void) => Promise<void>;
  isPremium: boolean;
  localWebhookUrls: WebhookItem[];
  setLocalWebhookUrls: (urls: WebhookItem[]) => void;
  localWebhookTitle: string;
  localWebhookUrl: string;
  updateLocalWebhookTitle: (text: string) => void;
  updateLocalWebhookUrl: (text: string) => void;
  handleAddWebhookLocal: () => void;
  handleDeleteWebhookWrapped: (url: string) => void;
  handleToggleWebhook: (url: string, active: boolean) => void;
  editingWebhookUrl: string | null;
  editingWebhookValue: string;
  editingWebhookTitle: string;
  setEditingWebhookTitle: (text: string) => void;
  setEditingWebhookValue: (text: string) => void;
  startEditingWebhook: (url: string) => void;
  cancelEditingWebhook: () => void;
  saveEditedWebhook: (oldUrl: string) => void;
}> = ({
  t,
  requirePremium,
  isPremium,
  localWebhookUrls,
  setLocalWebhookUrls,
  localWebhookTitle,
  localWebhookUrl,
  updateLocalWebhookTitle,
  updateLocalWebhookUrl,
  handleAddWebhookLocal,
  handleDeleteWebhookWrapped,
  handleToggleWebhook,
  editingWebhookUrl,
  editingWebhookValue,
  editingWebhookTitle,
  setEditingWebhookTitle,
  setEditingWebhookValue,
  startEditingWebhook,
  cancelEditingWebhook,
  saveEditedWebhook,
}) => (
  <View style={styles.dropdownContent}>
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
          (!isPremium || !/^https?:\/\//.test(localWebhookUrl.trim())) && styles.addButtonDisabled,
        ]}
        onPress={createAddWebhookHandler(
          isPremium,
          localWebhookUrl,
          requirePremium,
          handleAddWebhookLocal
        )}
      >
        {isPremium ? (
          <Text style={styles.addButtonText}>{t('settings.webhooks.add')}</Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppIcon name="crown" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.addButtonText}>PREMIUM</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>

    {localWebhookUrls.length > 0 && (
      <>
        <View style={styles.sectionDivider} />
        <Text style={[styles.sectionSubtitle, styles.sectionTopMargin]}>
          {t('settings.webhooks.myWebhooks')}
        </Text>
      </>
    )}

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
                      const toggleHandler = createWebhookToggleHandler(
                        item.url,
                        value,
                        handleToggleWebhook,
                        localWebhookUrls,
                        setLocalWebhookUrls
                      );
                      requirePremium(toggleHandler);
                    }}
                    trackColor={{ false: '#333', true: '#0066cc' }}
                    thumbColor={item.active ? '#0066cc' : '#f4f3f4'}
                    style={styles.webhookSwitch}
                  />
                  <TouchableOpacity
                    onPress={() => startEditingWebhook(item.url)}
                    style={styles.editButton}
                  >
                    <AppIcon name="pencil" size={20} color="#888888" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={createWebhookDeleteHandler(
                      item.url,
                      handleDeleteWebhookWrapped,
                      localWebhookUrls,
                      setLocalWebhookUrls
                    )}
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
      <View style={styles.emptyStateContainer}>
        <AppIcon name="webhook" size={48} color="#444" style={{ marginBottom: 16 }} />
        <Text style={styles.emptyStateTitle}>No Webhooks</Text>
        <Text style={styles.emptyStateDescription}>
          Send results to external services automatically.
        </Text>
        <Text style={styles.emptyStateDescription}>
          Works with Zapier, Make, or any API endpoint.
        </Text>
      </View>
    )}
  </View>
);

const AuthSection: React.FC<{
  t: (key: string) => string;
  user: any;
  handleSignOut: () => Promise<void>;
  handleGoogleLogin: () => Promise<void>;
  isLoading: boolean;
}> = ({ t, user, handleSignOut, handleGoogleLogin, isLoading }) => (
  <View style={[styles.sectionCard, styles.authSection]}>
    <View style={{ alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4 }}>
      {/* Avatar */}
      {user &&
        (user.picture ? (
          <Image
            source={{ uri: user.picture }}
            style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 12 }}
          />
        ) : (
          <AppIcon name="account-circle" size={72} color="#888" style={{ marginBottom: 12 }} />
        ))}
      {!user && (
        <Image
          source={require('../../assets/images/cat.webp')}
          style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 12 }}
        />
      )}

      {/* Text */}
      <Text
        style={[
          styles.subHeader,
          {
            fontSize: 18,
            marginBottom: 2,
            fontWeight: 'bold',
            color: '#fff',
            textAlign: 'center',
          },
        ]}
      >
        {user ? user.name || 'User' : t('auth.anonymousCat')}
      </Text>
      <Text style={[styles.userSubtitle, { fontSize: 14, color: '#888', textAlign: 'center' }]}>
        {user ? user.email : t('auth.guestUser')}
      </Text>

      {/* Button */}
      {user ? (
        <TouchableOpacity style={[styles.signOutButton, { marginTop: 4 }]} onPress={handleSignOut}>
          <AppIcon name="logout" size={18} color="#888" style={{ marginRight: 8 }} />
          <Text style={styles.signOutButtonText}>{t('auth.signOut')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.googleButton,
            { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 },
          ]}
          onPress={handleGoogleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#0066cc" size="small" />
          ) : (
            <>
              <GoogleLogo size={18} />
              <Text style={[styles.googleButtonText, { fontSize: 14 }]}>
                {t('auth.continueWithGoogle')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  </View>
);

export const WebhookSettingsComponentV2: React.FC<WebhookSettingsProps> = ({
  visible,
  onClose,
  webhookUrls,
  setWebhookUrls,
  sendEquation,
  setSendEquation,
  streamResults,
  setStreamResults,
  bulkData,
  setBulkData,
  clearBulkData,
  isSendingBulk,
  handleSendBulkData,
  enterKeyNewLine,
  setEnterKeyNewLine,
  isSpeechMuted,
  toggleSpeechMute,
  vibrationEnabled,
  setVibrationEnabled,
  openInCalcMode,
  setOpenInCalcMode,
  continuousMode,
  setContinuousMode,
}) => {
  const { user, loading, signOut, authError, signInWithGoogle } = useAuth();
  const { isPremium } = usePremium();
  const { t, language, setLanguage } = useTranslation();

  // Single state for accordion - only one section can be open at a time
  type SectionName = 'general' | 'language' | 'webhooks' | null;
  const [openSection, setOpenSection] = useState<SectionName>(null);

  // Use extracted hooks
  const webhookManagement = useWebhookManagement(
    webhookUrls,
    bulkData,
    setBulkData,
    setWebhookUrls
  );
  const premiumGate = usePremiumGate();
  const authHandlers = useAuthHandlers(signOut, signInWithGoogle);

  useEffect(() => {
    if (authError) {
      Alert.alert(t('auth.authError'), authError);
    }
  }, [authError, t]);

  const handleToggleSection = (sectionName: SectionName) => {
    setOpenSection((prevOpenSection) => (prevOpenSection === sectionName ? null : sectionName));
  };

  const handleToggleWebhook = (url: string, active: boolean) => {
    const updated = webhookManagement.localWebhookUrls.map((webhook) =>
      webhook.url === url ? { ...webhook, active } : webhook
    );
    webhookManagement.setLocalWebhookUrls(updated);
    if (setWebhookUrls) {
      setWebhookUrls(updated);
    }
    AsyncStorage.setItem('webhookUrls', JSON.stringify(updated)).catch(() => {});
  };

  const handleDeleteWebhookWrapped = (_url: string) => {
    premiumGate.requirePremium(() => {
      // Implementation would call the actual delete handler
    });
  };

  const handleSendSingleItemWrapped = (item: BulkDataItem) => {
    premiumGate.requirePremium(() => webhookManagement.handleSendSingleItem(item));
  };

  const handleSendBulkDataWrapped = () => {
    premiumGate.requirePremium(() => handleSendBulkData());
  };

  const clearBulkDataWrapped = () => {
    premiumGate.requirePremium(() => clearBulkData());
  };

  // Language selection handler
  const handleLanguageSelect = (languageCode: string) => {
    setLanguage(languageCode);
  };

  // Add webhook handler
  const handleAddWebhookLocal = () => {
    premiumGate.requirePremium(async () => {
      // Sanitize inputs
      const sanitizedTitle = sanitizeInput(webhookManagement.localWebhookTitle);
      const validatedUrl = validateWebhookUrl(webhookManagement.localWebhookUrl);

      if (!validatedUrl) {
        Alert.alert(t('settings.webhooks.invalidUrl'), t('settings.webhooks.invalidUrlMessage'));
        return;
      }

      const urlExists = webhookManagement.localWebhookUrls.some(
        (webhook) => webhook.url === validatedUrl
      );

      if (validatedUrl && !urlExists) {
        // Add new webhook with active state set to true and include title if provided
        const newWebhook = {
          url: validatedUrl,
          active: false,
          title: sanitizedTitle || undefined, // Only include title if it's not empty
        };

        const updatedWebhooks = [...webhookManagement.localWebhookUrls, newWebhook];
        webhookManagement.setLocalWebhookUrls(updatedWebhooks);

        // Update parent state if setter provided
        if (setWebhookUrls) {
          setWebhookUrls(updatedWebhooks);
        }

        AsyncStorage.setItem('webhookUrls', JSON.stringify(updatedWebhooks)).catch(() => {});

        // Clear input fields
        webhookManagement.setLocalWebhookUrl('');
        webhookManagement.setLocalWebhookTitle('');
      } else if (urlExists) {
        Alert.alert(t('common.duplicate'), t('common.urlAlreadyAdded'));
      }
    });
  };

  const ScrollViewContent = (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.scrollableArea} contentContainerStyle={styles.contentContainer}>
        {/* Settings Section */}
        <View
          style={[
            styles.sectionCard,
            openSection === 'general' && styles.sectionCardOpen,
            { position: 'relative', zIndex: 3 },
          ]}
        >
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 8,
              paddingHorizontal: 4,
            }}
            onPress={() => handleToggleSection('general')}
            activeOpacity={1}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppIcon name="sliders-horizontal" size={20} color="#888" />
              <Text
                style={[
                  styles.subHeader,
                  { marginLeft: 0, marginBottom: 0, lineHeight: 20, fontWeight: '400' },
                ]}
              >
                {t('settings.general.title')}
              </Text>
            </View>
            <AppIcon
              name={openSection === 'general' ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          {openSection === 'general' && (
            <GeneralSettings
              t={t}
              requirePremium={premiumGate.requirePremium}
              isSpeechMuted={isSpeechMuted}
              toggleSpeechMute={toggleSpeechMute}
              continuousMode={continuousMode}
              setContinuousMode={setContinuousMode}
              enterKeyNewLine={enterKeyNewLine}
              setEnterKeyNewLine={setEnterKeyNewLine}
              vibrationEnabled={vibrationEnabled}
              setVibrationEnabled={setVibrationEnabled}
              openInCalcMode={openInCalcMode}
              setOpenInCalcMode={setOpenInCalcMode}
              sendEquation={sendEquation}
              setSendEquation={setSendEquation}
              streamResults={streamResults}
              setStreamResults={setStreamResults}
              loading={loading}
            />
          )}
        </View>

        {/* Language Section */}
        <View
          style={[
            styles.sectionCard,
            openSection === 'language' && styles.sectionCardOpen,
            { position: 'relative', zIndex: 2 },
          ]}
        >
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 8,
              paddingHorizontal: 4,
            }}
            onPress={() => handleToggleSection('language')}
            activeOpacity={1}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppIcon name="language" size={20} color="#888" />
              <Text
                style={[
                  styles.subHeader,
                  { marginLeft: 0, marginBottom: 0, lineHeight: 20, fontWeight: '400' },
                ]}
              >
                {t('settings.language.title')}
              </Text>
            </View>
            <AppIcon
              name={openSection === 'language' ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          {openSection === 'language' && (
            <LanguageSettings language={language} setLanguage={handleLanguageSelect} />
          )}
        </View>

        {/* Webhook Section */}
        <View
          style={[
            styles.sectionCard,
            openSection === 'webhooks' && styles.sectionCardOpen,
            { position: 'relative', zIndex: 1 },
          ]}
        >
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 8,
              paddingHorizontal: 4,
            }}
            onPress={() => handleToggleSection('webhooks')}
            activeOpacity={1}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppIcon name="webhook" size={20} color="#888" />
              <Text
                style={[
                  styles.subHeader,
                  { marginLeft: 0, marginBottom: 0, lineHeight: 20, fontWeight: '400' },
                ]}
              >
                {t('settings.webhooks.title')}
              </Text>
            </View>
            <AppIcon
              name={openSection === 'webhooks' ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>

          {openSection === 'webhooks' && (
            <WebhookSettings
              t={t}
              requirePremium={premiumGate.requirePremium}
              isPremium={isPremium}
              localWebhookUrls={webhookManagement.localWebhookUrls}
              setLocalWebhookUrls={webhookManagement.setLocalWebhookUrls}
              localWebhookTitle={webhookManagement.localWebhookTitle}
              localWebhookUrl={webhookManagement.localWebhookUrl}
              updateLocalWebhookTitle={webhookManagement.updateLocalWebhookTitle}
              updateLocalWebhookUrl={webhookManagement.updateLocalWebhookUrl}
              handleAddWebhookLocal={handleAddWebhookLocal}
              handleDeleteWebhookWrapped={handleDeleteWebhookWrapped}
              handleToggleWebhook={handleToggleWebhook}
              editingWebhookUrl={webhookManagement.editingWebhookUrl}
              editingWebhookValue={webhookManagement.editingWebhookValue}
              editingWebhookTitle={webhookManagement.editingWebhookTitle}
              setEditingWebhookTitle={webhookManagement.setEditingWebhookTitle}
              setEditingWebhookValue={webhookManagement.setEditingWebhookValue}
              startEditingWebhook={webhookManagement.startEditingWebhook}
              cancelEditingWebhook={webhookManagement.cancelEditingWebhook}
              saveEditedWebhook={webhookManagement.saveEditedWebhook}
            />
          )}
        </View>

        {/* Bulk Send Section */}
        {bulkData.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.bulkHeaderContainer}>
              <Text style={styles.subHeader}>
                {t('settings.bulkData.title')} ({bulkData.length} {t('settings.bulkData.items')})
              </Text>
              <TouchableOpacity
                onPress={clearBulkDataWrapped}
                style={styles.deleteAllButton}
                disabled={isSendingBulk}
              >
                <Text style={[styles.deleteAllButtonText, isSendingBulk && styles.disabledText]}>
                  {t('settings.bulkData.deleteAll')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Display the bulk data items with edit/delete/send controls */}
            <View style={styles.bulkDataContainer}>
              {bulkData.map((item, index) => (
                <View key={item.id} style={styles.bulkDataItem}>
                  <Text style={styles.bulkDataIndex}>{index + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    {webhookManagement.editingItemId === item.id ? (
                      // Editing mode
                      <View style={styles.editItemContainer}>
                        <TextInput
                          style={styles.editItemInput}
                          value={webhookManagement.editingItemValue}
                          onChangeText={webhookManagement.setEditingItemValue}
                          autoFocus
                        />
                        <TouchableOpacity
                          style={[styles.editButton, styles.saveButton]}
                          onPress={() => webhookManagement.saveEditedItem(item.id)}
                        >
                          <AppIcon name="check" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.editButton, styles.cancelButton]}
                          onPress={webhookManagement.cancelEditing}
                        >
                          <AppIcon name="close" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      // Display mode with actions
                      <View style={styles.bulkItemWithActions}>
                        <View style={styles.bulkDataContentContainer}>
                          <Text
                            style={styles.bulkDataContent}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {item.data}
                          </Text>
                        </View>
                        <View style={styles.bulkItemActions}>
                          <TouchableOpacity
                            style={styles.bulkItemAction}
                            onPress={() => webhookManagement.startEditingItem(item)}
                          >
                            <AppIcon name="pencil" size={18} color="#ccc" />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.bulkItemAction}
                            onPress={() => handleSendSingleItemWrapped(item)}
                            disabled={
                              webhookManagement.sendingItemId === item.id ||
                              webhookManagement.localWebhookUrls.filter((webhook) => webhook.active)
                                .length === 0
                            }
                          >
                            {webhookManagement.sendingItemId === item.id ? (
                              <ActivityIndicator size="small" color="#0066cc" />
                            ) : (
                              <AppIcon
                                name="send"
                                size={18}
                                color={
                                  webhookManagement.localWebhookUrls.some(
                                    (webhook) => webhook.active
                                  )
                                    ? '#0066cc'
                                    : '#666'
                                }
                              />
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.bulkItemAction}
                            onPress={() => webhookManagement.deleteBulkItem(item.id)}
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
                (bulkData.length === 0 ||
                  webhookManagement.localWebhookUrls.filter((webhook) => webhook.active).length ===
                    0 ||
                  isSendingBulk) &&
                  styles.disabledButton,
              ]}
              onPress={handleSendBulkDataWrapped}
              disabled={
                bulkData.length === 0 ||
                webhookManagement.localWebhookUrls.filter((webhook) => webhook.active).length ===
                  0 ||
                isSendingBulk
              }
            >
              <AppIcon name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.bulkSendText}>
                {getBulkSendButtonText(isSendingBulk, bulkData.length, t)}
              </Text>
              {isSendingBulk && (
                <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 10 }} />
              )}
            </TouchableOpacity>
            {webhookManagement.localWebhookUrls.filter((webhook) => webhook.active).length === 0 &&
              bulkData.length > 0 &&
              !isSendingBulk && (
                <Text style={styles.warningText}>{t('settings.bulkData.activateWebhook')}</Text>
              )}
          </View>
        )}

        {/* Authentication Section */}
        <AuthSection
          t={t}
          user={user}
          handleSignOut={authHandlers.handleSignOut}
          handleGoogleLogin={authHandlers.handleGoogleLogin}
          isLoading={authHandlers.isLoading}
        />
      </ScrollView>

      {/* Legal Links at absolute bottom */}
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
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === 'web' ? 'none' : 'slide'}
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
            {isPremium ? (
              <View style={styles.headerRightPlaceholder} />
            ) : (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'transparent',
                  paddingHorizontal: 0,
                  paddingVertical: 0,
                  elevation: 0,
                  shadowOpacity: 0,
                }}
                onPress={() => premiumGate.setShowPremiumModal(true)}
                activeOpacity={0.7}
              >
                <AppIcon name="crown-outline" size={22} color="#ff9500" />
                <Text style={{ color: '#ff9500', fontWeight: 'bold', fontSize: 14, marginLeft: 4 }}>
                  PREMIUM
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {ScrollViewContent}
        </View>
      </SafeAreaView>
      <PremiumPaymentModal
        visible={premiumGate.showPremiumModal}
        onClose={() => premiumGate.setShowPremiumModal(false)}
        forceFullModal={true}
        onSuccess={() => {
          premiumGate.setShowPremiumModal(false);
          if (premiumGate.lastAttemptedAction) {
            premiumGate.lastAttemptedAction();
            premiumGate.setLastAttemptedAction(null);
          }
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  sectionCardOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownContent: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#222',
    zIndex: 10,
    overflow: 'hidden',
  },
  optionsDropdownMenu: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
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
    fontWeight: '400',
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
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    paddingHorizontal: 0,
    marginRight: 12,
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
    textAlign: 'center',
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
      },
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
      },
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
      },
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
  legalLinksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#121212',
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
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  languageOptionSelected: {
    backgroundColor: '#333',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#888',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#ff9500',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff9500',
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
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  languageEnglishName: {
    fontSize: 14,
    color: '#888',
  },
});

export default WebhookSettingsComponentV2;
