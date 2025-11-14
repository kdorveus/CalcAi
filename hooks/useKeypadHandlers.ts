import type React from 'react';
import { useCallback, useMemo } from 'react';
import { Vibration } from 'react-native';
import type { ChatBubble } from '../types';
import { MATH_ERROR } from '../utils/calculationUtils';

export interface UseKeypadHandlersParams {
  keypadInput: string;
  setKeypadInput: (value: string | ((prev: string) => string)) => void;
  bubbles: ChatBubble[];
  setBubbles: React.Dispatch<React.SetStateAction<ChatBubble[]>>;
  bubbleIdRef: React.MutableRefObject<number>;
  previewResult: string | null;
  setPreviewResult: (value: string | null) => void;
  expectingFreshInput: boolean;
  setExpectingFreshInput: (value: boolean) => void;
  vibrationEnabled: boolean;
  scrollToBottom: (delay?: number) => void;
  handleInput: (val: string, type: 'user' | 'keypad' | 'speech') => string;
  handleCalculationResult: (equation: string, result: string, source: 'keypad' | 'speech') => void;
  t: (key: string) => string;
}

export interface UseKeypadHandlersReturn {
  onKeypadPress: (key: string) => void;
}

export function useKeypadHandlers({
  keypadInput,
  setKeypadInput,
  bubbles: _bubbles,
  setBubbles,
  bubbleIdRef,
  previewResult: _previewResult,
  setPreviewResult,
  expectingFreshInput,
  setExpectingFreshInput,
  vibrationEnabled,
  scrollToBottom,
  handleInput,
  handleCalculationResult,
  t,
}: UseKeypadHandlersParams): UseKeypadHandlersReturn {
  const handleResetKey = useCallback(
    (_key: string) => {
      setBubbles([]);
      setKeypadInput('');
      setPreviewResult(null);
      scrollToBottom(50);
    },
    [setBubbles, setKeypadInput, setPreviewResult, scrollToBottom]
  );

  const handleExpectingFreshInput = useCallback(
    (key: string) => {
      const isEnterOrCheck = key === '=' || key === 'ok' || key === 'CHECK_ICON';
      const isBackspace = key === '⌫';
      const isClearingKey = isEnterOrCheck || isBackspace;

      // Case 1: Enter/Check/Backspace - clear input and start new
      if (isClearingKey) {
        setKeypadInput('');
        setPreviewResult(null);

        setBubbles((prev) => {
          const filtered = prev.filter((b) => b.type !== 'result-input');
          return [
            ...filtered,
            { id: (bubbleIdRef.current++).toString(), type: 'user', content: '' },
          ];
        });
      } else {
        // Case 2: Any other key - confirm result and continue
        const currentResult = keypadInput;
        const newInput = currentResult + key;
        setKeypadInput(newInput);

        setBubbles((prev) => {
          const filtered = prev.filter((b) => b.type !== 'result-input');
          return [
            ...filtered,
            { id: (bubbleIdRef.current++).toString(), type: 'user', content: newInput },
          ];
        });
      }

      setExpectingFreshInput(false);
      scrollToBottom(50);
      return true; // Signal handled
    },
    [
      keypadInput,
      setKeypadInput,
      setPreviewResult,
      setBubbles,
      bubbleIdRef,
      setExpectingFreshInput,
      scrollToBottom,
    ]
  );

  const handleDotKey = useCallback(() => {
    const newInput = `${keypadInput}.`;
    setKeypadInput(newInput);
    setBubbles((prev) => {
      const others = prev.filter((b) => b.type !== 'user' || b.content !== keypadInput);
      return [
        ...others,
        { id: (bubbleIdRef.current++).toString(), type: 'user', content: newInput },
      ];
    });
    scrollToBottom(50);
  }, [keypadInput, setKeypadInput, setBubbles, bubbleIdRef, scrollToBottom]);

  const handleClearKey = useCallback(() => {
    setKeypadInput('');
    setBubbles((prev) => prev.filter((b) => b.type !== 'user' || b.content !== keypadInput));
    scrollToBottom(50);
  }, [keypadInput, setKeypadInput, setBubbles, scrollToBottom]);

  const handleBackspaceKey = useCallback(() => {
    const newInput = keypadInput.slice(0, -1);
    setKeypadInput(newInput);
    setBubbles((prev) => {
      const others = prev.filter((b) => b.type !== 'user' || b.content !== keypadInput);
      if (newInput) {
        return [
          ...others,
          { id: (bubbleIdRef.current++).toString(), type: 'user', content: newInput },
        ];
      }
      return others;
    });
    scrollToBottom(50);
  }, [keypadInput, setKeypadInput, setBubbles, bubbleIdRef, scrollToBottom]);

  const handleShiftBackspace = useCallback(() => {
    setBubbles([]);
    setKeypadInput('');
    setPreviewResult(null);
    scrollToBottom(100);
  }, [setBubbles, setKeypadInput, setPreviewResult, scrollToBottom]);

  const handleParenthesesKey = useCallback(() => {
    const open = (keypadInput.match(/\(/g) || []).length;
    const close = (keypadInput.match(/\)/g) || []).length;
    const newInput = open > close ? `${keypadInput})` : `${keypadInput}(`;
    setKeypadInput(newInput);
    setBubbles((prev) => {
      const others = prev.filter((b) => b.type !== 'user' || b.content !== keypadInput);
      return [
        ...others,
        { id: (bubbleIdRef.current++).toString(), type: 'user', content: newInput },
      ];
    });
    scrollToBottom(50);
  }, [keypadInput, setKeypadInput, setBubbles, bubbleIdRef, scrollToBottom]);

  const handlePercentKey = useCallback(() => {
    const newInput = `${keypadInput}%`;
    setKeypadInput(newInput);
    setBubbles((prev) => {
      const others = prev.filter((b) => b.type !== 'user' || b.content !== keypadInput);
      return [
        ...others,
        { id: (bubbleIdRef.current++).toString(), type: 'user', content: newInput },
      ];
    });
    scrollToBottom(50);
  }, [keypadInput, setKeypadInput, setBubbles, bubbleIdRef, scrollToBottom]);

  const handleEqualsKey = useCallback(
    (_key: string) => {
      const expressionToCalc = keypadInput;
      const result = handleInput(expressionToCalc, 'keypad');

      if (result === MATH_ERROR) {
        const errorBubble: ChatBubble = {
          id: (bubbleIdRef.current++).toString(),
          type: 'error',
          content: t('mainApp.mathErrors.error'),
        };
        setBubbles((prev) => [...prev, errorBubble]);
        setKeypadInput('');
        setPreviewResult(null);
        setExpectingFreshInput(false);
        scrollToBottom(50);
        return;
      }
      handleCalculationResult(expressionToCalc, result, 'keypad');
      scrollToBottom(50);
    },
    [
      keypadInput,
      handleInput,
      handleCalculationResult,
      t,
      setBubbles,
      bubbleIdRef,
      setKeypadInput,
      setPreviewResult,
      setExpectingFreshInput,
      scrollToBottom,
    ]
  );

  const handleRegularKey = useCallback(
    (key: string) => {
      const newInput = `${keypadInput}${key}`;
      setKeypadInput(newInput);
      setBubbles((prev) => {
        const others = prev.filter((b) => b.type !== 'user' || b.content !== keypadInput);
        return [
          ...others,
          { id: (bubbleIdRef.current++).toString(), type: 'user', content: newInput },
        ];
      });
      scrollToBottom(50);
    },
    [keypadInput, setKeypadInput, setBubbles, bubbleIdRef, scrollToBottom]
  );

  // Key handler map (memoized for stable references)
  const keyHandlers = useMemo<Record<string, ((key: string) => boolean) | ((key: string) => void)>>(
    () => ({
      '↺': handleResetKey,
      '.': handleDotKey,
      C: handleClearKey,
      '⌫': handleBackspaceKey,
      SHIFT_BACKSPACE: handleShiftBackspace,
      '()': handleParenthesesKey,
      '%': handlePercentKey,
      ok: handleEqualsKey,
      '=': handleEqualsKey,
    }),
    [
      handleResetKey,
      handleDotKey,
      handleClearKey,
      handleBackspaceKey,
      handleShiftBackspace,
      handleParenthesesKey,
      handlePercentKey,
      handleEqualsKey,
    ]
  );

  const onKeypadPress = useCallback(
    (key: string) => {
      if (vibrationEnabled) {
        Vibration.vibrate(5);
      }

      // Convert CHECK_ICON to 'ok' for simpler handling
      if (key === 'CHECK_ICON') {
        key = 'ok';
      }

      // Define helper variables for better readability
      const isEnterOrCheck = key === '=' || key === 'ok' || key === 'CHECK_ICON';
      const isBackspace = key === '⌫';
      const isClearingKey = isEnterOrCheck || isBackspace;

      // Check for digit limit (BEFORE expectingFreshInput check)
      if (!isClearingKey && /\d/.test(key)) {
        const digitCount = keypadInput.replace(/[^\d]/g, '').length;
        if (digitCount >= 100) {
          setBubbles((prev) => [
            ...prev,
            {
              id: (bubbleIdRef.current++).toString(),
              type: 'error',
              content: t('mainApp.mathErrors.invalidExpression'),
            },
          ]);
          return;
        }
      }

      // Handle input after a calculation (when we have a gray result)
      if (expectingFreshInput) {
        const handled = handleExpectingFreshInput(key);
        if (handled) return;
      }

      // Normal input flow (not after a calculation)
      // Reset expectingFreshInput flag for all keys except Enter/Check
      if (!isEnterOrCheck) {
        setExpectingFreshInput(false);
      }

      // Use key handler map or default to regular key handling
      const handler = keyHandlers[key];
      if (handler) {
        handler(key);
      } else {
        handleRegularKey(key);
      }
    },
    [
      vibrationEnabled,
      keypadInput,
      expectingFreshInput,
      handleExpectingFreshInput,
      keyHandlers,
      handleRegularKey,
      t,
      setBubbles,
      bubbleIdRef,
      setExpectingFreshInput,
    ]
  );

  return { onKeypadPress };
}
