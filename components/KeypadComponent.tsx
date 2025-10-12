import React from 'react';
import {
  Platform,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import AppIcon from './AppIcon';

// Keypad layout constant
const KEYPAD_LAYOUT: string[][] = [
  ['↺', '()', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['^', '0', '.', 'CHECK_ICON'],
];

interface KeypadComponentProps {
  onKeypadPress: (key: string) => void;
  isWebMobile: boolean;
  styles: {
    calculatorArea: ViewStyle;
    calculatorAreaMobileWeb: ViewStyle;
    keypadContainer: ViewStyle;
    keypadRow: ViewStyle;
    keypadKeyWeb: ViewStyle;
    keypadKeyMobile: ViewStyle;
    keypadKeyOperator: ViewStyle;
    keypadKeyEnter: ViewStyle;
    keypadKeyWebMobile: ViewStyle;
    keypadKeyText: TextStyle;
  };
}

// Extracted helper function
const getButtonStyle = (
  key: string,
  isWebMobile: boolean,
  styles: KeypadComponentProps['styles']
): ViewStyle => {
  if (Platform.OS === 'web') {
    if (isWebMobile) {
      if (key === 'CHECK_ICON') return styles.keypadKeyEnter;
      if (['+', '-', '×', '÷', '()', '%', '^'].includes(key)) {
        return styles.keypadKeyOperator;
      }
      return styles.keypadKeyMobile;
    }
    return styles.keypadKeyWeb;
  }

  // Native mobile
  if (key === 'CHECK_ICON') return styles.keypadKeyEnter;
  if (['+', '-', '×', '÷'].includes(key)) return styles.keypadKeyOperator;
  return styles.keypadKeyMobile;
};

// Extracted component
const KeypadButton: React.FC<{
  keyValue: string;
  onPress: (key: string) => void;
  style: ViewStyle | ViewStyle[];
  styles: { keypadKeyText: TextStyle };
}> = ({ keyValue, onPress, style, styles }) => (
  <TouchableOpacity
    style={style}
    onPress={() => onPress(keyValue)}
    activeOpacity={0.7}
    delayPressIn={0}
  >
    {keyValue === '↺' ? (
      <AppIcon name="refresh" size={28} color="#eee" style={{ transform: [{ scaleX: -1 }] }} />
    ) : keyValue === 'CHECK_ICON' ? (
      <AppIcon name="send" size={24} color="#eee" />
    ) : (
      <Text style={styles.keypadKeyText}>{keyValue}</Text>
    )}
  </TouchableOpacity>
);

const KeypadComponentV2: React.FC<KeypadComponentProps> = ({
  onKeypadPress,
  isWebMobile,
  styles,
}) => {
  return (
    <View style={isWebMobile ? styles.calculatorAreaMobileWeb : styles.calculatorArea}>
      <TouchableOpacity
        style={{
          alignSelf: 'flex-end',
          padding: 10,
          marginRight: 20,
          marginBottom: 0,
        }}
        onPress={() => onKeypadPress('⌫')}
        activeOpacity={0.7}
        delayPressIn={0}
      >
        <AppIcon name="backspace" size={28} color="#eee" />
      </TouchableOpacity>
      <View style={styles.keypadContainer}>
        {KEYPAD_LAYOUT.map((row, i) => (
          <View key={i} style={styles.keypadRow}>
            {row.map((key) => {
              const buttonStyle = getButtonStyle(key, isWebMobile, styles);

              return (
                <KeypadButton
                  key={key}
                  keyValue={key}
                  onPress={onKeypadPress}
                  style={isWebMobile ? [buttonStyle, styles.keypadKeyWebMobile] : buttonStyle}
                  styles={styles}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

export default React.memo(KeypadComponentV2);
