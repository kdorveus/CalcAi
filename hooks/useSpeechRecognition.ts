import { requestRecordingPermissionsAsync } from 'expo-audio';
import { useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';

interface UseSpeechRecognitionProps {
  language: string;
  continuousMode: boolean;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  setInterimTranscript: (value: string) => void;
  interimTranscript: string;
  processSpeechResult: (transcript: string, source: 'web' | 'native') => void;
  getSpeechRecognitionLanguage: (lang: string) => string;
  isTTSSpeaking: React.MutableRefObject<boolean>;
  t: (key: string) => string;
}

interface UseSpeechRecognitionReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  initializeSpeech: () => Promise<void>;
  speechModuleRef: React.MutableRefObject<any>;
  speechInitializedRef: React.MutableRefObject<boolean>;
  permissionsGrantedRef: React.MutableRefObject<boolean>;
  recognitionRef: React.MutableRefObject<any>;
  speechListenerRef: React.MutableRefObject<any>;
  endListenerRef: React.MutableRefObject<any>;
  errorListenerRef: React.MutableRefObject<any>;
  lastTranscriptRef: React.MutableRefObject<string>;
  silenceTimerRef: React.MutableRefObject<NodeJS.Timeout | number | null>;
  lastProcessedTranscriptRef: React.MutableRefObject<string>;
}

export const useSpeechRecognition = ({
  language,
  continuousMode,
  isRecording,
  setIsRecording,
  setInterimTranscript,
  interimTranscript,
  processSpeechResult,
  getSpeechRecognitionLanguage,
  isTTSSpeaking,
  t,
}: UseSpeechRecognitionProps): UseSpeechRecognitionReturn => {
  const speechModuleRef = useRef<any>(null);
  const speechInitializedRef = useRef(false);
  const permissionsGrantedRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const speechListenerRef = useRef<any>(null);
  const endListenerRef = useRef<any>(null);
  const errorListenerRef = useRef<any>(null);
  const lastTranscriptRef = useRef('');
  const silenceTimerRef = useRef<NodeJS.Timeout | number | null>(null);
  const lastProcessedTranscriptRef = useRef<string>('');
  const rafPendingRef = useRef<number | null>(null);
  const pendingInterimRef = useRef<string>('');
  const lastInterimSentRef = useRef<string>('');

  const initializeSpeech = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Pre-initialize the Web Speech API object to reduce delay on first use.
      const WebSpeechRecognition =
        (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition;
      if (WebSpeechRecognition) {
        recognitionRef.current = new WebSpeechRecognition();
        // Set properties that don't change, but leave listeners for startRecording
        // because they might close over state that changes.
        recognitionRef.current.interimResults = true;
        recognitionRef.current.maxAlternatives = 1;
      }
      speechInitializedRef.current = true;
      return;
    }

    try {
      if (!speechModuleRef.current) {
        speechModuleRef.current = await import('expo-speech-recognition');
      }

      const { granted: audioGranted } = await requestRecordingPermissionsAsync();
      const { ExpoSpeechRecognitionModule } = speechModuleRef.current;
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      permissionsGrantedRef.current = audioGranted;
      speechInitializedRef.current = true;
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      speechInitializedRef.current = false;
      permissionsGrantedRef.current = false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    setIsRecording(true);

    if (Platform.OS === 'web') {
      // The recognition object should be pre-initialized by initializeSpeech.
      if (!recognitionRef.current) {
        // If it's not available, it means the browser doesn't support the API.
        Alert.alert(t('mainApp.speechNotSupported'));
        setIsRecording(false);
        return;
      }

      const recognition = recognitionRef.current;
      // Configure properties that might have changed since initialization.
      recognition.lang = getSpeechRecognitionLanguage(language);
      recognition.continuous = continuousMode;

      // (Re)assign event listeners to ensure they capture the latest state.
      recognition.onresult = (event: any) => {
        if (isTTSSpeaking.current) return;

        let finalTranscript = '';
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }

        if (interimText) {
          if (continuousMode) {
            setInterimTranscript(interimText);
          } else {
            pendingInterimRef.current = interimText;
            if (rafPendingRef.current == null) {
              const raf = (globalThis as any).requestAnimationFrame as
                | ((cb: FrameRequestCallback) => number)
                | undefined;
              if (raf) {
                rafPendingRef.current = raf(() => {
                  rafPendingRef.current = null;
                  const text = pendingInterimRef.current;
                  if (text && text !== lastInterimSentRef.current) {
                    lastInterimSentRef.current = text;
                    setInterimTranscript(text);
                  }
                });
              } else if (interimText !== lastInterimSentRef.current) {
                lastInterimSentRef.current = interimText;
                setInterimTranscript(interimText);
              }
            }
          }
        }

        if (finalTranscript) {
          processSpeechResult(finalTranscript.trim(), 'web');
        }
      };

      recognition.onend = () => {
        if (!continuousMode) {
          setIsRecording(false);
          setInterimTranscript('');
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
        setInterimTranscript('');
      };

      recognition.start();
    } else {
      try {
        if (!speechInitializedRef.current) {
          await initializeSpeech();
        }
        if (!permissionsGrantedRef.current) {
          Alert.alert(t('mainApp.permissionRequired'), t('mainApp.microphonePermissionRequired'));
          setIsRecording(false);
          return;
        }

        const { ExpoSpeechRecognitionModule } = speechModuleRef.current;

        const handleResult = (event: any) => {
          if (isTTSSpeaking.current) return;
          if (event.results && event.results.length > 0) {
            const transcript = event.results[0].transcript;
            lastTranscriptRef.current = transcript;
            setInterimTranscript(transcript);

            if (!continuousMode && event.isFinal) {
              processSpeechResult(transcript.trim(), 'native');
            }
          }
        };

        const handleEnd = () => {
          if (!continuousMode) {
            const bufferedTranscript = interimTranscript;
            if (bufferedTranscript?.trim() && !isTTSSpeaking.current) {
              processSpeechResult(bufferedTranscript.trim(), 'native');
            }
            setIsRecording(false);
            setInterimTranscript('');
          }
        };

        const handleError = () => {
          setIsRecording(false);
          setInterimTranscript('');
        };

        // Remove existing listeners before adding new ones to prevent memory leaks
        if (speechListenerRef.current) speechListenerRef.current.remove();
        if (endListenerRef.current) endListenerRef.current.remove();
        if (errorListenerRef.current) errorListenerRef.current.remove();

        speechListenerRef.current = ExpoSpeechRecognitionModule.addListener('result', handleResult);
        endListenerRef.current = ExpoSpeechRecognitionModule.addListener('end', handleEnd);
        errorListenerRef.current = ExpoSpeechRecognitionModule.addListener('error', handleError);

        await ExpoSpeechRecognitionModule.start({
          lang: getSpeechRecognitionLanguage(language),
          continuous: continuousMode,
          interimResults: true,
        });

        if (continuousMode) {
          let previousTranscript = '';
          silenceTimerRef.current = setInterval(() => {
            if (isTTSSpeaking.current) return;

            const currentTranscript = lastTranscriptRef.current;
            if (
              currentTranscript &&
              currentTranscript === previousTranscript &&
              currentTranscript.trim()
            ) {
              const finalTranscript = currentTranscript.trim();
              if (finalTranscript) {
                processSpeechResult(finalTranscript, 'native');
              }
            }
            previousTranscript = currentTranscript;
          }, 500);
        }
      } catch (error) {
        console.error('Failed to start recording:', error);
        setIsRecording(false);
      }
    }
  }, [
    isRecording,
    setIsRecording,
    continuousMode,
    language,
    getSpeechRecognitionLanguage,
    isTTSSpeaking,
    setInterimTranscript,
    processSpeechResult,
    interimTranscript,
    initializeSpeech,
    t,
  ]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    setInterimTranscript('');
    lastProcessedTranscriptRef.current = '';
    lastTranscriptRef.current = '';

    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (Platform.OS === 'web') {
      if (rafPendingRef.current != null) {
        const caf = (globalThis as any).cancelAnimationFrame as
          | ((handle: number) => void)
          | undefined;
        if (caf) {
          caf(rafPendingRef.current);
        }
        rafPendingRef.current = null;
        pendingInterimRef.current = '';
        lastInterimSentRef.current = '';
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } else {
      try {
        if (speechModuleRef.current) {
          const { ExpoSpeechRecognitionModule } = speechModuleRef.current;
          await ExpoSpeechRecognitionModule.stop();
        }
        if (speechListenerRef.current) speechListenerRef.current.remove();
        if (endListenerRef.current) endListenerRef.current.remove();
        if (errorListenerRef.current) errorListenerRef.current.remove();
      } catch (error) {
        console.debug('Error stopping speech recognition:', error);
      }
    }
  }, [setIsRecording, setInterimTranscript]);

  return {
    startRecording,
    stopRecording,
    initializeSpeech,
    speechModuleRef,
    speechInitializedRef,
    permissionsGrantedRef,
    recognitionRef,
    speechListenerRef,
    endListenerRef,
    errorListenerRef,
    lastTranscriptRef,
    silenceTimerRef,
    lastProcessedTranscriptRef,
  };
};
