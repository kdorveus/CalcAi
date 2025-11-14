import Head from 'expo-router/head';
import * as Speech from 'expo-speech';
// Import only evaluate from mathjs to reduce bundle size
import { evaluate } from 'mathjs/number';
import type React from 'react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions, // Add Dimensions import for responsive layout
  type FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import BubbleListComponent from '../components/BubbleListComponent';
import KeypadComponent from '../components/KeypadComponent';
import { SPEECH_RECOGNITION_LANG_MAP } from '../constants/Languages';
import { useAuth } from '../contexts/AuthContext';
import { useCalculationHistory } from '../contexts/CalculationHistoryContext';
import { usePremium } from '../contexts/PremiumContext';
import { useAppPreferences } from '../hooks/useAppPreferences';
import { useKeyboardHandlers } from '../hooks/useKeyboardHandlers';
import { useKeypadHandlers } from '../hooks/useKeypadHandlers';
import { useMathPatterns } from '../hooks/useMathPatterns';
import { useScrollManagement } from '../hooks/useScrollManagement';
import { useSpeechProcessing } from '../hooks/useSpeechProcessing';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useTranslation } from '../hooks/useTranslation';
import { useWebhookManager } from '../hooks/useWebhookManager';
import type { ChatBubble } from '../types';
import { calculateExpression } from '../utils/calculationUtils';
import { selectBestVoice, speakSingleResult } from '../utils/speechUtils';
import { BottomBar } from './components/BottomBar';
import { MobileEmptyState, WebEmptyState } from './components/EmptyState';
import { HeaderControls } from './components/HeaderControls';
import { styles } from './styles/indexStyles';

// Lazy load non-critical modals to reduce initial bundle size
const Settings = lazy(() => import(/* webpackChunkName: "settings" */ './components/Settings'));
const HistoryModal = lazy(
  () => import(/* webpackChunkName: "history-modal" */ '../components/HistoryModal')
);
const PremiumPaymentModal = lazy(
  () => import(/* webpackChunkName: "premium-modal" */ '../components/PremiumPaymentModal')
);

const MainScreen: React.FC = () => {
  const { t, language } = useTranslation();
  useAuth(); // Keep auth context active
  const { history, addCalculation, deleteCalculation, clearAllCalculations, loading } =
    useCalculationHistory();
  const { isPremium } = usePremium();

  const formatNumber = useCallback((num: number, _lang: string): string => {
    // Return raw number string to avoid locale-specific formatting issues
    // (e.g., French locale would format 1.333 as "1,333" which looks like thousands)
    return num.toString();
  }, []);

  // Language mapping for speech recognition
  const getSpeechRecognitionLanguage = useCallback((lang: string): string => {
    return SPEECH_RECOGNITION_LANG_MAP[lang] || 'en-US';
  }, []);

  // Add responsive dimensions - lazy initialization to avoid forced reflow
  const [isWebMobile, setIsWebMobile] = useState(() => {
    if (Platform.OS === 'web' && globalThis.window !== undefined) {
      return Dimensions.get('window').width < 768;
    }
    return false;
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const updateLayout = () => {
      const { width } = Dimensions.get('window');
      setIsWebMobile(width < 768);
    };

    const subscription = Dimensions.addEventListener('change', updateLayout);
    return () => subscription.remove();
  }, []);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const bubbleIdRef = useRef<number>(1);
  const isTTSSpeaking = useRef(false);
  const cachedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // State variables
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');

  const [showKeypad, setShowKeypad] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const lastResultRef = useRef<string | null>(null);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false); // State for modal
  const [showHistoryModal, setShowHistoryModal] = useState(false); // State for history modal
  const [showPremiumModal, setShowPremiumModal] = useState(false); // State for premium modal

  // Keypad buttons
  const [vibrationEnabled, setVibrationEnabled] = useState(true); // Add vibration state
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  // Simple function to toggle tooltip visibility
  const toggleTooltip = useCallback((tooltipId: string | null) => {
    setHoveredTooltip(tooltipId);
  }, []);

  // --- Settings State ---
  const [enterKeyNewLine, setEnterKeyNewLine] = useState<boolean>(false);

  // Use extracted hooks
  const compiledLanguageRegex = useMathPatterns(language);
  const { scrollToBottom } = useScrollManagement(flatListRef);
  const appPreferences = useAppPreferences(setShowKeypad);
  const {
    openInCalcMode,
    setOpenInCalcMode,
    isSpeechMuted,
    setIsSpeechMuted,
    speechMutedRef,
    historyEnabled,
    continuousMode,
    setContinuousMode,
  } = appPreferences;

  // Webhook Manager Hook - handles all webhook operations
  const webhookManager = useWebhookManager(t, bubbleIdRef);

  // Check for unsent data when webhook manager is ready
  useEffect(() => {
    if (
      webhookManager.webhookSettingsLoaded &&
      !webhookManager.streamResults &&
      webhookManager.bulkData.length > 0
    ) {
      // Unsent data detected - user can see it in settings
    }
  }, [
    webhookManager.webhookSettingsLoaded,
    webhookManager.streamResults,
    webhookManager.bulkData.length,
  ]);

  // Placeholder for processSpeechResult - will be defined below
  const processSpeechResultRef = useRef<(transcript: string, source: 'web' | 'native') => void>(
    () => {}
  );

  // Speech recognition hook - handles all speech logic (must be defined before processSpeechResult)
  const speechRecognition = useSpeechRecognition({
    language,
    continuousMode,
    isRecording,
    setIsRecording,
    setInterimTranscript,
    interimTranscript,
    processSpeechResult: (transcript: string, source: 'web' | 'native') => {
      processSpeechResultRef.current(transcript, source);
    },
    getSpeechRecognitionLanguage,
    isTTSSpeaking,
    t,
  });

  // Function to stop all speech and update mute state
  const toggleSpeechMute = useCallback(
    (newMuteState?: boolean) => {
      // If newMuteState is provided, use it; otherwise toggle
      const finalMuteState = newMuteState ?? !speechMutedRef.current;
      speechMutedRef.current = finalMuteState;
      setIsSpeechMuted(finalMuteState); // Update state for UI

      if (Platform.OS === 'android') {
        ToastAndroid.show(
          finalMuteState ? t('mainApp.voiceMuted') : t('mainApp.voiceUnmuted'),
          ToastAndroid.SHORT
        );
      }

      // Stop any ongoing speech when muted
      if (finalMuteState) {
        if (Platform.OS === 'web') {
          globalThis.window?.speechSynthesis?.cancel();
        } else {
          Speech.stop();
        }
      }
    },
    [t, speechMutedRef, setIsSpeechMuted]
  );

  // Initialize and cache the Google female voice on component mount (Web only)
  useEffect(() => {
    if (Platform.OS === 'web' && globalThis.window?.speechSynthesis) {
      const selectBestVoiceWrapper = () => {
        const voices = globalThis.window.speechSynthesis.getVoices();
        const bestVoice = selectBestVoice(voices, {
          language,
          getSpeechRecognitionLanguage,
        });
        if (bestVoice) {
          cachedVoiceRef.current = bestVoice;
        }
      };

      // Try to select voice immediately
      selectBestVoiceWrapper();

      // Listen for voices to load (handles async voice loading)
      const handleVoicesChanged = () => {
        selectBestVoiceWrapper();
      };

      globalThis.window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);

      return () => {
        globalThis.window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
    }
  }, [language, getSpeechRecognitionLanguage]);

  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [expectingFreshInput, setExpectingFreshInput] = useState(false);

  // Handle input and calculation (used by keypad and speech)
  const handleInput = useCallback(
    (val: string, type: 'user' | 'keypad' | 'speech'): string => {
      return calculateExpression({
        val,
        type,
        compiledLanguageRegex,
        formatNumber,
        language,
      });
    },
    [compiledLanguageRegex, formatNumber, language]
  );

  const sendWebhookData = webhookManager.sendWebhookData;

  // Auto-show premium bubble on web after a short delay for non-premium users
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const timer = setTimeout(() => {
      if (!isPremium) {
        setShowPremiumModal(true);
      }
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [isPremium]);

  const speakSingleResultWrapper = useCallback(
    (text: string) => {
      speakSingleResult({
        text,
        language,
        getSpeechRecognitionLanguage,
        cachedVoice: cachedVoiceRef.current,
        isTTSSpeaking,
        setInterimTranscript,
        lastProcessedTranscriptRef: speechRecognition.lastProcessedTranscriptRef,
      });
    },
    [language, getSpeechRecognitionLanguage, speechRecognition.lastProcessedTranscriptRef]
  );

  const handleCalculationResult = useCallback(
    (equation: string, result: string, source: 'keypad' | 'speech') => {
      // Prioritize TTS: speak immediately for speech source before any UI work
      if (source === 'speech' && !speechMutedRef.current) {
        speakSingleResultWrapper(result);
      }

      // Create bubbles for display
      const equationBubble: ChatBubble = {
        id: (bubbleIdRef.current++).toString(),
        type: 'user',
        content: `${equation} = ${result}`,
      };
      const resultBubble: ChatBubble = {
        id: (bubbleIdRef.current++).toString(),
        type: 'calc',
        content: result,
      };

      if (enterKeyNewLine) {
        // New Line Mode: Create a new empty user bubble
        const newEmptyBubble: ChatBubble = {
          id: (bubbleIdRef.current++).toString(),
          type: 'user',
          content: '',
        };

        setBubbles((prev) => {
          const filteredBubbles = prev.filter(
            (b) => b.type !== 'user' || b.content !== keypadInput
          );
          return [...filteredBubbles, equationBubble, resultBubble, newEmptyBubble];
        });

        setKeypadInput('');
        setPreviewResult(null);
      } else {
        // Normal Mode: Show the result in the input field
        const nextUserBubble: ChatBubble = {
          id: (bubbleIdRef.current++).toString(),
          type: 'result-input',
          content: result,
        };

        setBubbles((prev) => {
          const filteredBubbles = prev.filter(
            (b) => b.type !== 'user' || b.content !== keypadInput
          );
          return [...filteredBubbles, equationBubble, resultBubble, nextUserBubble];
        });

        setKeypadInput(result);
      }

      lastResultRef.current = result;
      setExpectingFreshInput(true);

      // Webhook and history
      if (historyEnabled) {
        addCalculation(equation, result);
      }
      sendWebhookData(equation, result);
    },
    [
      enterKeyNewLine,
      keypadInput,
      historyEnabled,
      speakSingleResultWrapper,
      addCalculation,
      sendWebhookData,
      speechMutedRef,
    ]
  );

  // Use keypad handlers hook
  const { onKeypadPress } = useKeypadHandlers({
    keypadInput,
    setKeypadInput,
    bubbles,
    setBubbles,
    bubbleIdRef,
    previewResult,
    setPreviewResult,
    expectingFreshInput,
    setExpectingFreshInput,
    vibrationEnabled,
    scrollToBottom,
    handleInput,
    handleCalculationResult,
    t,
  });

  // Use keyboard handlers hook
  useKeyboardHandlers({
    isRecording,
    setIsRecording,
    startRecording,
    onKeypadPress,
    toggleSpeechMute,
    setBubbles,
    setKeypadInput,
    setPreviewResult,
  });

  // Live result preview effect with debounce to limit evaluate churn
  useEffect(() => {
    const input = keypadInput;
    if (!input.trim()) {
      setPreviewResult(null);
      return;
    }
    const timeout = setTimeout(() => {
      try {
        let expression = input.replaceAll('×', '*').replaceAll('÷', '/');
        expression = expression.replace(/(\d+)%/g, '($1 / 100)');
        expression = expression.replaceAll('%', '/100'); // Trailing %

        const lastChar = expression.trim().slice(-1);
        if (['+', '-', '*', '/', '^', '('].includes(lastChar)) {
          return;
        }

        const result = evaluate(expression);
        if (
          typeof result === 'number' ||
          (typeof result === 'string' && !Number.isNaN(Number.parseFloat(result)))
        ) {
          const formattedResult =
            typeof result === 'number' ? formatNumber(result, language) : result.toString();
          if (input.trim() === formattedResult) {
            setPreviewResult(null);
          } else {
            setPreviewResult(formattedResult);
          }
        } else {
          setPreviewResult(null);
        }
      } catch {
        setPreviewResult(null);
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, [keypadInput, formatNumber, language]);

  // Use speech processing hook
  const processSpeechResult = useSpeechProcessing({
    compiledLanguageRegex,
    handleInput,
    handleCalculationResult,
    lastProcessedTranscriptRef: speechRecognition.lastProcessedTranscriptRef,
    lastResultRef,
    continuousMode,
    setInterimTranscript,
    setBubbles,
    bubbleIdRef,
    setKeypadInput,
    setExpectingFreshInput,
  });

  // Assign processSpeechResult to the ref so the hook can use it
  processSpeechResultRef.current = processSpeechResult;

  // Background initialization for speech recognition - runs immediately after app loads
  useEffect(() => {
    // Start initialization immediately after component mounts
    speechRecognition.initializeSpeech().catch((error) => {
      console.error('Failed to initialize speech recognition:', error);
    });
  }, [speechRecognition]);

  // Save webhook settings when they change
  useEffect(() => {
    if (webhookManager.webhookSettingsLoaded) {
      webhookManager.saveSettings();
    }
  }, [webhookManager.webhookSettingsLoaded, webhookManager.saveSettings]);

  // Stop recording when continuous mode is turned off
  const prevContinuousModeRef = useRef(continuousMode);
  useEffect(() => {
    // Only stop if continuous mode was just turned OFF (true -> false) while recording
    if (prevContinuousModeRef.current && !continuousMode && isRecording) {
      stopRecording();
    }
    prevContinuousModeRef.current = continuousMode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuousMode, isRecording]); // stopRecording is stable (useCallback), no need to include

  // --- Webhook Logic Handlers ---
  const handleSendBulkData = webhookManager.handleSendBulkData;

  return (
    <SafeAreaView style={styles.container}>
      <Head>
        <title>CalcAI - AI-Powered Calculator with Voice Recognition</title>
        <meta
          name="description"
          content="CalcAI is an intelligent calculator app with voice recognition, natural language processing, and advanced mathematical capabilities. Solve complex calculations effortlessly with AI assistance."
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
      </Head>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Render Header Controls */}
      <HeaderControls
        bubbles={bubbles}
        showKeypad={showKeypad}
        hoveredTooltip={hoveredTooltip}
        t={t}
        setBubbles={setBubbles}
        setKeypadInput={setKeypadInput}
        setPreviewResult={setPreviewResult}
        setShowHistoryModal={setShowHistoryModal}
        toggleTooltip={toggleTooltip}
        styles={{
          headerControls: styles.headerControls,
          tooltipContainer: styles.tooltipContainer,
          resetButton: styles.resetButton,
          tooltip: styles.tooltip,
          tooltipText: styles.tooltipText,
        }}
      />

      {/* Text Logo - Optimized for performance */}
      {!showKeypad && bubbles.length === 0 ? (
        <View style={styles.centeredEmptyStateWrapper}>
          <View style={styles.logoContainer}>
            <View style={styles.textLogoContainer}>
              <Text style={styles.textLogo}>calc+AI</Text>
              <Text style={styles.betaText}>BETA</Text>
            </View>
          </View>
          {Platform.OS === 'web' ? (
            <WebEmptyState
              t={t}
              styles={{
                emptyStateItem: styles.emptyStateItem,
                emptyStateText: styles.emptyStateText,
              }}
            />
          ) : (
            <MobileEmptyState
              t={t}
              styles={{
                emptyStateItem: styles.emptyStateItem,
                emptyStateText: styles.emptyStateText,
              }}
            />
          )}
        </View>
      ) : (
        <BubbleListComponent
          ref={flatListRef}
          bubbles={bubbles}
          keypadInput={keypadInput}
          interimTranscript={interimTranscript}
          previewResult={previewResult}
          vibrationEnabled={vibrationEnabled}
          emptyComponent={null}
          t={t}
          setBubbles={setBubbles}
          bubbleIdRef={bubbleIdRef}
          styles={{
            chatArea: styles.chatArea,
            userBubble: styles.userBubble,
            userText: styles.userText,
            resultBubble: styles.resultBubble,
            resultText: styles.resultText,
            errorBubble: styles.errorBubble,
            errorText: styles.errorText,
            currentUserBubbleContainer: styles.currentUserBubbleContainer,
          }}
        />
      )}

      {showKeypad && (
        <KeypadComponent
          onKeypadPress={onKeypadPress}
          isWebMobile={isWebMobile}
          styles={{
            calculatorArea: styles.calculatorArea,
            calculatorAreaMobileWeb: styles.calculatorAreaMobileWeb,
            keypadContainer: styles.keypadContainer,
            keypadRow: styles.keypadRow,
            keypadKeyWeb: styles.keypadKeyWeb,
            keypadKeyMobile: styles.keypadKeyMobile,
            keypadKeyOperator: styles.keypadKeyOperator,
            keypadKeyEnter: styles.keypadKeyEnter,
            keypadKeyWebMobile: styles.keypadKeyWebMobile,
            keypadKeyText: styles.keypadKeyText,
          }}
        />
      )}

      {/* Settings Modal - Lazy loaded */}
      {isSettingsModalVisible && (
        <Suspense fallback={null}>
          <Settings
            visible={isSettingsModalVisible}
            onClose={() => setIsSettingsModalVisible(false)}
            webhookUrls={webhookManager.webhookUrls}
            sendEquation={webhookManager.sendEquation}
            setSendEquation={webhookManager.setSendEquation}
            streamResults={webhookManager.streamResults}
            setStreamResults={webhookManager.setStreamResults}
            bulkData={webhookManager.bulkData}
            setBulkData={webhookManager.setBulkData}
            isSendingBulk={webhookManager.isSendingBulk}
            clearBulkData={() => {
              webhookManager.setBulkData([]);
            }}
            enterKeyNewLine={enterKeyNewLine}
            setEnterKeyNewLine={setEnterKeyNewLine}
            isSpeechMuted={isSpeechMuted}
            toggleSpeechMute={toggleSpeechMute}
            setWebhookUrls={webhookManager.setWebhookUrls}
            handleSendBulkData={handleSendBulkData}
            vibrationEnabled={vibrationEnabled}
            setVibrationEnabled={setVibrationEnabled}
            openInCalcMode={openInCalcMode}
            setOpenInCalcMode={setOpenInCalcMode}
            continuousMode={continuousMode}
            setContinuousMode={setContinuousMode}
          />
        </Suspense>
      )}

      {/* History Modal - Lazy loaded */}
      {showHistoryModal && (
        <Suspense fallback={null}>
          <HistoryModal
            visible={showHistoryModal}
            onClose={() => setShowHistoryModal(false)}
            history={history}
            onDelete={deleteCalculation}
            onClearAll={clearAllCalculations}
            isLoading={loading}
          />
        </Suspense>
      )}

      {/* Premium Payment Modal - Lazy loaded, auto-shown for first-time users */}
      {showPremiumModal && (
        <Suspense fallback={null}>
          <PremiumPaymentModal
            visible={showPremiumModal}
            onClose={() => setShowPremiumModal(false)}
          />
        </Suspense>
      )}

      {/* Bottom bar with proper spacing and button sizes */}
      <BottomBar
        isWebMobile={isWebMobile}
        isRecording={isRecording}
        hoveredTooltip={hoveredTooltip}
        t={t}
        setShowKeypad={setShowKeypad}
        setIsSettingsModalVisible={setIsSettingsModalVisible}
        toggleTooltip={toggleTooltip}
        startRecording={startRecording}
        stopRecording={stopRecording}
        webhookManager={webhookManager}
        styles={{
          bottomBar: styles.bottomBar,
          bottomBarWebMobile: styles.bottomBarWebMobile,
          bottomButton: styles.bottomButton,
          micButton: styles.micButton,
          micButtonWebMobile: styles.micButtonWebMobile,
          tooltipContainer: styles.tooltipContainer,
          bulkBadge: styles.bulkBadge,
          bulkBadgeText: styles.bulkBadgeText,
          webhookTooltip: styles.webhookTooltip,
          webhookTooltipItem: styles.webhookTooltipItem,
          tooltipText: styles.tooltipText,
          webhookTooltipText: styles.webhookTooltipText,
        }}
      />
    </SafeAreaView>
  );
};

export default MainScreen;
