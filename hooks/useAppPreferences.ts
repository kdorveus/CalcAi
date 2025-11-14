import AsyncStorage from '@react-native-async-storage/async-storage';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export interface UseAppPreferencesReturn {
  openInCalcMode: boolean;
  setOpenInCalcMode: (value: boolean) => void;
  isSpeechMuted: boolean;
  setIsSpeechMuted: (value: boolean) => void;
  speechMutedRef: React.MutableRefObject<boolean>;
  historyEnabled: boolean;
  setHistoryEnabled: (value: boolean) => void;
  continuousMode: boolean;
  setContinuousMode: (value: boolean) => void;
}

export function useAppPreferences(
  setShowKeypad: (value: boolean | ((prev: boolean) => boolean)) => void
): UseAppPreferencesReturn {
  const [openInCalcMode, setOpenInCalcMode] = useState(false);
  const [isSpeechMuted, setIsSpeechMuted] = useState(false);
  const speechMutedRef = useRef(false);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [continuousMode, setContinuousMode] = useState(false);

  // Load app preferences on mount
  useEffect(() => {
    const loadAppPreferences = async () => {
      try {
        const [
          storedOpenInCalcMode,
          storedSpeechMuted,
          storedHistoryEnabled,
          storedContinuousMode,
        ] = await Promise.all([
          AsyncStorage.getItem('openInCalcMode'),
          AsyncStorage.getItem('speechMuted'),
          AsyncStorage.getItem('historyEnabled'),
          AsyncStorage.getItem('continuousMode'),
        ]);

        // Load app preferences
        if (storedOpenInCalcMode !== null) {
          const shouldOpenInCalcMode = JSON.parse(storedOpenInCalcMode);
          setOpenInCalcMode(shouldOpenInCalcMode);
          if (shouldOpenInCalcMode && Platform.OS !== 'web') {
            setShowKeypad(true);
          }
        }

        if (storedSpeechMuted !== null) {
          const isMuted = JSON.parse(storedSpeechMuted);
          setIsSpeechMuted(isMuted);
          speechMutedRef.current = isMuted;
        }

        if (storedHistoryEnabled !== null) {
          const isHistoryEnabled = JSON.parse(storedHistoryEnabled);
          setHistoryEnabled(isHistoryEnabled);
        }

        if (storedContinuousMode !== null) {
          setContinuousMode(JSON.parse(storedContinuousMode));
        }
      } catch {
        // Silent error handling
      }
    };
    loadAppPreferences();
  }, [setShowKeypad]);

  // Save app preferences when they change (avoid redundant writes)
  const previousPrefsRef = useRef({
    openInCalcMode: undefined as undefined | boolean,
    isSpeechMuted: undefined as undefined | boolean,
    historyEnabled: undefined as undefined | boolean,
    continuousMode: undefined as undefined | boolean,
  });
  useEffect(() => {
    const saveSettings = async () => {
      try {
        const ops: Promise<void>[] = [];
        const prev = previousPrefsRef.current;
        if (prev.openInCalcMode !== openInCalcMode) {
          ops.push(AsyncStorage.setItem('openInCalcMode', JSON.stringify(openInCalcMode)));
          prev.openInCalcMode = openInCalcMode;
        }
        if (prev.isSpeechMuted !== isSpeechMuted) {
          ops.push(AsyncStorage.setItem('speechMuted', JSON.stringify(isSpeechMuted)));
          prev.isSpeechMuted = isSpeechMuted;
        }
        if (prev.historyEnabled !== historyEnabled) {
          ops.push(AsyncStorage.setItem('historyEnabled', JSON.stringify(historyEnabled)));
          prev.historyEnabled = historyEnabled;
        }
        if (prev.continuousMode !== continuousMode) {
          ops.push(AsyncStorage.setItem('continuousMode', JSON.stringify(continuousMode)));
          prev.continuousMode = continuousMode;
        }
        if (ops.length > 0) {
          await Promise.all(ops);
        }
      } catch {
        // Silent error handling
      }
    };
    saveSettings();
  }, [openInCalcMode, isSpeechMuted, historyEnabled, continuousMode]);

  return {
    openInCalcMode,
    setOpenInCalcMode,
    isSpeechMuted,
    setIsSpeechMuted,
    speechMutedRef,
    historyEnabled,
    setHistoryEnabled,
    continuousMode,
    setContinuousMode,
  };
}
