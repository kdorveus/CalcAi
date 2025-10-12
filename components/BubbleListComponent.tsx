import * as ExpoClipboard from 'expo-clipboard';
import React, { useCallback } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  Text,
  type TextStyle,
  ToastAndroid,
  Vibration,
  View,
  type ViewStyle,
} from 'react-native';

interface ChatBubble {
  id: string;
  type: 'user' | 'result' | 'error' | 'speech' | 'calc' | 'result-input';
  content: string;
}

interface BubbleListComponentProps {
  bubbles: ChatBubble[];
  keypadInput: string;
  interimTranscript: string;
  previewResult: string | null;
  vibrationEnabled: boolean;
  emptyComponent: React.ReactElement | null;
  t: (key: string) => string;
  setBubbles: React.Dispatch<React.SetStateAction<ChatBubble[]>>;
  bubbleIdRef: React.MutableRefObject<number>;
  styles: {
    chatArea: ViewStyle;
    userBubble: ViewStyle;
    userText: TextStyle;
    resultBubble: ViewStyle;
    resultText: TextStyle;
    errorBubble: ViewStyle;
    errorText: TextStyle;
    currentUserBubbleContainer: ViewStyle;
  };
}

const BubbleListComponent = React.forwardRef<FlatList, BubbleListComponentProps>(
  (
    {
      bubbles,
      keypadInput,
      interimTranscript,
      previewResult,
      vibrationEnabled,
      emptyComponent,
      t,
      setBubbles,
      bubbleIdRef,
      styles,
    },
    ref
  ) => {
    const renderBubble = useCallback(
      ({ item, index }: { item: ChatBubble; index: number }) => {
        const isLastBubble = index === bubbles.length - 1;
        const isCurrentUserBubble =
          item.type === 'user' && isLastBubble && item.content === keypadInput;

        const copyToClipboard = (text: string) => {
          if (Platform.OS === 'web') {
            navigator.clipboard?.writeText(text).catch(() => {});
          } else {
            ExpoClipboard.setStringAsync(text).catch(() => {});
          }
          // Add vibration feedback
          if (vibrationEnabled) {
            Vibration.vibrate(50);
          }

          if (Platform.OS === 'android') {
            ToastAndroid.showWithGravity(
              'Answer copied to clipboard',
              ToastAndroid.SHORT,
              ToastAndroid.TOP
            );
          } else {
            // For iOS and web, add a temporary bubble at the top
            setBubbles((prev) => [
              {
                id: (bubbleIdRef.current++).toString(),
                type: 'calc',
                content: t('mainApp.answerCopiedToClipboard'),
              },
              ...prev,
            ]);
            // Remove the notification bubble after 2 seconds
            setTimeout(() => {
              setBubbles((prev) => prev.slice(1));
            }, 2000);
          }
        };

        if (item.type === 'result') {
          return (
            <Pressable
              style={styles.resultBubble}
              onLongPress={() => copyToClipboard(item.content)}
              delayLongPress={500}
            >
              <Text style={styles.resultText}>{item.content}</Text>
            </Pressable>
          );
        }

        if (item.type === 'error') {
          // Special-case: show "No Equation Detected" messages like interim stream (gray text), not as a red error bubble
          // Check if content starts with any language version of "No Equation Detected"
          const isNoEquationError =
            item.content.startsWith('No Equation Detected') ||
            item.content.startsWith('No se Detectó Ecuación') ||
            item.content.startsWith('Aucune Équation Détectée') ||
            item.content.startsWith('Keine Gleichung Erkannt') ||
            item.content.startsWith('Nenhuma Equação Detectada') ||
            item.content.startsWith('Nessuna Equazione Rilevata');

          if (isNoEquationError) {
            return (
              <View style={styles.userBubble}>
                <Text style={[styles.userText, { color: '#999' }]}>{item.content}</Text>
              </View>
            );
          }
          return (
            <View style={styles.errorBubble}>
              <Text style={styles.errorText}>{item.content}</Text>
            </View>
          );
        }

        // result-input (special case for result in input field)
        if (item.type === 'result-input') {
          return (
            <View style={styles.currentUserBubbleContainer}>
              <View style={styles.userBubble}>
                <Text style={[styles.userText, { color: '#aaa' }]}>{item.content || ' '}</Text>
              </View>
            </View>
          );
        }

        // user
        if (item.type === 'user') {
          if (item.id === 'interim_speech') {
            return (
              <View style={styles.userBubble}>
                <Text style={[styles.userText, { color: '#999' }]}>{item.content}</Text>
              </View>
            );
          }
          if (isCurrentUserBubble) {
            return (
              <View style={styles.currentUserBubbleContainer}>
                <View style={styles.userBubble}>
                  <Text style={[styles.userText, interimTranscript ? { color: '#999' } : null]}>
                    {interimTranscript ? interimTranscript : item.content || ' '}
                  </Text>
                </View>
              </View>
            );
          } else {
            // Check if the content contains an equals sign
            const hasEquals = item.content.includes('=');
            if (hasEquals) {
              const parts = item.content.split('=');
              const answer = parts[parts.length - 1].trim();

              return (
                <Pressable
                  style={styles.userBubble}
                  onLongPress={() => copyToClipboard(answer)}
                  delayLongPress={500}
                >
                  <Text style={[styles.userText, { color: '#fff' }]}>{item.content}</Text>
                </Pressable>
              );
            }

            return (
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{item.content}</Text>
              </View>
            );
          }
        }

        return null;
      },
      [
        bubbles.length,
        keypadInput,
        vibrationEnabled,
        interimTranscript,
        t,
        setBubbles,
        bubbleIdRef,
        styles,
      ]
    );

    return (
      <FlatList
        style={{ flex: 1 }}
        ref={ref}
        data={
          interimTranscript
            ? [
                ...bubbles,
                { id: 'interim_speech', type: 'user' as const, content: interimTranscript },
              ]
            : previewResult
              ? [...bubbles, { id: 'preview', type: 'result' as const, content: previewResult }]
              : bubbles
        }
        renderItem={renderBubble}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatArea}
        onContentSizeChange={() => (ref as any)?.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={emptyComponent}
        getItemLayout={(_data, index) => ({
          length: 60,
          offset: 60 * index,
          index,
        })}
        windowSize={5}
        maxToRenderPerBatch={10}
        removeClippedSubviews={Platform.OS !== 'web'}
        initialNumToRender={15}
      />
    );
  }
);

BubbleListComponent.displayName = 'BubbleListComponent';

export default React.memo(BubbleListComponent);
