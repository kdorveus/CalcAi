import * as Speech from 'expo-speech';
import type React from 'react';
import { Platform } from 'react-native';

export interface SelectBestVoiceParams {
  language: string;
  getSpeechRecognitionLanguage: (lang: string) => string;
}

export interface SpeakSingleResultParams {
  text: string;
  language: string;
  getSpeechRecognitionLanguage: (lang: string) => string;
  cachedVoice: SpeechSynthesisVoice | null;
  isTTSSpeaking: React.MutableRefObject<boolean>;
  setInterimTranscript: (value: string) => void;
  lastProcessedTranscriptRef: React.MutableRefObject<string>;
}

// Initialize and cache the Google female voice on component mount (Web only)
export function selectBestVoice(
  voices: SpeechSynthesisVoice[],
  { language, getSpeechRecognitionLanguage }: SelectBestVoiceParams
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null; // Voices not loaded yet

  const targetLang = getSpeechRecognitionLanguage(language);

  // ONLY Google female voices - fastest TTS rendering
  const googleVoiceNames: { [key: string]: string[] } = {
    'en-US': ['Google US English Female'],
    'en-GB': ['Google UK English Female'],
    'es-ES': ['Google español Female'],
    'es-MX': ['Google español de Estados Unidos Female'],
    'fr-FR': ['Google français Female'],
    'de-DE': ['Google Deutsch Female'],
    'pt-BR': ['Google português do Brasil Female'],
    'it-IT': ['Google italiano Female'],
  };

  const langBase = targetLang.split('-')[0];
  const preferredNames =
    googleVoiceNames[targetLang] || googleVoiceNames[`${langBase}-${langBase.toUpperCase()}`] || [];

  // Find the first available Google female voice
  for (const name of preferredNames) {
    const voice = voices.find((v) => v.name === name || v.name.includes(name));
    if (voice) {
      return voice;
    }
  }

  // If no Google voice found, try any Google voice for the language
  const anyGoogleVoice = voices.find(
    (v) => v.name.toLowerCase().includes('google') && v.lang.startsWith(langBase)
  );
  if (anyGoogleVoice) {
    return anyGoogleVoice;
  }

  return null;
}

// Speak single result with TTS
export function speakSingleResult({
  text,
  language,
  getSpeechRecognitionLanguage,
  cachedVoice,
  isTTSSpeaking,
  setInterimTranscript,
  lastProcessedTranscriptRef,
}: SpeakSingleResultParams): void {
  if (isTTSSpeaking.current) {
    if (Platform.OS === 'web') {
      globalThis.window?.speechSynthesis?.cancel();
    } else {
      Speech.stop();
    }
  }

  isTTSSpeaking.current = true;

  if (Platform.OS === 'web') {
    // Use Web Speech API for browser
    if (globalThis.window?.speechSynthesis) {
      // Always cancel any queued speech for zero-queue guarantee
      globalThis.window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = getSpeechRecognitionLanguage(language);
      utterance.pitch = 1;
      utterance.rate = 1.1;

      // Use cached Google female voice for consistency and speed
      if (cachedVoice) {
        utterance.voice = cachedVoice;
      }

      utterance.onend = () => {
        // Clear flag and reset ALL speech-related state immediately when TTS finishes
        isTTSSpeaking.current = false;
        setInterimTranscript(''); // Clear any buffered speech
        lastProcessedTranscriptRef.current = ''; // Reset duplicate prevention
      };

      utterance.onerror = () => {
        // Clear flag and reset state on TTS error
        isTTSSpeaking.current = false;
        setInterimTranscript(''); // Clear any buffered speech
        lastProcessedTranscriptRef.current = ''; // Reset duplicate prevention
      };

      globalThis.window.speechSynthesis.speak(utterance);
    } else {
      // Fallback if speechSynthesis is not available
      isTTSSpeaking.current = false;
    }
  } else {
    // Use expo-speech for native platforms
    Speech.speak(text, {
      language: getSpeechRecognitionLanguage(language),
      pitch: 1,
      rate: 1.1,
      onDone: () => {
        // Clear flag and reset ALL speech-related state immediately when TTS finishes
        isTTSSpeaking.current = false;
        setInterimTranscript(''); // Clear any buffered speech
        lastProcessedTranscriptRef.current = ''; // Reset duplicate prevention
      },
      onStopped: () => {
        // Clear flag and reset state when TTS is manually stopped
        isTTSSpeaking.current = false;
        setInterimTranscript(''); // Clear any buffered speech
        lastProcessedTranscriptRef.current = ''; // Reset duplicate prevention
      },
      onError: () => {
        // Clear flag and reset state on TTS error
        isTTSSpeaking.current = false;
        setInterimTranscript(''); // Clear any buffered speech
        lastProcessedTranscriptRef.current = ''; // Reset duplicate prevention
      },
    });
  }
}
