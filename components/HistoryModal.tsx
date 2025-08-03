import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
// Using our bundled AppIcon component instead of MaterialCommunityIcons
import AppIcon from './AppIcon';
import { useCalculationHistory, CalculationHistoryItem } from '../contexts/CalculationHistoryContext';
import { usePremium } from '../contexts/PremiumContext';
import PremiumPaymentModal from './PremiumPaymentModal';

interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
  history: CalculationHistoryItem[];
  onDelete: (expression: string, result: string, created_at: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  onSelect: (item: CalculationHistoryItem) => void;
  isLoading: boolean;
  onSendToWebhook?: (expression: string, result: string) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  visible,
  onClose,
  onSelect,
  onSendToWebhook,
}) => {
  const { history: contextHistory, deleteCalculation, clearAllCalculations, loading } = useCalculationHistory();
  const { isPremium, checkPremiumStatus } = usePremium();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [webhookModalVisible, setWebhookModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CalculationHistoryItem | null>(null);

  // Handle refreshing the history
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Handle deleting a calculation
  const handleDelete = (expression: string, result: string, created_at: string) => {
    Alert.alert(
      "Delete Calculation",
      "Are you sure you want to delete this calculation?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          onPress: () => deleteCalculation(expression, result, created_at),
          style: "destructive"
        }
      ]
    );
  };

  // Handle clearing all calculations
  const handleClearAll = () => {
    Alert.alert(
      "Clear All Calculations",
      "Are you sure you want to delete all calculations? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
          onPress: () => clearAllCalculations(),
          style: "destructive"
        }
      ]
    );
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
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      
      // Format: Day, Month DD, YYYY at HH:MM AM/PM
      const dayName = days[date.getDay()];
      const monthName = months[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      
      return `${dayName}, ${monthName} ${day}, ${year} at ${hours}:${minutes} ${ampm}`;
    } catch (error) {
      return 'Unknown date';
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
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleSendToWebhook(item)}
        >
          <AppIcon name="send" size={20} color="#0066cc" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDelete(item.expression, item.result, item.created_at)}
        >
          <AppIcon name="delete" size={20} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render the empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <AppIcon name="history" size={48} color="#666" />
      <Text style={styles.emptyStateText}>No calculation history yet</Text>
      <Text style={styles.emptyStateSubtext}>Your calculations will appear here</Text>
    </View>
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Calculation History</Text>
            <View style={styles.headerButtons}>
              {contextHistory.length > 0 && (
                <TouchableOpacity 
                  style={styles.clearButton}
                  onPress={handleClearAll}
                >
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={onClose}
              >
                <AppIcon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {loading && !isRefreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : (
            <FlatList
              data={contextHistory}
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
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    marginRight: 16,
  },
  clearButtonText: {
    color: '#888',
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
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
