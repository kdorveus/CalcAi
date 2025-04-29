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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
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
}) => {
  // Auth state from context
  const { user, loading, signOut, authError } = useAuth(); // Use real context
  
  // Local state for webhooks
  const [localWebhookUrls, setLocalWebhookUrls] = useState<WebhookItem[]>(webhookUrls || []);
  
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
  const [editingWebhookUrl, setEditingWebhookUrl] = useState<string | null>(null);
  const [editingWebhookValue, setEditingWebhookValue] = useState<string>('');
  const [editingWebhookTitle, setEditingWebhookTitle] = useState<string>('');
  const [localWebhookTitle, setLocalWebhookTitle] = useState<string>(newWebhookTitle || '');
  const [localWebhookUrl, setLocalWebhookUrl] = useState<string>(newWebhookUrl || '');
  const [optionsOpen, setOptionsOpen] = useState<boolean>(false);
  const [webhookTitleOpen, setWebhookTitleOpen] = useState<boolean>(true); // Open webhook section by default
  const [authSectionOpen, setAuthSectionOpen] = useState<boolean>(true); // Open auth section by default
  
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
      console.log("Signing out...");
      await signOut(); // Use context signOut
      onClose(); // Close the modal first
      // No need to redirect here, _layout protection will handle it
      console.log("Sign out successful.");
    } catch (error: any) {
      console.error("Sign out error:", error);
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
  
  // Add local implementation that ensures webhooks are created
  const handleAddWebhookLocal = () => {
    const trimmedUrl = localWebhookUrl.trim();
    const trimmedTitle = localWebhookTitle.trim();
    
    console.log("Adding webhook - URL:", trimmedUrl, "Title:", trimmedTitle);
    
    // Basic validation
    if (!trimmedUrl) {
      Alert.alert("Error", "Please enter a webhook URL.");
      return;
    }
    
    // Validate URL format
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      Alert.alert("Invalid URL", "Webhook URL must start with http:// or https://");
      return;
    }
    
    // Check for duplicates
    if (localWebhookUrls.some(webhook => webhook.url === trimmedUrl)) {
      Alert.alert("Duplicate", "This webhook URL already exists.");
      return;
    }
    
    // Create the new webhook object
    const newWebhook = { 
      url: trimmedUrl, 
      active: true,
      title: trimmedTitle || undefined // Only include title if not empty
    };
    
    // Update the webhook URLs array
    const updatedWebhooks = [...localWebhookUrls, newWebhook];
    
    try {
      // Save to AsyncStorage
      AsyncStorage.setItem('webhookUrls', JSON.stringify(updatedWebhooks))
        .then(() => {
          // Update local state
          setLocalWebhookUrls(updatedWebhooks);
          
          // Call the parent handler to update parent state
          if (setWebhookUrls) {
            setWebhookUrls(updatedWebhooks);
          }
          
          // If parent handleAddWebhook exists, call it to handle any other logic
          if (handleAddWebhook) {
            handleAddWebhook();
          } else {
            // Clear the input fields
            setLocalWebhookUrl('');
            setLocalWebhookTitle('');
            if (setNewWebhookUrl) setNewWebhookUrl('');
            if (setNewWebhookTitle) setNewWebhookTitle('');
          }
          
          Alert.alert("Success", "Webhook added successfully!");
        })
        .catch(error => {
          console.error("Error saving webhooks:", error);
          Alert.alert("Error", "Failed to save webhook. Please try again.");
        });
    } catch (error) {
      console.error("Error in webhook add process:", error);
      Alert.alert("Error", "An unexpected error occurred while adding the webhook.");
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
    if (!editingWebhookValue.trim()) {
      Alert.alert('Invalid URL', 'Webhook URL cannot be empty.');
      return;
    }
    
    // Ensure it starts with http:// or https://
    if (!editingWebhookValue.trim().startsWith('http://') && !editingWebhookValue.trim().startsWith('https://')) {
      Alert.alert('Invalid URL', 'Webhook URL must start with http:// or https://');
      return;
    }
    
    if (
      localWebhookUrls.some(
        (w) => w.url === editingWebhookValue.trim() && w.url !== oldUrl
      )
    ) {
      Alert.alert('Duplicate URL', 'This webhook URL already exists.');
      return;
    }
    
    const updated = localWebhookUrls.map((w) =>
      w.url === oldUrl ? { 
        ...w, 
        url: editingWebhookValue.trim(), 
        title: editingWebhookTitle 
      } : w
    );
    
    try {
      console.log("Saving updated webhooks:", JSON.stringify(updated));
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
      console.error("Error saving webhook:", e);
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
      console.error("Error sending individual item:", error);
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
    // Find the item in the bulkData array
    const updatedBulkData = bulkData.map(item => 
      item.id === itemId ? { ...item, data: editingItemValue } : item
    );
    
    // Update the bulkData array in AsyncStorage
    AsyncStorage.setItem('bulkData', JSON.stringify(updatedBulkData))
      .then(() => {
        // Reset editing state
        setEditingItemId(null);
        setEditingItemValue('');
        setBulkData(updatedBulkData);
      })
      .catch((error: Error) => {
        console.error("Error saving edited item:", error);
        Alert.alert("Save Error", "An error occurred while saving the edited data.");
      });
  };
  
  // Function to delete a bulk data item
  const deleteBulkItem = (itemId: string | number) => {
    // Filter out the item from the bulkData array
    const updatedBulkData = bulkData.filter(item => item.id !== itemId);
    
    // Update the bulkData array in AsyncStorage
    AsyncStorage.setItem('bulkData', JSON.stringify(updatedBulkData))
      .then(() => {
        setBulkData(updatedBulkData);
      })
      .catch((error: Error) => {
        console.error("Error deleting item:", error);
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
                <Text style={styles.subHeader}>General Settings</Text>
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
                      onValueChange={() => toggleSpeechMute?.()}
                      trackColor={{ false: "#333", true: "#0066cc" }}
                      thumbColor={isSpeechMuted ? "#0066cc" : "#f4f3f4"}
                    />
                  </View>
                  <View style={styles.settingRowCompact}>
                    <Text style={styles.settingLabel}>New Line on Send</Text>
                    <Switch
                      value={enterKeyNewLine}
                      onValueChange={v => setEnterKeyNewLine?.(v)}
                      trackColor={{ false: "#333", true: "#0066cc" }}
                      thumbColor={enterKeyNewLine ? "#0066cc" : "#f4f3f4"}
                    />
                  </View>
                  {Platform.OS !== 'web' && (
                    <View style={styles.settingRowCompact}>
                      <Text style={styles.settingLabel}>Enable Vibration</Text>
                      <Switch
                        value={vibrationEnabled}
                        onValueChange={v => setVibrationEnabled?.(v)}
                        trackColor={{ false: "#333", true: "#0066cc" }}
                        thumbColor={vibrationEnabled ? "#0066cc" : "#f4f3f4"}
                      />
                    </View>
                  )}
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#333' }}>
                    <Text style={[styles.settingLabel, { color: '#888', fontSize: 14, marginBottom: 8 }]}>Settings</Text>
                  </View>
                  <View style={styles.settingRowCompact}>
                    <Text style={styles.settingLabel}>Send Answer Without Equation</Text>
                    <Switch
                      value={!sendEquation}
                      onValueChange={v => setSendEquation(!v)}
                      trackColor={{ false: "#333", true: "#0066cc" }}
                      thumbColor={!sendEquation ? "#0066cc" : "#f4f3f4"}
                    />
                  </View>
                  <View style={styles.settingRowCompact}>
                    <Text style={styles.settingLabel}>Queue Results for Manual Sending</Text>
                    <Switch
                      value={!streamResults}
                      onValueChange={v => setStreamResults(!v)}
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
                <FlatList
                  data={localWebhookUrls}
                  keyExtractor={(item) => item.url}
                  scrollEnabled={false}
                  renderItem={({ item }) => {
                    // Use explicit return View for both branches
                    if (editingWebhookUrl === item.url) {
                      // Editing mode
                      return (
                        // Apply base item styles + edit-specific styles
                        <View style={[styles.webhookItem, styles.sectionPadding, styles.webhookEditRow]}> 
                          <View style={styles.webhookEditInputsContainer}>
                            <TextInput
                              style={styles.webhookInput}
                              value={editingWebhookTitle}
                              onChangeText={setEditingWebhookTitle}
                              placeholder="Webhook title (optional)"
                              autoCapitalize="sentences"
                            />
                            <TextInput
                              style={styles.webhookInput}
                              value={editingWebhookValue}
                              onChangeText={setEditingWebhookValue}
                              autoFocus
                              keyboardType="url"
                            />
                          </View>
                          <TouchableOpacity
                            style={styles.saveButton}
                            onPress={() => saveEditedWebhook(item.url)}
                          >
                            <MaterialIcons name="check" size={20} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={cancelEditingWebhook}
                          >
                            <MaterialIcons name="close" size={20} color="#888888" />
                          </TouchableOpacity>
                        </View>
                      );
                    } else {
                      // Display mode (No fragment)
                      return (
                        // Apply base item styles
                        <View style={[styles.webhookItem, styles.sectionPadding]}> 
                          <Text style={styles.webhookUrlText} numberOfLines={1} ellipsizeMode="middle">
                            {item.title ? item.title : item.url}
                          </Text>
                          <View style={styles.webhookItemControls}>
                            <Switch
                              value={item.active}
                              onValueChange={(value) => {
                                handleToggleWebhook(item.url, value);
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
                                handleDeleteWebhook(item.url);
                                const updated = localWebhookUrls.filter(webhook => webhook.url !== item.url);
                                setLocalWebhookUrls(updated);
                              }}
                              style={styles.deleteButton}
                            >
                              <MaterialIcons name="close" size={20} color="#888888" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }
                  }}
                  style={styles.webhookList}
                />
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
                  onPress={clearBulkData} 
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
                              onPress={() => handleSendSingleItem(item)}
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
                onPress={handleSendBulkData}
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
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 }}
              onPress={() => setAuthSectionOpen((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="account-circle" size={20} color="#888" style={{ marginRight: 8 }} />
                <Text style={styles.subHeader}>Account</Text>
              </View>
              <View style={{ flex: 1 }} />
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
                      <View style={styles.profileInfo}>
                        <MaterialIcons name="account-circle" size={40} color="#0066cc" />
                        <View style={styles.userInfoContainer}>
                          {/* Display user email or other identifier */}
                          <Text style={styles.emailText} numberOfLines={1} ellipsizeMode="tail">{user.email || 'Authenticated User'}</Text>
                          {/* Optionally display user ID or other info */}
                          {/* <Text style={styles.userIdText}>ID: {user.id}</Text> */}
                        </View>
                      </View>
                      
                      <TouchableOpacity
                        style={styles.signOutButton}
                        onPress={handleSignOut} // Use the updated handleSignOut
                      >
                        <MaterialIcons name="logout" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.signOutButtonText}>Sign Out</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                     // Show login prompt or info if not logged in (though typically modal might not show)
                    <View style={styles.authContainer}>
                      <Text style={styles.authTitle}>Not Signed In</Text>
                       {/* Optionally add a button to trigger login if needed, though unusual in settings */}
                       {/* <TouchableOpacity style={styles.authButton} onPress={() => { onClose(); router.replace('/auth/login'); }}> */}
                       {/*   <Text style={styles.authButtonText}>Sign In</Text> */}
                       {/* </TouchableOpacity> */}
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
  );
  
  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === 'web' ? "fade" : "slide"}
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
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: '#fff',
    fontSize: 16,
  },
  authButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
    marginBottom: 20,
  },
  userInfoContainer: {
    marginLeft: 15,
    flex: 1,
  },
  emailText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userIdText: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  signOutButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
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
});

export default WebhookSettings;