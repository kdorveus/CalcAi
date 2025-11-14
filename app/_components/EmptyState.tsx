import type React from 'react';
import { Text, View } from 'react-native';
import AppIcon from '../../components/AppIcon';

interface EmptyStateProps {
  t: (key: string) => string;
  styles: {
    emptyStateItem: any;
    emptyStateText: any;
  };
}

// Wrapper component for Web Empty State
export const WebEmptyState: React.FC<EmptyStateProps> = ({ t, styles }) => {
  return (
    <>
      <View style={styles.emptyStateItem}>
        <AppIcon name="keyboard-space" size={24} color="#ffffff" />
        <Text style={styles.emptyStateText}>{t('mainApp.pressSpaceToRecord')}</Text>
      </View>
      <View style={styles.emptyStateItem}>
        <AppIcon name="send" size={24} color="#ffffff" />
        <Text style={styles.emptyStateText}>{t('mainApp.pressSendToConfirm')}</Text>
      </View>
      <View style={styles.emptyStateItem}>
        <AppIcon name="webhook" size={24} color="#ffffff" />
        <Text style={styles.emptyStateText}>{t('mainApp.useWebhookForSheets')}</Text>
      </View>
    </>
  );
};

// Wrapper component for Mobile Empty State
export const MobileEmptyState: React.FC<EmptyStateProps> = ({ t, styles }) => {
  return (
    <>
      <View style={styles.emptyStateItem}>
        <AppIcon name="microphone" size={24} color="#ffffff" />
        <Text style={styles.emptyStateText}>{t('mainApp.pressRecordIcon')}</Text>
      </View>
      <View style={styles.emptyStateItem}>
        <AppIcon name="send" size={24} color="#ffffff" />
        <Text style={styles.emptyStateText}>{t('mainApp.pressSendToConfirm')}</Text>
      </View>
      <View style={styles.emptyStateItem}>
        <AppIcon name="webhook" size={24} color="#ffffff" />
        <Text style={styles.emptyStateText}>{t('mainApp.useWebhookToSend')}</Text>
      </View>
    </>
  );
};
