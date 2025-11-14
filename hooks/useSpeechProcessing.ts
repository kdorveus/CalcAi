import type React from 'react';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { PERCENT_OF_THAT_PATTERN } from '../constants/Languages';
import type { ChatBubble } from '../types';
import { MATH_ERROR } from '../utils/calculationUtils';
import type { CompiledLanguageRegex } from '../utils/mathNormalization';
import { normalizeSpokenMath } from '../utils/mathNormalization';

export interface UseSpeechProcessingParams {
  compiledLanguageRegex: CompiledLanguageRegex;
  handleInput: (val: string, type: 'user' | 'keypad' | 'speech') => string;
  handleCalculationResult: (equation: string, result: string, source: 'keypad' | 'speech') => void;
  lastProcessedTranscriptRef: React.MutableRefObject<string>;
  lastResultRef: React.MutableRefObject<string | null>;
  continuousMode: boolean;
  setInterimTranscript: (value: string) => void;
  setBubbles: React.Dispatch<React.SetStateAction<ChatBubble[]>>;
  bubbleIdRef: React.MutableRefObject<number>;
  setKeypadInput: (value: string | ((prev: string) => string)) => void;
  setExpectingFreshInput: (value: boolean) => void;
}

export function useSpeechProcessing({
  compiledLanguageRegex,
  handleInput,
  handleCalculationResult,
  lastProcessedTranscriptRef,
  lastResultRef,
  continuousMode,
  setInterimTranscript,
  setBubbles,
  bubbleIdRef,
  setKeypadInput,
  setExpectingFreshInput,
}: UseSpeechProcessingParams): (transcript: string, source: 'web' | 'native') => void {
  // Single unified speech result processor (DRY principle)
  const processSpeechResult = useCallback(
    (transcript: string, source: 'web' | 'native') => {
      if (!transcript.trim()) return;

      if (source === 'web' && lastProcessedTranscriptRef.current === transcript) {
        return;
      }
      lastProcessedTranscriptRef.current = transcript;

      // Keep interim transcript visible during processing

      const doHeavyProcessing = () => {
        let processedEquation = normalizeSpokenMath(transcript, compiledLanguageRegex);
        processedEquation = processedEquation.trim();
        processedEquation = processedEquation.replace(/[+\-*/%=.,\s]+$/g, '').trim();

        const percentMatch = PERCENT_OF_THAT_PATTERN.exec(transcript);
        if (percentMatch && lastResultRef.current !== null) {
          const percentage = Number.parseFloat(percentMatch[1]);
          processedEquation = `${lastResultRef.current} * ${percentage} / 100`;
        }

        // Check if input starts with an operator and prepend last result if applicable
        const startsWithOperator = ['+', '-', '*', '/', '%'].some((op) =>
          processedEquation.startsWith(op)
        );
        if (startsWithOperator) {
          const lastResult = lastResultRef.current;
          if (lastResult !== null) {
            processedEquation = `${lastResult} ${processedEquation}`;
          }
        }

        // Calculate the result
        const result = handleInput(processedEquation, 'speech');

        if (result === MATH_ERROR) {
          // Clear interim transcript and show "Speech detected" bubble for MATH_ERROR
          setInterimTranscript('');

          // Add error bubble with original transcript shown
          const errorBubble: ChatBubble = {
            id: (bubbleIdRef.current++).toString(),
            type: 'error',
            content: `Speech detected: ${transcript}`,
          };

          setBubbles((prev) => [...prev, errorBubble]);

          setKeypadInput('');
          setExpectingFreshInput(false);
          return;
        }
        // Clear interim transcript immediately on success so gray text disappears
        setInterimTranscript('');
        handleCalculationResult(processedEquation, result, 'speech');
      };

      if (Platform.OS === 'web' && !continuousMode && source === 'web') {
        const raf = (typeof globalThis !== 'undefined' &&
          (globalThis as any).requestAnimationFrame) as
          | ((cb: FrameRequestCallback) => number)
          | undefined;
        if (raf) {
          raf(() => doHeavyProcessing());
        } else {
          doHeavyProcessing();
        }
      } else {
        doHeavyProcessing();
      }
    },
    [
      compiledLanguageRegex,
      handleInput,
      handleCalculationResult,
      lastProcessedTranscriptRef,
      lastResultRef,
      continuousMode,
      setInterimTranscript,
      setBubbles,
      bubbleIdRef,
      setKeypadInput,
      setExpectingFreshInput,
    ]
  );

  return processSpeechResult;
}
