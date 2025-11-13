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

// Extracted helper function
const isNoEquationError = (content: string): boolean => {
  const noEquationPhrases = [
    'No Equation Detected',
    'No se Detectó Ecuación',
    'Aucune Équation Détectée',
    'Keine Gleichung Erkannt',
    'Nenhuma Equação Detectada',
    'Nessuna Equazione Rilevata',
  ];
  return noEquationPhrases.some((phrase) => content.startsWith(phrase));
};

// Extracted components
const ResultBubble: React.FC<{
  item: ChatBubble;
  onCopy: (text: string) => void;
  styles: { resultBubble: ViewStyle; resultText: TextStyle };
}> = ({ item, onCopy, styles }) => (
  <Pressable
    style={styles.resultBubble}
    onLongPress={() => onCopy(item.content)}
    delayLongPress={500}
  >
    <Text style={styles.resultText}>{item.content}</Text>
  </Pressable>
);

const ErrorBubble: React.FC<{
  item: ChatBubble;
  styles: {
    userBubble: ViewStyle;
    userText: TextStyle;
    errorBubble: ViewStyle;
    errorText: TextStyle;
  };
}> = ({ item, styles }) => {
  if (isNoEquationError(item.content)) {
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
};

const UserBubble: React.FC<{
  item: ChatBubble;
  isLast: boolean;
  keypadInput: string;
  interimTranscript: string;
  onCopy: (text: string) => void;
  styles: {
    userBubble: ViewStyle;
    userText: TextStyle;
    currentUserBubbleContainer: ViewStyle;
  };
}> = ({ item, isLast, keypadInput, interimTranscript, onCopy, styles }) => {
  const isCurrentUserBubble = item.type === 'user' && isLast && item.content === keypadInput;

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
  }

  // Check if the content contains an equals sign
  const hasEquals = item.content.includes('=');
  if (hasEquals) {
    const parts = item.content.split('=');
    const answer = parts[parts.length - 1].trim();

    return (
      <Pressable style={styles.userBubble} onLongPress={() => onCopy(answer)} delayLongPress={500}>
        <Text style={[styles.userText, { color: '#fff' }]}>{item.content}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.userBubble}>
      <Text style={styles.userText}>{item.content}</Text>
    </View>
  );
};

const BubbleListComponentV2 = React.forwardRef<FlatList, BubbleListComponentProps>(
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
    const copyToClipboard = useCallback(
      (text: string) => {
        if (Platform.OS === 'web') {
          navigator.clipboard?.writeText(text).catch(() => {});
        } else {
          ExpoClipboard.setStringAsync(text).catch(() => {});
        }

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
          setBubbles((prev) => [
            {
              id: (bubbleIdRef.current++).toString(),
              type: 'calc',
              content: t('mainApp.answerCopiedToClipboard'),
            },
            ...prev,
          ]);
          setTimeout(() => {
            setBubbles((prev) => prev.slice(1));
          }, 2000);
        }
      },
      [vibrationEnabled, t, setBubbles, bubbleIdRef]
    );

    const renderBubble = useCallback(
      ({ item, index }: { item: ChatBubble; index: number }) => {
        const isLastBubble = index === bubbles.length - 1;

        if (item.type === 'result') {
          return <ResultBubble item={item} onCopy={copyToClipboard} styles={styles} />;
        }

        if (item.type === 'error') {
          return <ErrorBubble item={item} styles={styles} />;
        }

        if (item.type === 'result-input') {
          return (
            <View style={styles.currentUserBubbleContainer}>
              <View style={styles.userBubble}>
                <Text style={[styles.userText, { color: '#aaa' }]}>{item.content || ' '}</Text>
              </View>
            </View>
          );
        }

        if (item.type === 'user') {
          return (
            <UserBubble
              item={item}
              isLast={isLastBubble}
              keypadInput={keypadInput}
              interimTranscript={interimTranscript}
              onCopy={copyToClipboard}
              styles={styles}
            />
          );
        }

        return null;
      },
      [bubbles.length, keypadInput, interimTranscript, copyToClipboard, styles]
    );

    return (
      <FlatList
        style={{ flex: 1 }}
        ref={ref}
        data={(() => {
          if (interimTranscript) {
            return [
              ...bubbles,
              { id: 'interim_speech', type: 'user' as const, content: interimTranscript },
            ];
          }
          if (previewResult) {
            return [...bubbles, { id: 'preview', type: 'result' as const, content: previewResult }];
          }
          return bubbles;
        })()}
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

BubbleListComponentV2.displayName = 'BubbleListComponentV2';

export default React.memo(BubbleListComponentV2);
