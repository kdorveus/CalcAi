import type React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import AppIcon from '../../components/AppIcon';
import HistoryButton from '../../components/HistoryButton';
import type { ChatBubble } from '../../types';

interface HeaderControlsProps {
  bubbles: ChatBubble[];
  showKeypad: boolean;
  hoveredTooltip: string | null;
  t: (key: string) => string;
  setBubbles: React.Dispatch<React.SetStateAction<ChatBubble[]>>;
  setKeypadInput: (value: string | ((prev: string) => string)) => void;
  setPreviewResult: (value: string | null) => void;
  setShowHistoryModal: (value: boolean) => void;
  toggleTooltip: (tooltipId: string | null) => void;
  styles: {
    headerControls: any;
    tooltipContainer: any;
    resetButton: any;
    tooltip: any;
    tooltipText: any;
  };
}

export const HeaderControls: React.FC<HeaderControlsProps> = ({
  bubbles,
  showKeypad,
  hoveredTooltip,
  t,
  setBubbles,
  setKeypadInput,
  setPreviewResult,
  setShowHistoryModal,
  toggleTooltip,
  styles,
}) => {
  return (
    <View style={styles.headerControls}>
      {/* Reset Button: only show if there is at least one bubble AND keyboard is off */}
      {bubbles.length > 0 && !showKeypad && (
        <View style={styles.tooltipContainer}>
          <Pressable
            onPress={() => {
              setBubbles([]);
              setKeypadInput('');
              setPreviewResult(null);
            }}
            style={styles.resetButton}
            onHoverIn={() => Platform.OS === 'web' && toggleTooltip('reset')}
            onHoverOut={() => Platform.OS === 'web' && toggleTooltip(null)}
          >
            <AppIcon
              name="refresh"
              size={24}
              color="#888"
              style={{ transform: [{ scaleX: -1 }] }}
            />
          </Pressable>
          {hoveredTooltip === 'reset' && Platform.OS === 'web' && (
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>{t('mainApp.resetCtrlBackspace')}</Text>
            </View>
          )}
        </View>
      )}
      {/* History Button: always show */}
      <View style={styles.tooltipContainer}>
        <Pressable
          onPress={() => setShowHistoryModal(true)}
          onHoverIn={() => Platform.OS === 'web' && toggleTooltip('history')}
          onHoverOut={() => Platform.OS === 'web' && toggleTooltip(null)}
        >
          <HistoryButton onPress={() => setShowHistoryModal(true)} />
        </Pressable>
        {hoveredTooltip === 'history' && Platform.OS === 'web' && (
          <View style={styles.tooltip}>
            <Text style={styles.tooltipText}>{t('history.calculationHistory')}</Text>
          </View>
        )}
      </View>
    </View>
  );
};
