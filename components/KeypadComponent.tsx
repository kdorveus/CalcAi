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

const KeypadComponent: React.FC<KeypadComponentProps> = ({
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
              // Determine the button style
              let buttonStyle: ViewStyle;
              if (Platform.OS === 'web') {
                if (isWebMobile) {
                  // WEB MOBILE: Apply native mobile styles directly
                  if (key === 'CHECK_ICON') {
                    buttonStyle = styles.keypadKeyEnter;
                  } else if (['+', '-', '×', '÷', '()', '%', '^'].includes(key)) {
                    buttonStyle = styles.keypadKeyOperator;
                  } else {
                    buttonStyle = styles.keypadKeyMobile;
                  }
                } else {
                  // DESKTOP WEB: Use transparent web style
                  buttonStyle = styles.keypadKeyWeb;
                }
              } else {
                // NATIVE MOBILE: Existing logic (unchanged)
                if (key === 'CHECK_ICON') {
                  buttonStyle = styles.keypadKeyEnter;
                } else if (['+', '-', '×', '÷'].includes(key)) {
                  buttonStyle = styles.keypadKeyOperator;
                } else {
                  buttonStyle = styles.keypadKeyMobile;
                }
              }

              return (
                <TouchableOpacity
                  key={key}
                  style={[buttonStyle, isWebMobile && styles.keypadKeyWebMobile]}
                  onPress={() => onKeypadPress(key)}
                  activeOpacity={0.7}
                  delayPressIn={0}
                >
                  {key === '↺' ? (
                    <AppIcon
                      name="refresh"
                      size={28}
                      color="#eee"
                      style={{ transform: [{ scaleX: -1 }] }}
                    />
                  ) : key === 'CHECK_ICON' ? (
                    <AppIcon name="send" size={24} color="#eee" />
                  ) : (
                    <Text style={styles.keypadKeyText}>{key}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

export default React.memo(KeypadComponent);
