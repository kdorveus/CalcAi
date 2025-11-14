import type React from 'react';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

export interface UseKeyboardHandlersParams {
  isRecording: boolean;
  setIsRecording: (value: boolean | ((prev: boolean) => boolean)) => void;
  startRecording: () => void;
  onKeypadPress: (key: string) => void;
  toggleSpeechMute: () => void;
  setBubbles: React.Dispatch<React.SetStateAction<any[]>>;
  setKeypadInput: (value: string | ((prev: string) => string)) => void;
  setPreviewResult: (value: string | null) => void;
}

export function useKeyboardHandlers({
  isRecording,
  setIsRecording,
  startRecording,
  onKeypadPress,
  toggleSpeechMute,
  setBubbles,
  setKeypadInput,
  setPreviewResult,
}: UseKeyboardHandlersParams): void {
  // Helper: Handle spacebar recording toggle
  const handleSpacebarRecording = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      if (isRecording) {
        setIsRecording(false);
      } else {
        startRecording();
      }
    },
    [isRecording, setIsRecording, startRecording]
  );

  // Helper: Handle paste operation
  const handlePasteOperation = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const filtered = text.replace(/[^0-9+\-*/.()%^]/g, '');
        if (filtered) {
          for (const char of filtered.split('')) {
            onKeypadPress(char);
          }
        }
      });
    },
    [onKeypadPress]
  );

  // Helper: Handle calculator reset
  const handleCalculatorReset = useCallback(
    (e: KeyboardEvent) => {
      setBubbles([]);
      setKeypadInput('');
      setPreviewResult(null);
      e.preventDefault();
    },
    [setBubbles, setKeypadInput, setPreviewResult]
  );

  // Helper: Map and handle calculator keys
  const handleCalculatorKey = useCallback(
    (e: KeyboardEvent) => {
      const allowed = [
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '+',
        '-',
        '×',
        '÷',
        '.',
        '(',
        ')',
        '%',
        '^',
        '√',
      ];
      let key = e.key;
      if (key === '*') key = '×';
      if (key.toLowerCase() === 'x') key = '×';
      if (key === '/') key = '÷';

      if (allowed.includes(key) || key === 'Backspace' || key === 'Enter') {
        if (key === 'Backspace') {
          onKeypadPress('⌫');
        } else if (key === 'Enter') {
          onKeypadPress('=');
        } else {
          onKeypadPress(key);
        }
        e.preventDefault();
      }
    },
    [onKeypadPress]
  );

  // Consolidated web keyboard handling (space to record, paste, keypad, mute, reset)
  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        handleSpacebarRecording(e);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        handlePasteOperation(e);
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        toggleSpeechMute();
        return;
      }

      if (e.key === 'Backspace' && e.ctrlKey) {
        handleCalculatorReset(e);
        return;
      }

      handleCalculatorKey(e);
    },
    [
      toggleSpeechMute,
      handleSpacebarRecording,
      handlePasteOperation,
      handleCalculatorReset,
      handleCalculatorKey,
    ]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    globalThis.window.addEventListener('keydown', handleGlobalKeyDown);
    return () => globalThis.window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);
}
