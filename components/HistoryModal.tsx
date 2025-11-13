import type React from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { CalculationHistoryItem } from '../contexts/CalculationHistoryContext';
import { usePostHog } from '../contexts/PostHogContext';
import { usePremium } from '../contexts/PremiumContext';
import { useTranslation } from '../hooks/useTranslation';
// Using our bundled AppIcon component instead of MaterialCommunityIcons
import AppIcon from './AppIcon';
import PremiumPaymentModal from './PremiumPaymentModal';

interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
  history: CalculationHistoryItem[];
  onDelete: (created_at: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  isLoading: boolean;
  onSendToWebhook?: (expression: string, result: string) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  visible,
  onClose,
  history,
  onDelete,
  onClearAll,
  isLoading,
  onSendToWebhook,
}) => {
  const { checkPremiumStatus } = usePremium();
  const { t } = useTranslation();
  const { captureEvent } = usePostHog();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [webhookModalVisible, setWebhookModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CalculationHistoryItem | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  // Handle refreshing the history
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Handle deleting a calculation
  const handleDelete = (created_at: string) => {
    captureEvent('history_item_deleted');
    onDelete(created_at);
  };

  // Handle clearing all calculations
  const handleClearAll = () => {
    captureEvent('history_cleared_all');
    onClearAll();
    onClose();
  };

  // Handle sending a calculation to webhook
  const handleSendToWebhook = async (item: CalculationHistoryItem) => {
    const hasPremium = await checkPremiumStatus();
    if (!hasPremium) {
      setSelectedItem(item);
      setWebhookModalVisible(true);
      return;
    }
    if (onSendToWebhook) {
      onSendToWebhook(item.expression, item.result);
    }
  };

  // Handle webhook purchase success
  const handleWebhookSuccess = () => {
    if (selectedItem) {
      if (onSendToWebhook) {
        onSendToWebhook(selectedItem.expression, selectedItem.result);
      }
      setWebhookModalVisible(false);
      setSelectedItem(null);
    }
  };

  // Format the date for display (native JS, no date-fns)
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);

      // Format: Month Day at HH:MM AM/PM (e.g., "October 6 at 2:45 PM")
      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const monthName = monthNames[date.getMonth()];
      const day = date.getDate();

      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours || 12; // the hour '0' should be '12'

      return `${monthName} ${day} at ${hours}:${minutes} ${ampm}`;
    } catch {
      return t('history.unknownDate');
    }
  };

  // Render a calculation history item
  const renderItem = ({ item }: { item: CalculationHistoryItem }) => (
    <View style={styles.historyItem}>
      <View style={styles.historyItemContent}>
        <Text style={styles.expressionText}>{item.expression}</Text>
        <Text style={styles.resultText}>{item.result}</Text>
        <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
      </View>
      <View style={styles.historyItemActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleSendToWebhook(item)}>
          <AppIcon name="send" size={20} color="#0066cc" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.created_at)} style={styles.actionButton}>
          <AppIcon name="delete" size={20} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render the empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <AppIcon name="history" size={48} color="#666" />
      <Text style={styles.emptyStateText}>{t('history.noHistoryYet')}</Text>
      <Text style={styles.emptyStateSubtext}>{t('history.historySubtext')}</Text>
    </View>
  );

  return (
    <>
      <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.backButton} onPress={onClose}>
              <AppIcon name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>{t('history.calculationHistory')}</Text>

            {history.length > 0 ? (
              <View style={styles.tooltipContainer}>
                <Pressable
                  style={styles.clearButton}
                  onPress={handleClearAll}
                  onHoverIn={() => Platform.OS === 'web' && setHoveredTooltip('clearAll')}
                  onHoverOut={() => Platform.OS === 'web' && setHoveredTooltip(null)}
                >
                  <AppIcon
                    name="refresh"
                    size={24}
                    color="#888"
                    style={{ transform: [{ scaleX: -1 }] }}
                  />
                </Pressable>
                {hoveredTooltip === 'clearAll' && Platform.OS === 'web' && (
                  <View style={styles.tooltip}>
                    <Text style={styles.tooltipText}>{t('history.clearAll')}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.headerRightPlaceholder} />
            )}
          </View>

          {isLoading && !isRefreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.loadingText}>{t('history.loadingHistory')}</Text>
            </View>
          ) : (
            <FlatList
              data={history}
              renderItem={renderItem}
              keyExtractor={(item, index) => `${item.expression}-${item.result}-${index}`}
              contentContainerStyle={styles.historyList}
              ListEmptyComponent={renderEmptyState}
              onRefresh={handleRefresh}
              refreshing={isRefreshing}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Premium Payment Modal for Webhook */}
      <PremiumPaymentModal
        visible={webhookModalVisible}
        onClose={() => setWebhookModalVisible(false)}
        onSuccess={handleWebhookSuccess}
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  backButton: {
    padding: 8,
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#888',
    fontWeight: '600',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  tooltipContainer: {
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    top: 40,
    right: 0,
    minWidth: 120,
    alignItems: 'center',
    ...(Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.25)' },
      default: {
        elevation: 5,
      },
    }) as any),
    zIndex: 9999,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
  },
  historyList: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    marginVertical: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  historyItemContent: {
    flex: 1,
  },
  expressionText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  resultText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dateText: {
    color: '#888',
    fontSize: 12,
  },
  historyItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptyStateSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
});

export default HistoryModal;
