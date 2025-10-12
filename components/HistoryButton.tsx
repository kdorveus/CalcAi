import type React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCalculationHistory } from '../contexts/CalculationHistoryContext';
// Using our bundled AppIcon component instead of MaterialCommunityIcons
import AppIcon from './AppIcon';

interface HistoryButtonProps {
  onPress: () => void;
}

const HistoryButton: React.FC<HistoryButtonProps> = ({ onPress }) => {
  const { history } = useCalculationHistory();
  const hasHistory = history.length > 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <AppIcon name="history" size={24} color="#fff" />
      {hasHistory && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{history.length > 99 ? '99+' : history.length}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default HistoryButton;
