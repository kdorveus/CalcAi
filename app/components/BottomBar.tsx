import type React from 'react';
import { Platform, Pressable, Text, TouchableOpacity, View } from 'react-native';
import AppIcon from '../../components/AppIcon';

interface BottomBarProps {
  isWebMobile: boolean;
  isRecording: boolean;
  hoveredTooltip: string | null;
  t: (key: string) => string;
  setShowKeypad: (value: boolean | ((prev: boolean) => boolean)) => void;
  setIsSettingsModalVisible: (value: boolean) => void;
  toggleTooltip: (tooltipId: string | null) => void;
  startRecording: () => void;
  stopRecording: () => void;
  webhookManager: {
    streamResults: boolean;
    bulkData: Array<{ id: number; data: string }>;
    webhookUrls: Array<{ url: string; title?: string; active: boolean }>;
  };
  styles: {
    bottomBar: any;
    bottomBarWebMobile: any;
    bottomButton: any;
    micButton: any;
    micButtonWebMobile: any;
    tooltipContainer: any;
    bulkBadge: any;
    bulkBadgeText: any;
    webhookTooltip: any;
    webhookTooltipItem: any;
    tooltipText: any;
    webhookTooltipText: any;
  };
}

export const BottomBar: React.FC<BottomBarProps> = ({
  isWebMobile,
  isRecording,
  hoveredTooltip,
  t,
  setShowKeypad,
  setIsSettingsModalVisible,
  toggleTooltip,
  startRecording,
  stopRecording,
  webhookManager,
  styles,
}) => {
  return (
    <View style={[styles.bottomBar, isWebMobile && styles.bottomBarWebMobile]}>
      <TouchableOpacity onPress={() => setShowKeypad((s) => !s)} style={styles.bottomButton}>
        <AppIcon name="calculator" size={28} color="#ccc" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.micButton, // Base style
          isRecording ? { backgroundColor: '#cc0000' } : {}, // Red if recording
          isWebMobile && styles.micButtonWebMobile, // Additional styles for web mobile
        ]}
        onPress={() => {
          if (isRecording) {
            stopRecording();
          } else {
            startRecording();
          }
        }}
      >
        <AppIcon
          name={isRecording ? 'microphone-off' : 'microphone'}
          size={isWebMobile ? 40 : 60}
          color={'#eee'}
        />
      </TouchableOpacity>
      {/* Webhook Icon with tooltip */}
      <View style={styles.tooltipContainer}>
        <Pressable
          onPress={() => setIsSettingsModalVisible(true)}
          style={styles.bottomButton}
          onHoverIn={() => Platform.OS === 'web' && toggleTooltip('settings')}
          onHoverOut={() => Platform.OS === 'web' && toggleTooltip(null)}
        >
          <View>
            <AppIcon name="cog" size={28} color="#ccc" />
            {!webhookManager.streamResults && webhookManager.bulkData.length > 0 && (
              <View style={styles.bulkBadge}>
                <Text style={styles.bulkBadgeText}>{webhookManager.bulkData.length}</Text>
              </View>
            )}
          </View>
        </Pressable>

        {/* Simple Webhook Tooltip */}
        {Platform.OS === 'web' && hoveredTooltip === 'webhook' && (
          <View style={styles.webhookTooltip}>
            {/* Active Webhooks Section */}
            {webhookManager.webhookUrls.some((webhook) => webhook.active) ? (
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <AppIcon name="webhook" size={16} color="#888" style={{ marginRight: 5 }} />
                  <Text
                    style={[
                      styles.tooltipText,
                      { fontWeight: 'bold', fontSize: 16, color: '#888' },
                    ]}
                  >
                    {t('mainApp.activeWebhooks')}
                  </Text>
                </View>
                {webhookManager.webhookUrls
                  .filter((webhook) => webhook.active)
                  .map((webhook) => (
                    <View key={webhook.url} style={styles.webhookTooltipItem}>
                      <Text
                        style={[styles.webhookTooltipText, { fontSize: 13 }]}
                        numberOfLines={1}
                        ellipsizeMode="middle"
                      >
                        {webhook.title || webhook.url}
                      </Text>
                    </View>
                  ))}
              </View>
            ) : (
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <AppIcon name="webhook" size={16} color="#888" style={{ marginRight: 5 }} />
                  <Text
                    style={[
                      styles.tooltipText,
                      { fontWeight: 'bold', fontSize: 16, color: '#888' },
                    ]}
                  >
                    {t('mainApp.activeWebhooks')}
                  </Text>
                </View>
                <Text style={[styles.tooltipText, { fontSize: 13 }]}>{t('mainApp.none')}</Text>
              </View>
            )}

            {/* Bulk data info */}
            {!webhookManager.streamResults && webhookManager.bulkData.length > 0 && (
              <View>
                <Text
                  style={[
                    styles.tooltipText,
                    { fontWeight: 'bold', fontSize: 16, color: '#888', marginBottom: 8 },
                  ]}
                >
                  {t('mainApp.dataQueue')}
                </Text>
                {webhookManager.bulkData.map((item) => (
                  <Text
                    key={item.id}
                    style={[
                      styles.tooltipText,
                      {
                        fontSize: 13,
                        paddingVertical: 3,
                        backgroundColor: item.id % 2 === 0 ? 'transparent' : '#333333',
                        marginBottom: 1,
                      },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {item.data}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
};
