import React, { useEffect, useRef, useState, useCallback, Suspense, useMemo } from 'react';
import { Vibration } from 'react-native';
import { 
  View, 
  SafeAreaView, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Text, 
  Platform, 
  ActivityIndicator, 
  Alert, 
  Modal, 
  Switch, 
  TextInput, 
  ViewStyle, 
  TextStyle, 
  ImageStyle,
  Pressable,
  Image,
  ToastAndroid,
  Dimensions, // Add Dimensions import for responsive layout
  StatusBar,
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { evaluate } from 'mathjs';
// Using our bundled AppIcon component instead of MaterialCommunityIcons
import AppIcon from '../components/AppIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
// import Settings from './components/Settings'; // Remove this line
import { useAuth } from '../contexts/AuthContext';
import { useCalculationHistory } from '../contexts/CalculationHistoryContext';
import HistoryButton from '../components/HistoryButton';
import { useTranslation } from '../hooks/useTranslation';
import { LOCALE_MAP, SPEECH_RECOGNITION_LANG_MAP } from '../constants/Languages';
import { sendWebhook } from '../utils/webhookService';
// import HistoryModal from '../components/HistoryModal'; // Remove this line

// Dynamically import components
const Settings = React.lazy(() => import('./components/Settings'));
const HistoryModal = React.lazy(() => import('../components/HistoryModal'));

// Import SVG icons directly
// This eliminates the need to load icons from Google Fonts
// Icons are now bundled with the app for instant loading
import WebhookIcon from '../assets/icons/webhook.svg';
import MicrophoneIcon from '../assets/icons/microphone.svg';
import CalculatorIcon from '../assets/icons/calculator.svg';
import SendIcon from '../assets/icons/send.svg';
import CloseIcon from '../assets/icons/close.svg';
import CogIcon from '../assets/icons/cog.svg';
import HistoryIcon from '../assets/icons/history.svg';
import CheckCircleIcon from '../assets/icons/check-circle.svg';
import CrownIcon from '../assets/icons/crown.svg';

// (Removed unused asset preload hook to avoid dead code)

// --- Module-level constants and caches (hoisted to avoid re-creation) ---
const KEYPAD_LAYOUT: string[][] = [
  ['↺', '()', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['^', '0', '.', 'CHECK_ICON'],
];

const numberFormattersByLocale = new Map<string, Intl.NumberFormat>();

// Types
interface ChatBubble {
  id: string;
  type: 'user' | 'result' | 'error' | 'speech' | 'calc' | 'result-input';
  content: string;
}

interface WebhookItem {
  url: string;
  active: boolean;
  title?: string;
}

interface AxiosSuccessPayload {
  url: string;
  response: any;
}

interface AxiosFailurePayload {
  url: string;
  error: any;
}

// Define type for math patterns
interface LanguagePatterns {
  numbers: { [key: string]: string };
  operations: {
    addition: string[];
    subtraction: string[];
    multiplication: string[];
    division: string[];
    percentage: string[];
    percentOf: string[];
    power: string[];
    sqrt: string[];
    parentheses: {
      open: string[];
      close: string[];
    };
    decimal: string[];
  };
  specificPhrases: {
    addTo: string;
    subtractFrom: string;
    multiplyBy: string;
    divideBy: string;
  };
  fillerWords: string[];
}

const MainScreen: React.FC = () => {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const { history, addCalculation, deleteCalculation, clearAllCalculations, loading } = useCalculationHistory();

  // Number formatting function with per-locale cache
  const formatNumber = useCallback((num: number, lang: string): string => {
    const locale = LOCALE_MAP[lang] || 'en-US';
    let formatter = numberFormattersByLocale.get(locale);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 10,
        minimumFractionDigits: 0,
    });
      numberFormattersByLocale.set(locale, formatter);
    }
    return formatter.format(num);
  }, []);

  // Language mapping for speech recognition
  const getSpeechRecognitionLanguage = (lang: string): string => {
    return SPEECH_RECOGNITION_LANG_MAP[lang] || 'en-US';
  };

  // Setup animation values for swipe effects
  // const translateX = useSharedValue(0);
  // const translateY = useSharedValue(0);
  
  // No longer needed as we directly inject the font
  // const fallbackNeeded = false;
  
  // Add responsive dimensions
  const [isWebMobile, setIsWebMobile] = useState(false);
  
  useEffect(() => {
    const updateLayout = () => {
      const { width } = Dimensions.get('window');
      setIsWebMobile(Platform.OS === 'web' && width < 768);
    };

    updateLayout();
    const subscription = Dimensions.addEventListener('change', updateLayout);

    return () => {
      subscription.remove();
    };
  }, []);
  
  // --- Force immediate render of critical UI ---
  useEffect(() => {
    // High priority UI updates with requestAnimationFrame
    if (Platform.OS === 'web') {
      // Force immediate paint of critical UI elements
      requestAnimationFrame(() => {
        // This forces layout calculation
        if (flatListRef.current) {
          flatListRef.current.recordInteraction();
        }
      });
    }
  }, []);
  
  // Refs
  const flatListRef = useRef<FlatList>(null);
  const bubbleIdRef = useRef<number>(1);
  const keypadInputRef = useRef('');
  const speechModuleRef = useRef<any>(null); // Ref to store loaded speech module
  const speechInitializedRef = useRef(false); // Track if speech is ready
  const permissionsGrantedRef = useRef(false); // Track permissions status
  const lastTranscriptRef = useRef('');
  const silenceTimerRef = useRef<NodeJS.Timeout | number | null>(null);
  const lastProcessedTranscriptRef = useRef<string>(''); // Prevent duplicate processing
  const lastSpokenResultRef = useRef<string>(''); // Prevent duplicate TTS
  
  // State variables
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const [showKeypad, setShowKeypad] = useState(false);
  // const [recording, setRecording] = useState<Audio.Recording | null>(null); // Removed Audio.Recording type usage here
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const lastResultRef = useRef<string | null>(null);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false); // State for modal
  const [isUnsentDataModalVisible, setIsUnsentDataModalVisible] = useState(false); // State for unsent data alert modal
  const [isSpeechMuted, setIsSpeechMuted] = useState(false); // State for UI updates
  const speechMutedRef = useRef(false); // Ref for actual mute control
  const isTTSSpeaking = useRef(false);
  const [openInCalcMode, setOpenInCalcMode] = useState(false); // State for calculator mode
  const [showHistoryModal, setShowHistoryModal] = useState(false); // State for history modal
  const [historyEnabled, setHistoryEnabled] = useState(true); // State for history toggle
  
  // State for tracking tooltip hover
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  const [continuousMode, setContinuousMode] = useState(false);
  
  // Simple function to toggle tooltip visibility
  const toggleTooltip = useCallback((tooltipId: string | null) => {
    setHoveredTooltip(tooltipId);
  }, []);
  
  
  // Function to stop all speech and update mute state
  const toggleSpeechMute = useCallback(() => {
    const newMuteState = !speechMutedRef.current;
    speechMutedRef.current = newMuteState;
    setIsSpeechMuted(newMuteState); // Update state for UI
    
    if (Platform.OS === 'android') {
      ToastAndroid.show(newMuteState ? t('mainApp.voiceMuted') : t('mainApp.voiceUnmuted'), ToastAndroid.SHORT);
    }
    
    // Stop any ongoing speech when muted
    if (newMuteState) {
      Speech.stop();
    }
  }, []);

  // --- Settings State ---
  const [webhookUrls, setWebhookUrls] = useState<any[]>([]);
  const [enterKeyNewLine, setEnterKeyNewLine] = useState<boolean>(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState<string>('');
  const [newWebhookTitle, setNewWebhookTitle] = useState<string>(''); // Add state for webhook title
  const [sendEquation, setSendEquation] = useState<boolean>(true); // Send 'equation=result' vs 'result'
  const [streamResults, setStreamResults] = useState<boolean>(true); // Send immediately vs bulk
  const [bulkData, setBulkData] = useState<any[]>([]); // Data stored for bulk sending
  const [isSendingBulk, setIsSendingBulk] = useState<boolean>(false); // Loading state for bulk send
  const [webhookSettingsLoaded, setWebhookSettingsLoaded] = useState<boolean>(false); // Track if settings are loaded
  const pendingWebhookDataRef = useRef<{equation: string, result: string}[]>([]); // Store calculations that happen before settings load

  // Check for unsent data when page loads or refreshes
  useEffect(() => {
    // Show alert if there's unsent data
    if (!streamResults && bulkData.length > 0) {
      setIsUnsentDataModalVisible(true);
    }
  }, []); // Empty dependency array means this runs once on mount
  
  // Function to check for unsent data and show modal if needed
  const checkUnsentData = useCallback(() => {
    if (!streamResults && bulkData.length > 0) {
      setIsUnsentDataModalVisible(true);
      return true; // Has unsent data
    }
    return false; // No unsent data
  }, [streamResults, bulkData.length]);

  // --- Web Speech API State (Web only) ---
  const recognitionRef = useRef<any>(null); // Using 'any' for simplicity with web-specific API
  const speechListenerRef = useRef<any>(null); // Ref for speech recognition listener
  const errorListenerRef = useRef<any>(null); // Ref for error listener

  // Consolidated keyboard handling is defined after onKeypadPress

  // Background initialization for speech recognition - runs immediately after app loads
  useEffect(() => {
    const initializeSpeech = async () => {
      if (Platform.OS === 'web') {
        // Web doesn't need pre-initialization
        speechInitializedRef.current = true;
        return;
      }

      try {
        // 1. Pre-load speech module
        if (!speechModuleRef.current) {
          speechModuleRef.current = await import('expo-speech-recognition');
        }

        // 2. Request permissions immediately
        const { granted: audioGranted } = await requestRecordingPermissionsAsync();
        const { ExpoSpeechRecognitionModule } = speechModuleRef.current;
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        
        permissionsGrantedRef.current = audioGranted;
        speechInitializedRef.current = true;
      } catch (error) {
        // Silent error handling - will fall back to old behavior
        speechInitializedRef.current = false;
        permissionsGrantedRef.current = false;
      }
    };

    // Start initialization immediately after component mounts
    initializeSpeech();
  }, []);

  // Function to initialize speech recognition for native platforms
  const initializeSpeech = async () => {
    if (Platform.OS === 'web') {
      // Web doesn't need pre-initialization
      speechInitializedRef.current = true;
      return;
    }

    try {
      // 1. Pre-load speech module
      if (!speechModuleRef.current) {
        speechModuleRef.current = await import('expo-speech-recognition');
      }

      // 2. Request permissions immediately
      const { granted: audioGranted } = await requestRecordingPermissionsAsync();
      const { ExpoSpeechRecognitionModule } = speechModuleRef.current;
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      
      permissionsGrantedRef.current = audioGranted;
      speechInitializedRef.current = true;
    } catch (error) {
      // Silent error handling - will fall back to old behavior
      speechInitializedRef.current = false;
      permissionsGrantedRef.current = false;
    }
  };

  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [expectingFreshInput, setExpectingFreshInput] = useState(false);

  // Internal error constant for programming logic (never shown to user)
  const MATH_ERROR = 'MATH_ERROR_INTERNAL';

  // Hoisted, static language patterns (module-scope style but kept here for minimal diff)
  const LANGUAGE_PATTERNS: { [key: string]: LanguagePatterns } = {
      en: {
        numbers: {
          'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
          'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
          'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15',
          'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19', 'twenty': '20',
          'thirty': '30', 'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
          'eighty': '80', 'ninety': '90', 'hundred': '100',
          'million': '1000000', 'billion': '1000000000', 'trillion': '1000000000000'
        },
        operations: {
          addition: ['plus', 'add', 'and'],
          subtraction: ['minus', 'subtract', 'less', 'take away'],
          multiplication: ['times', 'multiplied by', 'x', 'multiply'],
          division: ['divided by', 'divide', 'over'],
          percentage: ['percent', 'percentage'],
          percentOf: ['percent of'],
          power: ['power', 'raised to', 'to the power of', 'squared', 'cubed'],
          sqrt: ['square root of', 'root of', 'square root'],
          parentheses: {
            open: ['open parenthesis', 'left parenthesis', 'open bracket'],
            close: ['close parenthesis', 'right parenthesis', 'close bracket']
          },
          decimal: ['point', 'dot', 'decimal']
        },
        specificPhrases: {
          addTo: 'add (\\d+(?:\\.\\d+)?) to (\\d+(?:\\.\\d+)?)',
          subtractFrom: 'subtract (\\d+(?:\\.\\d+)?) from (\\d+(?:\\.\\d+)?)',
          multiplyBy: '(multiply|multiplied) (\\d+(?:\\.\\d+)?) by (\\d+(?:\\.\\d+)?)',
          divideBy: '(divide|divided) (\\d+(?:\\.\\d+)?) by (\\d+(?:\\.\\d+)?)'
        },
        fillerWords: ['do', 'hours', 'hour', 'box', 'and', 'the', 'a', 'an', 'equals', 'is', 'calculate', 'result', 'please', 'for', 'of']
      },
      es: {
        numbers: {
          'cero': '0', 'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
          'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10',
          'once': '11', 'doce': '12', 'trece': '13', 'catorce': '14', 'quince': '15',
          'dieciséis': '16', 'diecisiete': '17', 'dieciocho': '18', 'diecinueve': '19', 'veinte': '20',
          'treinta': '30', 'cuarenta': '40', 'cincuenta': '50', 'sesenta': '60', 'setenta': '70',
          'ochenta': '80', 'noventa': '90', 'cien': '100',
          'millón': '1000000', 'mil millones': '1000000000', 'billón': '1000000000000'
        },
        operations: {
          addition: ['más', 'sumar', 'y', 'suma'],
          subtraction: ['menos', 'restar', 'quitar'],
          multiplication: ['por', 'multiplicado por', 'veces', 'multiplicar', 'x'],
          division: ['dividido por', 'dividir', 'sobre'],
          percentage: ['por ciento', 'porciento'],
          percentOf: ['por ciento de'],
          power: ['elevado a', 'a la potencia de', 'al cuadrado', 'al cubo', 'potencia'],
          sqrt: ['raíz cuadrada de', 'raíz de', 'raíz cuadrada'],
          parentheses: {
            open: ['abrir paréntesis', 'paréntesis izquierdo', 'abrir corchete'],
            close: ['cerrar paréntesis', 'paréntesis derecho', 'cerrar corchete']
          },
          decimal: ['punto', 'coma', 'decimal']
        },
        specificPhrases: {
          addTo: 'sumar (\\d+(?:\\.\\d+)?) a (\\d+(?:\\.\\d+)?)',
          subtractFrom: 'restar (\\d+(?:\\.\\d+)?) de (\\d+(?:\\.\\d+)?)',
          multiplyBy: '(multiplicar|multiplicado) (\\d+(?:\\.\\d+)?) por (\\d+(?:\\.\\d+)?)',
          divideBy: '(dividir|dividido) (\\d+(?:\\.\\d+)?) por (\\d+(?:\\.\\d+)?)'
        },
        fillerWords: ['hacer', 'horas', 'hora', 'caja', 'y', 'el', 'la', 'un', 'una', 'igual', 'es', 'calcular', 'resultado', 'por favor', 'para', 'de']
      },
      fr: {
        numbers: {
          'zéro': '0', 'un': '1', 'deux': '2', 'trois': '3', 'quatre': '4', 'cinq': '5',
          'six': '6', 'sept': '7', 'huit': '8', 'neuf': '9', 'dix': '10',
          'onze': '11', 'douze': '12', 'treize': '13', 'quatorze': '14', 'quinze': '15',
          'seize': '16', 'dix-sept': '17', 'dix-huit': '18', 'dix-neuf': '19', 'vingt': '20',
          'trente': '30', 'quarante': '40', 'cinquante': '50', 'soixante': '60', 'soixante-dix': '70',
          'quatre-vingts': '80', 'quatre-vingt-dix': '90', 'cent': '100',
          'million': '1000000', 'milliard': '1000000000', 'trillion': '1000000000000'
        },
        operations: {
          addition: ['plus', 'ajouter', 'et', 'additionner'],
          subtraction: ['moins', 'soustraire', 'retirer'],
          multiplication: ['fois', 'multiplié par', 'x', 'multiplier'],
          division: ['divisé par', 'diviser', 'sur'],
          percentage: ['pour cent', 'pourcent'],
          percentOf: ['pour cent de'],
          power: ['puissance', 'élevé à', 'à la puissance de', 'au carré', 'au cube'],
          sqrt: ['racine carrée de', 'racine de', 'racine carrée'],
          parentheses: {
            open: ['ouvrir parenthèse', 'parenthèse gauche', 'ouvrir crochet'],
            close: ['fermer parenthèse', 'parenthèse droite', 'fermer crochet']
          },
          decimal: ['virgule', 'point', 'décimal']
        },
        specificPhrases: {
          addTo: 'ajouter (\\d+(?:\\.\\d+)?) à (\\d+(?:\\.\\d+)?)',
          subtractFrom: 'soustraire (\\d+(?:\\.\\d+)?) de (\\d+(?:\\.\\d+)?)',
          multiplyBy: '(multiplier|multiplié) (\\d+(?:\\.\\d+)?) par (\\d+(?:\\.\\d+)?)',
          divideBy: '(diviser|divisé) (\\d+(?:\\.\\d+)?) par (\\d+(?:\\.\\d+)?)'
        },
        fillerWords: ['faire', 'heures', 'heure', 'boîte', 'et', 'le', 'la', 'un', 'une', 'égal', 'est', 'calculer', 'résultat', 's\'il vous plaît', 'pour', 'de']
      },
      de: {
        numbers: {
          'null': '0', 'eins': '1', 'zwei': '2', 'drei': '3', 'vier': '4', 'fünf': '5',
          'sechs': '6', 'sieben': '7', 'acht': '8', 'neun': '9', 'zehn': '10',
          'elf': '11', 'zwölf': '12', 'dreizehn': '13', 'vierzehn': '14', 'fünfzehn': '15',
          'sechzehn': '16', 'siebzehn': '17', 'achtzehn': '18', 'neunzehn': '19', 'zwanzig': '20',
          'dreißig': '30', 'vierzig': '40', 'fünfzig': '50', 'sechzig': '60', 'siebzig': '70',
          'achtzig': '80', 'neunzig': '90', 'hundert': '100',
          'million': '1000000', 'milliarde': '1000000000', 'trillion': '1000000000000'
        },
        operations: {
          addition: ['plus', 'addieren', 'und', 'hinzufügen'],
          subtraction: ['minus', 'subtrahieren', 'weniger', 'abziehen'],
          multiplication: ['mal', 'multipliziert mit', 'x', 'multiplizieren'],
          division: ['geteilt durch', 'dividiert durch', 'teilen', 'über'],
          percentage: ['prozent', 'vom hundert'],
          percentOf: ['prozent von'],
          power: ['hoch', 'zur potenz', 'quadrat', 'kubik', 'potenz'],
          sqrt: ['quadratwurzel von', 'wurzel von', 'quadratwurzel'],
          parentheses: {
            open: ['klammer auf', 'linke klammer', 'öffnende klammer'],
            close: ['klammer zu', 'rechte klammer', 'schließende klammer']
          },
          decimal: ['komma', 'punkt', 'dezimal']
        },
        specificPhrases: {
          addTo: 'addiere (\\d+(?:\\.\\d+)?) zu (\\d+(?:\\.\\d+)?)',
          subtractFrom: 'subtrahiere (\\d+(?:\\.\\d+)?) von (\\d+(?:\\.\\d+)?)',
          multiplyBy: '(multipliziere|multipliziert) (\\d+(?:\\.\\d+)?) mit (\\d+(?:\\.\\d+)?)',
          divideBy: '(teile|geteilt) (\\d+(?:\\.\\d+)?) durch (\\d+(?:\\.\\d+)?)'
        },
        fillerWords: ['machen', 'stunden', 'stunde', 'kasten', 'und', 'der', 'die', 'das', 'ein', 'eine', 'gleich', 'ist', 'berechnen', 'ergebnis', 'bitte', 'für', 'von']
      },
      pt: {
        numbers: {
          'zero': '0', 'um': '1', 'dois': '2', 'três': '3', 'quatro': '4', 'cinco': '5',
          'seis': '6', 'sete': '7', 'oito': '8', 'nove': '9', 'dez': '10',
          'onze': '11', 'doze': '12', 'treze': '13', 'quatorze': '14', 'quinze': '15',
          'dezesseis': '16', 'dezessete': '17', 'dezoito': '18', 'dezenove': '19', 'vinte': '20',
          'trinta': '30', 'quarenta': '40', 'cinquenta': '50', 'sessenta': '60', 'setenta': '70',
          'oitenta': '80', 'noventa': '90', 'cem': '100',
          'milhão': '1000000', 'bilhão': '1000000000', 'trilhão': '1000000000000'
        },
        operations: {
          addition: ['mais', 'somar', 'e', 'adicionar'],
          subtraction: ['menos', 'subtrair', 'tirar'],
          multiplication: ['vezes', 'multiplicado por', 'x', 'multiplicar'],
          division: ['dividido por', 'dividir', 'sobre'],
          percentage: ['por cento', 'porcento'],
          percentOf: ['por cento de'],
          power: ['elevado a', 'à potência de', 'ao quadrado', 'ao cubo', 'potência'],
          sqrt: ['raiz quadrada de', 'raiz de', 'raiz quadrada'],
          parentheses: {
            open: ['abrir parênteses', 'parênteses esquerdo', 'abrir colchetes'],
            close: ['fechar parênteses', 'parênteses direito', 'fechar colchetes']
          },
          decimal: ['vírgula', 'ponto', 'decimal']
        },
        specificPhrases: {
          addTo: 'somar (\\d+(?:\\.\\d+)?) a (\\d+(?:\\.\\d+)?)',
          subtractFrom: 'subtrair (\\d+(?:\\.\\d+)?) de (\\d+(?:\\.\\d+)?)',
          multiplyBy: '(multiplicar|multiplicado) (\\d+(?:\\.\\d+)?) por (\\d+(?:\\.\\d+)?)',
          divideBy: '(dividir|dividido) (\\d+(?:\\.\\d+)?) por (\\d+(?:\\.\\d+)?)'
        },
        fillerWords: ['fazer', 'horas', 'hora', 'caixa', 'e', 'o', 'a', 'um', 'uma', 'igual', 'é', 'calcular', 'resultado', 'por favor', 'para', 'de']
      },
      it: {
        numbers: {
          'zero': '0', 'uno': '1', 'due': '2', 'tre': '3', 'quattro': '4', 'cinque': '5',
          'sei': '6', 'sette': '7', 'otto': '8', 'nove': '9', 'dieci': '10',
          'undici': '11', 'dodici': '12', 'tredici': '13', 'quattordici': '14', 'quindici': '15',
          'sedici': '16', 'diciassette': '17', 'diciotto': '18', 'diciannove': '19', 'venti': '20',
          'trenta': '30', 'quaranta': '40', 'cinquanta': '50', 'sessanta': '60', 'settanta': '70',
          'ottanta': '80', 'novanta': '90', 'cento': '100',
          'milione': '1000000', 'miliardo': '1000000000', 'trillione': '1000000000000'
        },
        operations: {
          addition: ['più', 'sommare', 'e', 'aggiungere'],
          subtraction: ['meno', 'sottrarre', 'togliere'],
          multiplication: ['per', 'moltiplicato per', 'x', 'moltiplicare'],
          division: ['diviso per', 'dividere', 'sopra'],
          percentage: ['per cento', 'percento'],
          percentOf: ['per cento di'],
          power: ['elevato a', 'alla potenza di', 'al quadrato', 'al cubo', 'potenza'],
          sqrt: ['radice quadrata di', 'radice di', 'radice quadrata'],
          parentheses: {
            open: ['apri parentesi', 'parentesi sinistra', 'apri quadre'],
            close: ['chiudi parentesi', 'parentesi destra', 'chiudi quadre']
          },
          decimal: ['virgola', 'punto', 'decimale']
        },
        specificPhrases: {
          addTo: 'sommare (\\d+(?:\\.\\d+)?) a (\\d+(?:\\.\\d+)?)',
          subtractFrom: 'sottrarre (\\d+(?:\\.\\d+)?) da (\\d+(?:\\.\\d+)?)',
          multiplyBy: '(moltiplicare|moltiplicato) (\\d+(?:\\.\\d+)?) per (\\d+(?:\\.\\d+)?)',
          divideBy: '(dividere|diviso) (\\d+(?:\\.\\d+)?) per (\\d+(?:\\.\\d+)?)'
        },
        fillerWords: ['fare', 'ore', 'ora', 'scatola', 'e', 'il', 'la', 'un', 'una', 'uguale', 'è', 'calcolare', 'risultato', 'per favore', 'per', 'di']
      }
    };
  
  // Get language-specific math patterns
  const getMathPatterns = useCallback((lang: string): LanguagePatterns => {
    return LANGUAGE_PATTERNS[lang] ?? LANGUAGE_PATTERNS['en'];
  }, []); // Dependencies: none

  // Precompile regex per language to avoid rebuilding on every normalization
  const compiledLanguageRegex = useMemo(() => {
    const p = getMathPatterns(language);
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const joinEscaped = (arr: string[]) => arr.map(escape).join('|');

    const numberWordsKeys = Object.keys(p.numbers).join('|');
    const numberWordsRegex = numberWordsKeys
      ? new RegExp(`\\b(${numberWordsKeys})\\b`, 'g')
      : null;

    const phraseAddTo = p.specificPhrases.addTo ? new RegExp(p.specificPhrases.addTo, 'g') : null;
    const phraseSubtractFrom = p.specificPhrases.subtractFrom ? new RegExp(p.specificPhrases.subtractFrom, 'g') : null;
    const phraseMultiplyBy = p.specificPhrases.multiplyBy ? new RegExp(p.specificPhrases.multiplyBy, 'g') : null;
    const phraseDivideBy = p.specificPhrases.divideBy ? new RegExp(p.specificPhrases.divideBy, 'g') : null;

    const addition = p.operations.addition.length ? new RegExp(`\\b(${joinEscaped(p.operations.addition)})\\b`, 'g') : null;
    const subtraction = p.operations.subtraction.length ? new RegExp(`\\b(${joinEscaped(p.operations.subtraction)})\\b`, 'g') : null;
    const multiplication = p.operations.multiplication.length ? new RegExp(`\\b(${joinEscaped(p.operations.multiplication)})\\b`, 'g') : null;
    const division = p.operations.division.length ? new RegExp(`\\b(${joinEscaped(p.operations.division)})\\b`, 'g') : null;
    const percentOf = p.operations.percentOf.length ? new RegExp(`\\b(${joinEscaped(p.operations.percentOf)})\\b`, 'g') : null;
    const percentage = p.operations.percentage.length ? new RegExp(`\\b(${joinEscaped(p.operations.percentage)})\\b`, 'g') : null;
    const power = p.operations.power.length ? new RegExp(`\\b(${joinEscaped(p.operations.power)})\\b`, 'g') : null;
    const sqrt = p.operations.sqrt.length ? new RegExp(`\\b(${joinEscaped(p.operations.sqrt)})\\b`, 'g') : null;
    const openParen = p.operations.parentheses.open.length ? new RegExp(`\\b(${joinEscaped(p.operations.parentheses.open)})\\b`, 'g') : null;
    const closeParen = p.operations.parentheses.close.length ? new RegExp(`\\b(${joinEscaped(p.operations.parentheses.close)})\\b`, 'g') : null;
    const decimal = p.operations.decimal.length ? new RegExp(`\\b(${joinEscaped(p.operations.decimal)})\\b`, 'g') : null;

    const filler = p.fillerWords.map(w => new RegExp(`\\b${escape(w)}\\b`, 'g'));

    return {
      patterns: p,
      numberWordsRegex,
      phraseAddTo,
      phraseSubtractFrom,
      phraseMultiplyBy,
      phraseDivideBy,
      addition,
      subtraction,
      multiplication,
      division,
      percentOf,
      percentage,
      power,
      sqrt,
      openParen,
      closeParen,
      decimal,
      filler,
    } as const;
  }, [language, getMathPatterns]);

  // Normalize spoken math expressions
  const normalizeSpokenMath = useCallback((text: string): string => {
    let normalized = text.toLowerCase();
    const compiled = compiledLanguageRegex;
    const patterns = compiled.patterns;

    // Handle compound numbers (e.g., "5million", "3billion", "2trillion") FIRST
    const compoundRegex = /(\d+)\s*(million|milliard|milliarde|milhão|milione|billion|mil millones|billón|bilhão|miliardo|trillion|trilhão|trillione)/g;
    normalized = normalized.replace(compoundRegex, (match, number, multiplier) => {
      const num = parseInt(number, 10);
      let result = num;

      // Apply multiplier based on the word
      switch (multiplier.toLowerCase()) {
        case 'million':
        case 'milliard':  // French for billion
        case 'milliarde': // German for billion
        case 'milhão':    // Portuguese for million
        case 'milione':   // Italian for million
          result = num * 1000000;
          break;
        case 'billion':
        case 'mil millones': // Spanish for billion
        case 'bilhão':       // Portuguese for billion
        case 'miliardo':     // Italian for billion
          result = num * 1000000000;
          break;
        case 'trillion':
        case 'billón':       // Spanish for trillion
        case 'trilhão':      // Portuguese for trillion
        case 'trillione':    // Italian for trillion
          result = num * 1000000000000;
          break;
      }

      return result.toString();
    });

    // Convert spelled-out numbers (basic numbers and standalone large numbers)
    const numWords = patterns.numbers;
    if (compiled.numberWordsRegex) {
      normalized = normalized.replace(compiled.numberWordsRegex, (match) => numWords[match]);
    }

    // IMPORTANT: Handle specific phrases BEFORE general replacements
    // Match numbers (integer or decimal)
    const numRegex = "\\d+(?:\\.\\d+)?"; 
    
    // Handle language-specific phrase patterns
    if (compiled.phraseAddTo) normalized = normalized.replace(compiled.phraseAddTo, '$1 + $2');
    if (compiled.phraseSubtractFrom) normalized = normalized.replace(compiled.phraseSubtractFrom, '$2 - $1');
    if (compiled.phraseMultiplyBy) normalized = normalized.replace(compiled.phraseMultiplyBy, '$2 * $3');
    if (compiled.phraseDivideBy) normalized = normalized.replace(compiled.phraseDivideBy, '$2 / $3');

    // --- General Replacements (Now run AFTER specific phrases) ---
    // Common operator words to symbols - Use word boundaries for robustness
    
    // Addition
    if (compiled.addition) normalized = normalized.replace(compiled.addition, ' + ');
    
    // Subtraction
    if (compiled.subtraction) normalized = normalized.replace(compiled.subtraction, ' - ');
    
    // Multiplication
    if (compiled.multiplication) normalized = normalized.replace(compiled.multiplication, ' * ');
    
    // Division
    if (compiled.division) normalized = normalized.replace(compiled.division, ' / ');
    
    // Percentage "of"
    if (compiled.percentOf) normalized = normalized.replace(compiled.percentOf, ' * 0.01 * ');
    
    // Percentage
    if (compiled.percentage) normalized = normalized.replace(compiled.percentage, ' % ');
    
    // Power
    if (compiled.power) normalized = normalized.replace(compiled.power, ' ^ ');
    
    // Square root
    if (compiled.sqrt) normalized = normalized.replace(compiled.sqrt, ' sqrt ');
    
    // Open parentheses
    if (compiled.openParen) normalized = normalized.replace(compiled.openParen, ' ( ');
    
    // Close parentheses
    if (compiled.closeParen) normalized = normalized.replace(compiled.closeParen, ' ) ');

    // Handle decimal points explicitly
    if (compiled.decimal) normalized = normalized.replace(compiled.decimal, '.');

    // Remove only true non-math filler words (do NOT remove operator keywords)
    compiled.filler.forEach(regex => {
      normalized = normalized.replace(regex, '');
    });

    // Final cleanup:
    // 1) Preserve 'sqrt' tokens
    normalized = normalized.replace(/\bsqrt\b/g, '__SQRT__');
    // 2) Remove apostrophes/quotes that can leak from contractions like what's
    normalized = normalized.replace(/[’'"`]+/g, ' ');
    // 3) Remove any remaining alphabetic sequences (then, and, etc.)
    normalized = normalized.replace(/[A-Za-z]+/g, ' ');
    // 4) Restore 'sqrt'
    normalized = normalized.replace(/__SQRT__/g, ' sqrt ');
    // 5) Collapse duplicate plus operators that can arise from phrase joins (e.g., "+ +")
    normalized = normalized.replace(/\+\s*\+/g, '+');
    
    // Consolidate spaces and trim
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }, [compiledLanguageRegex]); // Dependencies: compiled per language

  // Handle input and calculation (used by keypad and speech)
  const handleInput = useCallback((val: string, type: 'user' | 'keypad' | 'speech'): string => {
    if (!val.trim()) return MATH_ERROR;

    let expression = val;
    if (type === 'speech') {
      expression = normalizeSpokenMath(val);
    }

    // Replace visual operators with standard ones for mathjs
    expression = expression.replace(/×/g, '*').replace(/÷/g, '/');
    
    // For speech input, check if it's just a number BEFORE removing trailing operators
    // This way "plus 2" (which becomes "+2") is detected as having an operator
    if (type === 'speech') {
      const trimmedExpression = expression.trim();
      // Check if it's just a number (integer or decimal) without any operators
      // This regex checks for numbers that don't have +, -, *, /, ^, %, (, ) anywhere
      if (/^\d+(\.\d+)?$/.test(trimmedExpression)) {
        return MATH_ERROR;
      }
    }
    
    // Remove trailing operators (+, -, *, /) but keep % and ^
    expression = expression.trim().replace(/[+\-*/\s]+$/, '');
    
    // Handle percentage correctly - needs number before it
    expression = expression.replace(/(\d+)%/g, '($1 / 100)'); 
    // Allow trailing % interpreted as /100
    expression = expression.replace(/%/g, '/100');

    // Sanitize for security: Allow only expected characters
    const allowedChars = /^[\d\+\-\*\/\.\(\)\^\s\/e\s q r t]+$/; // Added space, e, q, r, t for sqrt
    if (!allowedChars.test(expression)) {
      // console.error('Invalid characters detected in expression:', expression);
      // Optionally show an error message to the user
      return MATH_ERROR;
    }

    let result = MATH_ERROR; // Default to internal error constant

    try {
      // Use math.evaluate for robust calculation
      const evaluatedResult = evaluate(expression);
      // Format the result according to user's locale
      if (typeof evaluatedResult === 'number') {
        result = formatNumber(evaluatedResult, language);
      } else {
        result = evaluatedResult.toString();
      }
    } catch (error) {
      // console.error('Calculation Error:', error);
      result = MATH_ERROR;
    }
    return result; // Return the calculated result or internal error constant
  }, [normalizeSpokenMath, formatNumber, language]); // Dependencies: normalizeSpokenMath (stable), formatNumber, language

  // Keypad buttons
  // const [advancedMode, setAdvancedMode] = useState(false); // Removed
  const [vibrationEnabled, setVibrationEnabled] = useState(true); // Add vibration state
  const KEYPAD = KEYPAD_LAYOUT;
  // Advanced row removed since we integrated it above

  // Define a function to determine button style
  const getKeypadButtonStyle = (key: string) => {
    if (Platform.OS === 'web') {
      return styles.keypadKeyWeb;
    }
    
    // For mobile
    if (key === 'CHECK_ICON') {
      return styles.keypadKeyEnter;
    } else if (['+', '-', '×', '÷', '()', '%', '^'].includes(key)) {
      // Add all special characters to the blue operator style
      return styles.keypadKeyOperator;
    } else {
      return styles.keypadKeyMobile;
    }
  };

  const onKeypadPress = useCallback((key: string) => {
    if (vibrationEnabled) {
      Vibration.vibrate(5); // Changed from 10 to 3 for less aggressive vibration
    }
    
    // Add reset handling
    if (key === '↺') {
      setBubbles([]);
      setKeypadInput('');
      setPreviewResult(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      return;
    }
    
    // Define helper variables for better readability
    const isEnterOrCheck = key === '=' || key === 'ok' || key === 'CHECK_ICON';
    const isBackspace = key === '⌫';
    const isClearingKey = isEnterOrCheck || isBackspace;
    
    // Check if adding this key would exceed the 100 digit limit
    // Only check for digit keys, not operators or special characters
    if (!isClearingKey && /\d/.test(key)) {
      const digitCount = keypadInput.replace(/[^\d]/g, '').length;
      if (digitCount >= 100) {
        setBubbles(prev => [...prev, { 
          id: (bubbleIdRef.current++).toString(), 
          type: 'error', 
          content: t('mainApp.mathErrors.invalidExpression') 
        }]);
        return;
      }
    }
    
    // Handle input after a calculation (when we have a gray result)
    if (expectingFreshInput) {
      // Case 1: Enter/Check/Backspace - clear input and start new
      if (isClearingKey) {
        setKeypadInput('');
        setPreviewResult(null);
        
        // Remove the result-input bubble and add an empty user bubble
        setBubbles(prev => {
          const filtered = prev.filter(b => b.type !== 'result-input');
        return [...filtered, { id: (bubbleIdRef.current++).toString(), type: 'user', content: '' }];
        });
        
        setExpectingFreshInput(false);
        // Scroll to bottom after clearing
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
        return;
      }
      
      // Case 2: Any other key - confirm result and continue
      const currentResult = keypadInput;
      
      // Append the key to the current result
      const newInput = currentResult + key;
      setKeypadInput(newInput);
      
      // Replace gray result with white result and continue
      setBubbles(prev => {
        const filtered = prev.filter(b => b.type !== 'result-input');
        return [...filtered, { id: (bubbleIdRef.current++).toString(), type: 'user', content: newInput }];
      });
      
      setExpectingFreshInput(false);
      // Scroll to bottom after continuing
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      return;
    }
    
    // Normal input flow (not after a calculation)
    // Reset expectingFreshInput flag for all keys except Enter/Check
    if (!isEnterOrCheck) {
      setExpectingFreshInput(false);
    }

    if (key === '.') {
      // Add the dot to the input ONLY
      let newInput = keypadInput + '.';
      setKeypadInput(newInput);
      setBubbles(prev => {
        const others = prev.filter(b => b.type !== 'user' || b.content !== keypadInput);
        return [...others, { id: (bubbleIdRef.current++).toString(), type: 'user', content: newInput }];
      });
      // Scroll to bottom after adding dot
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      return;
    }
    if (key === 'C') { // Note: 'C' is no longer on the keypad but logic kept for potential future use/safety
      setKeypadInput('');
      // Remove the live equation bubble if exists
      setBubbles(prev => prev.filter(b => b.type !== 'user' || b.content !== keypadInput));
      // Scroll to bottom after clearing
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      return;
    }
    if (key === '⌫') {
      // Normal backspace behavior
      const newInput = keypadInput.slice(0, -1);
      setKeypadInput(newInput);
      // Update or remove the live equation bubble
      setBubbles(prev => {
        const others = prev.filter(b => b.type !== 'user' || b.content !== keypadInput);
        if (newInput) {
          return [...others, { id: (bubbleIdRef.current++).toString(), type: 'user', content: newInput }];
        }
        return others;
      });
      // Scroll to bottom after backspace
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      return;
    }
    
    // Shift+Backspace for reset
    if (key === 'SHIFT_BACKSPACE') {
      // Perform reset
      setBubbles([]);
      setKeypadInput('');
      setPreviewResult(null);
      setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
      return;
    }
    
    if (key === 'CHECK_ICON') { // Handle check icon as 'ok' button
      key = 'ok'; // Process as 'ok' for the rest of the function
    }

    let newInput = keypadInput;
    if (key === '()') {
      // Smart parenthesis: insert ( or ) depending on balance
      const open = (keypadInput.match(/\(/g) || []).length;
      const close = (keypadInput.match(/\)/g) || []).length;
      if (open > close) {
        newInput += ')';
      } else {
        newInput += '(';
      }
    
    } else if (key === '%') {
      newInput += '%'; // Append percentage sign
    } else if (key === 'ok' || key === '=') { // Handle 'ok' and '=' for calculation
      // --- New '=' logic --- 
      // Determine bubble type based on how input was entered (assume keypad for now)
      const inputTypeForBubble : ChatBubble['type'] = 'user'; // Could be 'speech' if triggered differently
      const expressionToCalc = keypadInput;

      // Perform calculation
      const result = handleInput(expressionToCalc, 'keypad'); 

      // Create bubbles based on the calculation
      if (result !== MATH_ERROR) {
        // Create a bubble showing the equation with equals sign
        const equationBubble: ChatBubble = { id: (bubbleIdRef.current++).toString(), type: 'user', content: `${expressionToCalc} = ${result}` };
        // Create the result bubble to show just the result
        const resultBubble: ChatBubble = { id: (bubbleIdRef.current++).toString(), type: 'calc', content: result };
        
        if (enterKeyNewLine) {
          // New Line Mode: Create a new empty user bubble instead of showing the result
          const newEmptyBubble: ChatBubble = {
            id: (bubbleIdRef.current++).toString(), 
            type: 'user',
            content: ''
          };
          
          setBubbles(prev => {
            // Remove the current equation bubble if it exists
            const filteredBubbles = prev.filter(b => b.type !== 'user' || b.content !== keypadInput);
            // Append the equation bubble, result bubble, and a new empty bubble
            return [...filteredBubbles, equationBubble, resultBubble, newEmptyBubble];
          });
          
          // Clear the input field for a fresh start
          setKeypadInput('');
        } else {
          // Normal Mode: Show the result in the input field
          const nextUserBubble: ChatBubble = { 
            id: (bubbleIdRef.current++).toString(), 
            type: 'result-input',
            content: result 
          };
          
          setBubbles(prev => {
            // Remove the current equation bubble if it exists
            const filteredBubbles = prev.filter(b => b.type !== 'user' || b.content !== keypadInput);
            // Append the equation bubble, result bubble and the result input bubble
            return [...filteredBubbles, equationBubble, resultBubble, nextUserBubble];
          });
          
          // Set input to the result
          setKeypadInput(result);
        }
        // Don't set preview result to null - we want to show the gray result-input bubble instead
        setExpectingFreshInput(true); // Next '=' will clear
        lastResultRef.current = result; // Set the ref here
        
        // Send data to webhook when OK/Enter is pressed
        if (historyEnabled) {
          addCalculation(expressionToCalc, result);
        }
        sendWebhookData(expressionToCalc, result);
        
        // Scroll to bottom after calculation
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      } else {
        const errorBubble: ChatBubble = { id: (bubbleIdRef.current++).toString(), type: 'error', content: t('mainApp.mathErrors.error') }; // Or use a specific error message
        setBubbles(prev => [...prev, errorBubble]); // Add only error bubble
        setKeypadInput(''); // Clear input on error
        setPreviewResult(null);
        setExpectingFreshInput(false);
        // Scroll to bottom after error
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      }
      return; // End processing for '='
      // --- End new '=' logic ---
    } else {
      newInput += key; // Append digits, operators, dot
    }
    setKeypadInput(newInput);

    // Update or add the live equation bubble
    setBubbles(prev => {
      const others = prev.filter(b => b.type !== 'user' || b.content !== keypadInput);
      return [...others, { id: (bubbleIdRef.current++).toString(), type: 'user', content: newInput }];
    });
    
    // Always scroll to bottom after any key press
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
  }, [keypadInput, handleInput, setKeypadInput, setBubbles, expectingFreshInput, vibrationEnabled]); // Dependencies: state and handlers

  // Consolidated web keyboard handling (space to record, paste, keypad, mute, reset)
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    // Spacebar toggles recording when not transcribing
    if (e.code === 'Space' && !isTranscribing) {
      e.preventDefault();
      if (!isRecording) {
        startRecording();
      } else {
        setIsRecording(false);
      }
      return;
    }

    // Paste support
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const filtered = text.replace(/[^0-9+\-*/.()%^]/g, '');
        if (filtered) {
          filtered.split('').forEach(char => onKeypadPress(char));
        }
      });
      return;
    }

    // Mute toggle
    if (e.key.toLowerCase() === 'm') {
      toggleSpeechMute();
      return;
    }

    // Ctrl+Backspace reset
    if (e.key === 'Backspace' && e.ctrlKey) {
      setBubbles([]);
      setKeypadInput('');
      setPreviewResult(null);
      e.preventDefault();
      return;
    }
    
    // Calculator keypad mapping
    const allowed = ['0','1','2','3','4','5','6','7','8','9','+','-','×','÷','.','(',')','%','^','√'];
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
  }, [isTranscribing, isRecording, onKeypadPress, toggleSpeechMute]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  // Removed in favor of consolidated handleGlobalKeyDown

  // Scroll management moved to FlatList onContentSizeChange to avoid timers

  // Live result preview effect with debounce to limit evaluate churn
  useEffect(() => {
    const input = keypadInput;
    if (!input.trim()) {
      setPreviewResult(null);
      return;
    }
    const timeout = setTimeout(() => {
    try {
        let expression = input.replace(/×/g, '*').replace(/÷/g, '/');
      expression = expression.replace(/(\d+)%/g, '($1 / 100)');
      expression = expression.replace(/%/g, '/100'); // Trailing %

      const lastChar = expression.trim().slice(-1);
      if (['+','-','*','/','^','('].includes(lastChar)) {
          return;
      }

      const result = evaluate(expression);
      if (typeof result === 'number' || (typeof result === 'string' && !isNaN(parseFloat(result)))) {
        const formattedResult = typeof result === 'number' ? formatNumber(result, language) : result.toString();
          if (input.trim() === formattedResult) {
          setPreviewResult(null);
        } else {
          setPreviewResult(formattedResult);
        }
      } else {
          setPreviewResult(null);
      }
    } catch (error) {
      setPreviewResult(null);
    }
    }, 100);
    return () => clearTimeout(timeout);
  }, [keypadInput, formatNumber, language]);

  // Single TTS function to prevent duplicates
  const speakSingleResult = useCallback((text: string) => {
    if (isTTSSpeaking.current) {
      Speech.stop(); // Cancel any ongoing speech
    }

    isTTSSpeaking.current = true;
    Speech.speak(text, {
      language: getSpeechRecognitionLanguage(language),
      pitch: 1.0,
      rate: 1.1,
      onStart: () => {
        isTTSSpeaking.current = true;
      },
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
      }
    });
  }, [language]);

  // Single unified speech result processor (DRY principle)
  const processSpeechResult = useCallback((transcript: string, source: 'web' | 'native') => {
    if (!transcript.trim()) return;

    // Prevent duplicate processing in continuous mode
    if (source === 'web' && lastProcessedTranscriptRef.current === transcript) {
      return;
    }
    lastProcessedTranscriptRef.current = transcript;

    // Keep interim transcript visible during processing

    let processedEquation = normalizeSpokenMath(transcript);
    processedEquation = processedEquation.trim();

    // Check if input starts with an operator and prepend last result if applicable
    const startsWithOperator = ['+', '-', '*', '/', '%'].some(op =>
      processedEquation.startsWith(op)
    );
    if (startsWithOperator) {
      const lastResult = lastResultRef.current;
      if (lastResult !== null) {
        processedEquation = lastResult + ' ' + processedEquation;
      }
    }

    // Calculate the result
    const result = handleInput(processedEquation, 'speech');

    if (result !== MATH_ERROR) {
      // Clear interim transcript immediately on success so gray text disappears
      setInterimTranscript('');

      // Create bubbles for display
      const equationBubble: ChatBubble = {
        id: (bubbleIdRef.current++).toString(),
        type: 'user',
        content: `${processedEquation} = ${result}`
      };
      const resultBubble: ChatBubble = {
        id: (bubbleIdRef.current++).toString(),
        type: 'calc',
        content: result
      };

      if (enterKeyNewLine) {
        const newEmptyBubble: ChatBubble = {
          id: (bubbleIdRef.current++).toString(),
          type: 'user',
          content: ''
        };

        setBubbles(prev => {
          const filteredBubbles = prev.filter(b => b.type !== 'user' || b.content !== keypadInput);
          return [...filteredBubbles, equationBubble, resultBubble, newEmptyBubble];
        });

        setKeypadInput('');
        setPreviewResult(null);
      } else {
        const nextUserBubble: ChatBubble = {
          id: (bubbleIdRef.current++).toString(),
          type: 'result-input',
          content: result
        };

        setBubbles(prev => {
          const filteredBubbles = prev.filter(b => b.type !== 'user' || b.content !== keypadInput);
          return [...filteredBubbles, equationBubble, resultBubble, nextUserBubble];
        });

        setKeypadInput(result);
      }

      // Single TTS call point (no duplication)
      if (!speechMutedRef.current && result !== lastSpokenResultRef.current) {
        lastSpokenResultRef.current = result;
        speakSingleResult(result);
      }

      lastResultRef.current = result;
      setExpectingFreshInput(true);

      // Webhook and history
      if (historyEnabled) {
        addCalculation(processedEquation, result);
      }
      sendWebhookData(processedEquation, result);
    } else {
      // Clear interim transcript and show "No Equation Detected" bubble for MATH_ERROR
      setInterimTranscript('');
      
      // Add error bubble for invalid equations
      const errorBubble: ChatBubble = {
        id: (bubbleIdRef.current++).toString(),
        type: 'error',
        content: 'No Equation Detected'
      };
      
      setBubbles(prev => [...prev, errorBubble]);
      
      setKeypadInput('');
      setExpectingFreshInput(false);
    }
  }, [normalizeSpokenMath, handleInput, enterKeyNewLine, keypadInput, historyEnabled, speechMutedRef, lastResultRef, t, lastProcessedTranscriptRef, lastSpokenResultRef, speakSingleResult]);

// Audio recording logic for speech-to-text
// Platform-specific speech-to-text
  const startRecording = async () => {
    if (isRecording) return;
    setIsRecording(true);

    if (Platform.OS === 'web') {
      const WebSpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!WebSpeechRecognition) {
        Alert.alert(t('mainApp.speechNotSupported'));
        setIsRecording(false);
        return;
      }
      
      recognitionRef.current = new WebSpeechRecognition();
      const recognition = recognitionRef.current;
      recognition.lang = getSpeechRecognitionLanguage(language);
      recognition.interimResults = true;
      recognition.continuous = continuousMode;
      recognition.maxAlternatives = 1; // Fastest processing with single result
      recognition.serviceURI = ''; // Use default for best performance

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

        // Always update interim transcript for real-time streaming
        if (interimText) {
          setInterimTranscript(interimText);
        }

        // Only process final results
        if (finalTranscript) {
          processSpeechResult(finalTranscript.trim(), 'web');
        }
      };

      recognition.onend = () => {
        // In continuous mode, we only stop when the user clicks the button.
        // The service might stop on its own after a long pause, but we let `stopRecording` handle the state.
        if (!continuousMode) {
          setIsRecording(false);
          setInterimTranscript('');
        }
      };
      
      recognition.start();
    } else {
      // --- Native speech recognition (Android/iOS) ---
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
            setInterimTranscript(transcript);
          }
        };

        const handleError = () => {
          setIsRecording(false);
          setInterimTranscript('');
          // Handle error display
        };

        speechListenerRef.current = ExpoSpeechRecognitionModule.addListener('result', handleResult);
        errorListenerRef.current = ExpoSpeechRecognitionModule.addListener('error', handleError);

        await ExpoSpeechRecognitionModule.start({
          lang: getSpeechRecognitionLanguage(language),
          continuous: true,
          interimResults: true,
        });

        if (continuousMode) {
          let lastTranscript = '';
          silenceTimerRef.current = setInterval(() => {
            // CONDITIONAL RULE: Skip processing if TTS is currently speaking
            if (isTTSSpeaking.current) return;

            // Ensure we have clean transcript data to work with
            if (interimTranscript && interimTranscript === lastTranscript && interimTranscript.trim()) {
              const finalTranscript = interimTranscript.trim();
              if (finalTranscript) {
                processSpeechResult(finalTranscript, 'native');
              }
            }
            lastTranscript = interimTranscript;
          },500); // Reduced to 500ms for instant continuous mode response
        }

      } catch (e) {
        setIsRecording(false);
        // Handle error
      }
    }
  };

  // Only needed for manual stop (web or if we need to cancel)
  const stopRecording = async () => {
    setIsRecording(false);
    setInterimTranscript('');
    // Reset ALL refs to prevent stale data and buffer accumulation
    lastProcessedTranscriptRef.current = '';
    lastSpokenResultRef.current = '';
    lastTranscriptRef.current = '';
    // Ensure TTS state is cleared when stopping recording
    isTTSSpeaking.current = false;
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (Platform.OS === 'web') {
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
        if (errorListenerRef.current) errorListenerRef.current.remove();
      } catch (e) {
        // console.error('Error stopping native speech recognition:', e);
      }
    }
  };



  // --- Send Data to Webhooks ---
  const sendWebhookData = async (equation: string, result: string) => {
    if (!webhookSettingsLoaded) {
      // Store calculation for later without logging
      pendingWebhookDataRef.current.push({ 
        equation: sanitizeInput(equation), 
        result: sanitizeInput(result) 
      });
      return;
    }

    const activeWebhooks = webhookUrls.filter(webhook => webhook.active);
    
    if (activeWebhooks.length === 0) {
      // Store calculation for later without logging
      pendingWebhookDataRef.current.push({ 
        equation: sanitizeInput(equation), 
        result: sanitizeInput(result) 
      });
      return;
    }

    // Sanitize input before sending to webhook
    const sanitizedEquation = sanitizeInput(equation);
    const sanitizedResult = sanitizeInput(result);

    const dataToSend = {
      equation: sendEquation ? sanitizedEquation : undefined,
      result: sanitizedResult
    };

    if (streamResults) {
      try {
        const promises = activeWebhooks.map(webhook => {
          // Additional validation of webhook URL
          const validatedUrl = validateWebhookUrl(webhook.url);
          if (!validatedUrl) {
            console.warn('Invalid webhook URL detected:', webhook.url);
            return Promise.resolve(); // Skip this webhook
          }
          
          return axios.post(validatedUrl, dataToSend, {
            headers: {
              'Content-Type': 'application/json',
              // Prevent CSRF
              'X-Requested-With': 'XMLHttpRequest'
            },
            // Set timeout to prevent hanging requests
            timeout: 5000
          });
        }).filter(Boolean); // Filter out any skipped webhooks
        
        await Promise.allSettled(promises);
      } catch (error) {
        // Silent error handling for production
        if (Platform.OS === 'android') {
          ToastAndroid.show(t('mainApp.couldNotSendData'), ToastAndroid.SHORT);
        }
      }
    } else {
      // Add to bulk queue without logging
      const newItem = {
        id: bubbleIdRef.current++,
        timestamp: Date.now(),
        data: JSON.stringify(dataToSend)
      };
      setBulkData(prev => [...prev, newItem]);
    }
  };

  // Helper function to sanitize user input
  const sanitizeInput = (input: string): string => {
    if (!input) return '';
    
    // Remove any HTML/script tags
    let sanitized = input.replace(/<[^>]*>/g, '');
    
    // Encode special characters
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
      
    // Limit the length to prevent DoS
    return sanitized.substring(0, 1000);
  };

  // Helper function to validate webhook URLs
  const validateWebhookUrl = (url: string): string | null => {
    try {
      // Basic URL validation
      if (!url || typeof url !== 'string') return null;
      
      // Must start with http:// or https://
      if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
      
      // Create URL object to validate and parse
      const parsedUrl = new URL(url);
      
      // Check for valid protocol (extra safety)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null;
      
      // Additional checks could be added here, e.g. blocklist of domains
      
      return url;
    } catch (e) {
      // If URL parsing fails, return null
      return null;
    }
  };

  // --- Load/Save Webhook Settings ---
  const SETTINGS_KEYS = {
    URLS: 'webhookUrls',
    SEND_EQUATION: 'sendEquation',
    STREAM_RESULTS: 'streamResults',
  };

  const loadSettings = useCallback(async () => {
    try {
      const [storedUrls, storedSendEquation, storedStreamResults] = await Promise.all([
        AsyncStorage.getItem('webhookUrls'),
        AsyncStorage.getItem('sendEquation'),
        AsyncStorage.getItem('streamResults')
      ]);

      if (storedUrls) {
        const parsedUrls = JSON.parse(storedUrls);
        const webhookItems = parsedUrls.map((url: string | WebhookItem) => {
          if (typeof url === 'string') {
            return { url, active: true };
          }
          return url;
        });
        setWebhookUrls(webhookItems);
      }

      if (storedSendEquation) {
        const parsedSendEquation = JSON.parse(storedSendEquation);
        setSendEquation(parsedSendEquation);
      }

      if (storedStreamResults) {
        const parsedStreamResults = JSON.parse(storedStreamResults);
        setStreamResults(parsedStreamResults);
      }

      setWebhookSettingsLoaded(true);

      // Process any pending data silently
      const activeWebhooksExist = webhookUrls.some(webhook => webhook.active);
      if (pendingWebhookDataRef.current.length > 0 && activeWebhooksExist) {
        const activeWebhooks = webhookUrls.filter(webhook => webhook.active);
        
        for (const { equation, result } of pendingWebhookDataRef.current) {
          const dataToSend = {
            equation: sendEquation ? equation : undefined,
            result
          };
          
          try {
            const promises = activeWebhooks.map(webhook => 
              sendWebhook(webhook.url, dataToSend)
            );
            await Promise.allSettled(promises);
          } catch (error) {
            // Silent error handling
          }
        }
        
        pendingWebhookDataRef.current = [];
      }
    } catch (error) {
      setWebhookSettingsLoaded(true);
    }
  }, [webhookUrls, sendEquation, streamResults]);

  const saveSettings = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem('webhookUrls', JSON.stringify(webhookUrls)),
        AsyncStorage.setItem('sendEquation', JSON.stringify(sendEquation)),
        AsyncStorage.setItem('streamResults', JSON.stringify(streamResults))
      ]);
    } catch (error) {
      // Silent error handling
      if (Platform.OS === 'android') {
        ToastAndroid.show(t('mainApp.couldNotSaveSettings'), ToastAndroid.SHORT);
      }
    }
  }, [webhookUrls, sendEquation, streamResults]);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [storedOpenInCalcMode, storedSpeechMuted, storedHistoryEnabled, storedContinuousMode] = await Promise.all([
          AsyncStorage.getItem('openInCalcMode'),
          AsyncStorage.getItem('speechMuted'),
          AsyncStorage.getItem('historyEnabled'),
          AsyncStorage.getItem('continuousMode')
        ]);

        // Initialize calculator mode
        if (storedOpenInCalcMode !== null) {
          const shouldOpenInCalcMode = JSON.parse(storedOpenInCalcMode);
          setOpenInCalcMode(shouldOpenInCalcMode);
          if (shouldOpenInCalcMode && Platform.OS !== 'web') {
            setShowKeypad(true);
          }
        }

        // Initialize speech muted state
        if (storedSpeechMuted !== null) {
          const isMuted = JSON.parse(storedSpeechMuted);
          setIsSpeechMuted(isMuted);
          speechMutedRef.current = isMuted;
        }
        
        // Initialize history enabled state
        if (storedHistoryEnabled !== null) {
          const isHistoryEnabled = JSON.parse(storedHistoryEnabled);
          setHistoryEnabled(isHistoryEnabled);
        }

        if (storedContinuousMode !== null) {
          setContinuousMode(JSON.parse(storedContinuousMode));
        }
      } catch (error) {
        // Silent error handling
      }
    };
    loadSettings();
  }, []);

  // Save settings when they change (avoid redundant writes)
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
      } catch (error) {
        // Silent error handling
      }
    };
    saveSettings();
  }, [openInCalcMode, isSpeechMuted, historyEnabled, continuousMode]);

  // --- Component Lifecycle & Effects ---
  
  // Removed extra shortcuts listener; consolidated above

  // --- Webhook Logic Handlers ---
  const handleAddWebhook = () => {
    const trimmedUrl = newWebhookUrl.trim();
    const trimmedTitle = newWebhookTitle.trim();
    const urlExists = webhookUrls.some(webhook => webhook.url === trimmedUrl);
    
    if (trimmedUrl && !urlExists) {
      // Basic URL validation (starts with http/https)
      if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
         // Add new webhook with active state set to true by default and include the title
         const newWebhook = { 
           url: trimmedUrl, 
           active: true,
           title: trimmedTitle || undefined // Only include title if it's not empty
         };
         setWebhookUrls([...webhookUrls, newWebhook]);
         setNewWebhookUrl(''); // Clear URL input
         setNewWebhookTitle(''); // Clear title input
      } else {
        Alert.alert(t('mainApp.invalidUrl'), t('mainApp.invalidUrlMessage'));
      }
    } else if (urlExists) {
      Alert.alert(t('mainApp.duplicate'), t('mainApp.duplicateUrlMessage'));
    } else {
      Alert.alert(t('mainApp.invalidUrl'), t('mainApp.invalidUrlMessage'));
    }
  };

  const handleDeleteWebhook = (urlToDelete: string) => {
    setWebhookUrls(webhookUrls.filter(webhook => webhook.url !== urlToDelete));
  };
  
  // Handle toggling webhook activation
  const handleToggleWebhook = (url: string, active: boolean) => {
    setWebhookUrls(webhookUrls.map(webhook => 
      webhook.url === url ? { ...webhook, active } : webhook
    ));
  };

  // Implement handleSendBulkData to send bulk data to active webhooks
  const handleSendBulkData = async () => {
    if (bulkData.length === 0) {
      Alert.alert(t('mainApp.noData'), t('mainApp.noDataMessage'));
      return;
    }
    const activeWebhooks = webhookUrls.filter(webhook => webhook.active);
    if (activeWebhooks.length === 0) {
      Alert.alert(t('mainApp.noActiveUrls'), t('mainApp.noActiveUrlsMessage'));
      return;
    }

    setIsSendingBulk(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      // Create promises for sending each bulk item to all active URLs
      const bulkSendPromises = bulkData.map(item => {
        const itemData = { data: item.data }; // Structure expected by webhook
        
        // Create an array of promises for each active webhook URL
        const urlPromises: Promise<any>[] = [];
        
        // Explicitly iterate over each active webhook
        for (const webhook of activeWebhooks) {
          // Extract the URL as a string to avoid type issues
          const webhookUrl: string = webhook.url;
          
          // Create a promise for this webhook
          const promise = sendWebhook(webhookUrl, itemData)
          .then(response => {
            // Return a simple object with string url
            const successPayload = {
              url: webhookUrl,
              response: response
            };
            return successPayload;
          })
          .catch(error => {
            // Create and throw a simple object with string url
            const failurePayload = {
              url: webhookUrl,
              error: error
            };
            throw failurePayload;
          });
          
          urlPromises.push(promise);
        }
        
        // Return settled promises for all URLs for this item
        return Promise.allSettled(urlPromises);
      });

      // Wait for all items to be sent (or fail)
      const allItemsResults = await Promise.allSettled(bulkSendPromises);

      // Process results for each item
      for (let i = 0; i < allItemsResults.length; i++) {
        const itemOutcome = allItemsResults[i];
        const itemIndex = i;
        
        if (itemOutcome.status === 'fulfilled') {
          // Explicitly type the array of promise results
          const urlResults = itemOutcome.value;
          
          // Process each URL result using indexed for loop to avoid type issues
          for (let j = 0; j < urlResults.length; j++) {
            const urlOutcome = urlResults[j];
            
            if (urlOutcome.status === 'fulfilled') {
              successCount++;
            } else {
              failureCount++;
              // Explicitly cast the reason to our failure payload type
              const failureInfo = urlOutcome.reason;
              // Keep failure count; avoid noisy logs in production
            }
          }
        } else {
          // This means the Promise.allSettled for an item batch rejected
          // Count as failures without logging
          failureCount += activeWebhooks.length; // Assume failure for all URLs for this item
        }
      }

      // Clear bulk data after attempting to send
      setBulkData([]);

      // Provide summary feedback
      Alert.alert(
        t('mainApp.bulkSendComplete'),
        `Successfully sent data to ${successCount} endpoints.\nFailed to send data to ${failureCount} endpoints.`
      );

      } catch (error) {
        // Silent error handling
      Alert.alert(t('mainApp.bulkSendError'), t('mainApp.bulkSendErrorMessage'));
      // Decide if bulkData should be cleared even on catastrophic failure
      // setBulkData([]);
    } finally {
      setIsSendingBulk(false);
    }
  };

  // Render chat bubble
  const renderBubble = useCallback(({ item, index }: { item: ChatBubble, index: number }) => {
    const isLastBubble = index === bubbles.length - 1;
    const isCurrentUserBubble = item.type === 'user' && isLastBubble && item.content === keypadInput;

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
        setBubbles(prev => [
          { 
            id: (bubbleIdRef.current++).toString(), 
            type: 'calc', 
            content: t('mainApp.answerCopiedToClipboard') 
          },
          ...prev
        ]);
        // Remove the notification bubble after 2 seconds
        setTimeout(() => {
          setBubbles(prev => prev.slice(1));
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
      // Special-case: show "No Equation Detected" like interim stream (gray text), not as a red error bubble
      if (item.content === 'No Equation Detected') {
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
            <Text style={[styles.userText, {color: '#aaa'}]}>{item.content || ' '}</Text>
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
                {interimTranscript ? interimTranscript : (item.content || ' ')}
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
  }, [bubbles.length, keypadInput, vibrationEnabled, interimTranscript]);

  // Log rendering outside of JSX to avoid TypeScript errors
  // console.log('CalculatorScreen rendering...');
  
  // Wrapper component for Web Empty State
  const WebEmptyState = () => {
    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/images/LOGO.png')} 
            style={{ width: 200, height: 80 }}
            resizeMode="contain"
            fadeDuration={0}
            // Use default loading priority
            defaultSource={require('../assets/images/LOGO.png')}
          />
          <Text style={styles.betaText}>BETA</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <AppIcon name="keyboard-space" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>{t('mainApp.pressSpaceToRecord')}</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <AppIcon name="send" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>{t('mainApp.pressSendToConfirm')}</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <AppIcon name="webhook" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>{t('mainApp.useWebhookForSheets')}</Text>
        </View>
      </View>
    );
  };

  // Wrapper component for Mobile Empty State
  const MobileEmptyState = () => {
    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/images/LOGO.png')} 
            style={{ width: 180, height: 72 }}
            resizeMode="contain"
            fadeDuration={0}
            // Use default loading priority
            defaultSource={require('../assets/images/LOGO.png')}
          />
          <Text style={styles.betaText}>BETA</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <AppIcon name="microphone" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>{t('mainApp.pressRecordIcon')}</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <AppIcon name="send" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>{t('mainApp.pressSendToConfirm')}</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <AppIcon name="webhook" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>{t('mainApp.useWebhookToSend')}</Text>
        </View>
      </View>
    );
  };

  // Show header controls unless keypad is shown
  const renderHeaderControls = () => {
    // Header controls are always visible now
    return (
      <View style={styles.headerControls}>
        {/* Reset Button: only show if there is at least one bubble AND keyboard is off */}
        {bubbles.length > 0 && !showKeypad && (
          <View style={styles.tooltipContainer}>
            <Pressable 
              onPress={() => {
                setBubbles([]);
                setKeypadInput('');
                setPreviewResult(null);
              }}
              style={styles.resetButton}
              onHoverIn={() => Platform.OS === 'web' && toggleTooltip('reset')}
              onHoverOut={() => Platform.OS === 'web' && toggleTooltip(null)}
            >
              <AppIcon name="refresh" size={24} color="#888" style={{ transform: [{ scaleX: -1 }] }} />
            </Pressable>
            {hoveredTooltip === 'reset' && Platform.OS === 'web' && (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>{t('mainApp.resetCtrlBackspace')}</Text>
              </View>
            )}
          </View>
        )}
        {/* History Button: always show */}
        <View style={styles.tooltipContainer}>
          <Pressable 
            onPress={() => setShowHistoryModal(true)}
            onHoverIn={() => Platform.OS === 'web' && toggleTooltip('history')}
            onHoverOut={() => Platform.OS === 'web' && toggleTooltip(null)}
          >
            <HistoryButton onPress={() => setShowHistoryModal(true)} />
          </Pressable>
          {hoveredTooltip === 'history' && Platform.OS === 'web' && (
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>{t('history.calculationHistory')}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const emptyComponent = useMemo(() => (
    showKeypad ? null : (Platform.OS === 'web' ? <WebEmptyState /> : <MobileEmptyState />)
  ), [showKeypad, language]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      
      {/* Render Header Controls */}
      {renderHeaderControls()}

      <FlatList
        style={{ flex: 1 }}
        ref={flatListRef}
        data={
          interimTranscript
            ? (() => {
                return [...bubbles, { id: 'interim_speech', type: 'user' as const, content: interimTranscript }];
              })()
            : previewResult
            ? [...bubbles, { id: 'preview', type: 'result' as const, content: previewResult }]
            : bubbles
        }
        renderItem={renderBubble}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.chatArea}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={emptyComponent}
        getItemLayout={(data, index) => ({
          length: 60, // Average height of a bubble
          offset: 60 * index,
          index
        })}
        windowSize={5}
        maxToRenderPerBatch={10}
        removeClippedSubviews={Platform.OS !== 'web'}
        initialNumToRender={15}
      />

      {showKeypad && (
        <View style={isWebMobile ? styles.calculatorAreaMobileWeb : styles.calculatorArea}>
          <TouchableOpacity
            style={{
              alignSelf: 'flex-end',
              padding: 10,
              marginRight: 20,
              marginBottom: 0, // Consistent spacing
            }}
            onPress={() => onKeypadPress('⌫')}
            activeOpacity={0.7}
            delayPressIn={0}
          >
            <AppIcon name="backspace" size={28} color="#eee" />
          </TouchableOpacity>
          <View style={styles.keypadContainer}>
            {KEYPAD.map((row, i) => (
              <View key={i} style={styles.keypadRow}>
                {row.map((key) => {
                  // Determine the button style
                  let buttonStyle;
                  if (Platform.OS === 'web') {
                    if (isWebMobile) {
                      // WEB MOBILE: Apply native mobile styles directly
                      if (key === 'CHECK_ICON') {
                        buttonStyle = styles.keypadKeyEnter;
                      } else if (['+', '-', '×', '÷', '()', '%', '^'].includes(key)) { // Comprehensive operator list
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
                    } else if (['+', '-', '×', '÷'].includes(key)) { // Original, less comprehensive operator list for native
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
                        <AppIcon name="refresh" size={28} color="#eee" style={{ transform: [{ scaleX: -1 }] }} />
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
      )}
      
      {/* Settings Modal */}
      <Suspense fallback={null}>
        <Settings
          visible={isSettingsModalVisible}
          onClose={() => setIsSettingsModalVisible(false)}
          webhookUrls={webhookUrls}
          newWebhookUrl={newWebhookUrl}
          setNewWebhookUrl={setNewWebhookUrl}
          newWebhookTitle={newWebhookTitle}
          setNewWebhookTitle={setNewWebhookTitle}
          handleAddWebhook={handleAddWebhook}
          handleDeleteWebhook={handleDeleteWebhook}
          handleToggleWebhook={handleToggleWebhook}
          sendEquation={sendEquation}
          setSendEquation={setSendEquation}
          streamResults={streamResults}
          setStreamResults={setStreamResults}
          bulkData={bulkData}
          setBulkData={setBulkData}
          isSendingBulk={isSendingBulk}
          clearBulkData={() => {
            setBulkData([]);
          }}
          enterKeyNewLine={enterKeyNewLine}
          setEnterKeyNewLine={setEnterKeyNewLine}
          isSpeechMuted={isSpeechMuted}
          toggleSpeechMute={toggleSpeechMute}
          setWebhookUrls={setWebhookUrls}
          handleSendBulkData={handleSendBulkData}
          vibrationEnabled={vibrationEnabled}
          setVibrationEnabled={setVibrationEnabled}
          openInCalcMode={openInCalcMode}
          setOpenInCalcMode={setOpenInCalcMode}
          historyEnabled={historyEnabled}
          setHistoryEnabled={setHistoryEnabled}
          continuousMode={continuousMode}
          setContinuousMode={setContinuousMode}
        />
      </Suspense>

      {/* History Modal */}
      <Suspense fallback={<View />}>
        <HistoryModal 
          visible={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          history={history}
          onDelete={deleteCalculation} // FIX: Pass the actual delete function
          onClearAll={clearAllCalculations} // FIX: Pass the actual clear all function
          onSelect={(item) => {
            if (item.result) {
              setKeypadInput(item.result);
              setShowHistoryModal(false);
              if (Platform.OS === 'android') {
                ToastAndroid.show(`Selected: ${item.result}`, ToastAndroid.SHORT);
              }
            }
          }}
          isLoading={loading}
        />
      </Suspense>

      {/* Bottom bar with proper spacing and button sizes */}
      <View style={[
        styles.bottomBar,
        isWebMobile && styles.bottomBarWebMobile
      ]}>
        <TouchableOpacity onPress={() => setShowKeypad(s => !s)} style={styles.bottomButton}>
          <AppIcon name="calculator" size={28} color="#ccc" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.micButton, // Base style
            isRecording ? { backgroundColor: '#cc0000' } : {}, // Red if recording
            isWebMobile && styles.micButtonWebMobile // Additional styles for web mobile
          ]}
          onPress={() => {
            if (isRecording) {
              stopRecording();
            } else {
              startRecording();
            }
          }}
          disabled={isTranscribing && !continuousMode}
        >
          {isTranscribing && !continuousMode ? (
            <ActivityIndicator color="#eee" />
          ) : (
            <AppIcon name={isRecording ? "microphone-off" : "microphone"} size={isWebMobile ? 40 : 60} color={"#eee"} />
          )}
        </TouchableOpacity>
        {/* Webhook Icon with tooltip */}
        <View style={styles.tooltipContainer}>
          <Pressable 
            onPress={() => setIsSettingsModalVisible(true)}
            style={styles.bottomButton}
            onHoverIn={() => Platform.OS === 'web' && toggleTooltip('settings')}
            onHoverOut={() => Platform.OS === 'web' && toggleTooltip(null)}
          > 
            <View>
              <AppIcon name="cog" size={28} color="#ccc" />
              {!streamResults && bulkData.length > 0 && (
                <View style={styles.bulkBadge}>
                  <Text style={styles.bulkBadgeText}>{bulkData.length}</Text>
                </View>
              )}
            </View>
          </Pressable>
          
          {/* Simple Webhook Tooltip */}
          {Platform.OS === 'web' && hoveredTooltip === 'webhook' && (
            <View style={styles.webhookTooltip}>
              {/* Active Webhooks Section */}
              {webhookUrls.filter(webhook => webhook.active).length > 0 ? (
                <View style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <AppIcon name="webhook" size={16} color="#888" style={{ marginRight: 5 }} />
                    <Text style={[styles.tooltipText, { fontWeight: 'bold', fontSize: 16, color: '#888' }]}>{t('mainApp.activeWebhooks')}</Text>
                  </View>
                  {webhookUrls.filter(webhook => webhook.active).map((webhook, index) => (
                    <View key={index} style={styles.webhookTooltipItem}>
                      <Text style={[styles.webhookTooltipText, { fontSize: 13 }]} numberOfLines={1} ellipsizeMode="middle">
                        {webhook.title || webhook.url}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <AppIcon name="webhook" size={16} color="#888" style={{ marginRight: 5 }} />
                    <Text style={[styles.tooltipText, { fontWeight: 'bold', fontSize: 16, color: '#888' }]}>{t('mainApp.activeWebhooks')}</Text>
                  </View>
                  <Text style={[styles.tooltipText, { fontSize: 13 }]}>{t('mainApp.none')}</Text>
                </View>
              )}
              
              {/* Bulk data info */}
              {!streamResults && bulkData.length > 0 && (
                <View>
                  <Text style={[styles.tooltipText, { fontWeight: 'bold', fontSize: 16, color: '#888', marginBottom: 8 }]}>{t('mainApp.dataQueue')}</Text>
                  {bulkData.map((item, index) => (
                    <Text 
                      key={index} 
                      style={[styles.tooltipText, { 
                        fontSize: 13, 
                        paddingVertical: 3,
                        backgroundColor: index % 2 === 0 ? 'transparent' : '#333333',
                        marginBottom: 1
                      }]} 
                      numberOfLines={1} 
                      ellipsizeMode="middle"
                    >
                      {item.data}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

// --- Define Interface for Styles ---
interface ComponentStyles {
  container: ViewStyle;
  headerControls: ViewStyle;
  settingsIcon: ViewStyle;
  quickSendText: TextStyle;
  chatArea: ViewStyle;
  bottomBar: ViewStyle;
  bottomBarWebMobile: ViewStyle; // Added for web mobile
  bottomButton: ViewStyle;
  micButton: ViewStyle;
  micButtonWebMobile: ViewStyle; // Added for web mobile
  calculatorArea: ViewStyle;
  calculatorAreaMobileWeb: ViewStyle; // Added for web mobile
  keypadContainer: ViewStyle; // Added for organization
  keypadRow: ViewStyle;
  keypadKey: ViewStyle;
  keypadKeyText: TextStyle;
  keypadKeyWebMobile: ViewStyle; // Added for web mobile
  currentUserBubbleContainer: ViewStyle;
  userBubble: ViewStyle;
  userText: TextStyle;
  resultBubble: ViewStyle;
  resultText: TextStyle;
  errorBubble: ViewStyle;
  errorText: TextStyle;
  fixedRightDeleteButton: ViewStyle;
  inputPreviewContainer: ViewStyle;
  inputStyle: TextStyle;
  previewStyle: TextStyle;
  emptyStateContainer: ViewStyle;
  emptyStateTitle: TextStyle;
  emptyStateItem: ViewStyle;
  emptyStateText: TextStyle;
  emptyStateHighlight: TextStyle;
  bulkBadge: ViewStyle;
  bulkBadgeText: TextStyle;
  quickSendButton: ViewStyle;
  alertButtonSend: ViewStyle;
  alertButtonPrimary: ViewStyle;
  alertButtonSecondary: ViewStyle;
  tooltipContainer: ViewStyle;
  tooltip: ViewStyle;
  tooltipText: TextStyle;
  webhookTooltip: ViewStyle;
  webhookTooltipItem: ViewStyle;
  webhookTooltipText: TextStyle;
  tooltipButton: ViewStyle;
  tooltipCloseButton: ViewStyle;
  keypadKeyWeb: ViewStyle;
  keypadKeyMobile: ViewStyle;
  keypadKeyOperator: ViewStyle;
  keypadKeyEnter: ViewStyle;
  resetButton: ViewStyle;
  logoContainer: ViewStyle;
  betaText: TextStyle;
}

// --- StyleSheet ---
const styles = StyleSheet.create<ComponentStyles>({
  container: {
    flex: 1,
    backgroundColor: '#121212'
  },
  headerControls: { 
    position: 'absolute',
    top: 10, 
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center'
  },
  settingsIcon: { 
     padding: 10, 
  },

  chatArea: {
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 32,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E', 
    borderRadius: 25,        
    marginHorizontal: 30,    
    marginBottom: 30,        
    paddingHorizontal: 15,   
    paddingTop: 0,          
    paddingBottom: 0,       
    height: 60,             // Explicit slim height
    overflow: 'visible',    // Allow mic button to overflow
  },
  bottomButton: {
    backgroundColor: 'transparent',
    borderRadius: 25,        
    width: 50,               
    height: 50,              
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,    
  },
  micButton: {
    backgroundColor: '#121212',
    borderRadius: 50,        
    width: 100,              
    height: 100,             
    justifyContent: 'center',
    alignItems: 'center',       
  },
  calculatorArea: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#121212',
    paddingTop: 20, // Add padding to separate from content above
    borderTopWidth: 1,
    borderTopColor: '#333', // Add subtle border to separate from content
    marginTop: 15, // Add more space above the keypad
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '95%',
    marginBottom: 5,
  },
  keypadKey: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    paddingVertical: 11,
    borderRadius: 40,
    width: 70,
    height: 70,
    ...(Platform.OS === 'web' 
      ? {
          backgroundColor: 'transparent',
          boxShadow: '0px 2px 3px rgba(0,0,0,0.3)',
        } 
      : {
          backgroundColor: '#1C1C1E',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 3,
          elevation: 3,
        }),
  },
  keypadKeyText: {
    color: '#eee',
    fontSize: 31,           
    fontWeight: '500',
  },
  currentUserBubbleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 16,
    // Should take full width available in FlatList row
  },
  userBubble: {
    backgroundColor: '#121212',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    alignSelf: 'flex-start', // Keep bubble aligned left
    maxWidth: '80%', // Keep bubble max width
  },
  userText: {
    color: '#fff',
    fontSize: 24,
  },
  resultBubble: {
    alignSelf: 'center',
    backgroundColor: '#121212',
    borderRadius: 22,
    marginVertical: 8,
    maxWidth: '80%',
  },
  resultText: {
    color: '#fff',
    fontSize: 38,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorBubble: {
    backgroundColor: '#8B0000',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    alignSelf: 'flex-start',
    marginBottom: 8,
    maxWidth: '80%',
  },
  errorText: {
    fontSize: 20,
    color: '#FF3B30', 
  },
  fixedRightDeleteButton: {
    paddingLeft: 35, // Increased from 15 to 35 (added 20px margin)
    paddingRight: 5,
    paddingVertical: 10, 
  },
  inputPreviewContainer: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#1c1c1c', 
    borderRadius: 8,
    marginBottom: 10,
    minHeight: 70, 
    justifyContent: 'center', 
  },
  inputStyle: {
    flex: 1,
    fontSize: 28, 
    color: '#fff',
    textAlign: 'right',
    paddingRight: 10, 
    minHeight: 40, 
  },
  previewStyle: {
    fontSize: 20,
    color: '#ccc',
    marginLeft: 8,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  betaText: {
    position: 'absolute',
    top: 10,
    right: -42,
    backgroundColor: '#0066cc',
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 30,
  },
  emptyStateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#18181a',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    maxWidth: 400,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#eee',
    marginLeft: 15,
  },
  emptyStateHighlight: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  bulkBadge: {
    position: 'absolute',
    right: -6,
    top: -6,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  bulkBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quickSendButton: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 8,
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSendText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertButtonSend: {
    backgroundColor: '#007AFF',
  },
  alertButtonPrimary: {
    backgroundColor: '#3A3A3C',
  },
  alertButtonSecondary: {
    backgroundColor: '#3A3A3C',
  },
  tooltipContainer: {
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    bottom: -55,
    right: 0,
    minWidth: 120,
    alignItems: 'center',
    ...(Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.25)' },
      default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
      },
    }) as any),
    zIndex: 1000,
  },
  webhookTooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 10,
    borderRadius: 8,
    bottom: 60, // Position above the icon
    left: -100,
    width: 200,
    zIndex: 1000, // Ensure tooltip is above other elements
  },
  webhookTooltipItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  webhookTooltipText: {
    color: '#fff',
    fontSize: 12,
    flex: 1,
  },
  tooltipButton: {
    backgroundColor: '#3A3A3C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    marginTop: 5,
    alignItems: 'center',
  },
  tooltipCloseButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 5,
  },
  keypadKeyWeb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    paddingVertical: 11,
    backgroundColor: 'transparent',
    borderRadius: 40,
    width: 70,
    height: 70,
  },
  
  keypadKeyMobile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    paddingVertical: 11,
    backgroundColor: '#1C1C1E',
    borderRadius: 40,
    width: 70,
    height: 70,
    ...(Platform.select({
      web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.3)' },
      default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
      },
    }) as any),
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 200, 0.1)',
  },
  keypadKeyOperator: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    paddingVertical: 11,
    backgroundColor: '#0066cc', // Blue for operators
    borderRadius: 40,
    width: 70,
    height: 70,
    ...(Platform.select({
      web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.3)' },
      default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
      },
    }) as any),
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 200, 0.15)',
  },
  keypadKeyEnter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    paddingVertical: 11,
    backgroundColor: '#ff9500', // Orange for enter
    borderRadius: 40,
    width: 70,
    height: 70,
    ...(Platform.select({
      web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.3)' },
      default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
      },
    }) as any),
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 200, 0.1)',
  },
  resetButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
  },
  bottomBarWebMobile: {
    position: 'fixed',
    bottom: Platform.OS === 'web' ? 15 : 0,
    left: 0,
    right: 0,
    marginHorizontal: 15,
    zIndex: 200,
    backgroundColor: 'rgba(28, 28, 30, 0.98)',
    borderWidth: 1,
    borderColor: '#333',
    ...(Platform.select({
      web: { boxShadow: '0px -2px 4px rgba(0,0,0,0.3)' },
      default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
      },
    }) as any),
    paddingBottom: Platform.OS === 'web' ? 0 : 15, // Add padding for mobile safe area
  },
  micButtonWebMobile: {
    width: 80,
    height: 80,
  },
  calculatorAreaMobileWeb: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 5,
    paddingBottom: Platform.OS === 'web' ? 20 : 35,
    marginBottom: Platform.OS === 'web' ? '25%' : 85,
    position: 'relative',
    zIndex: 1,
  },
  keypadContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'web' ? 10 : 15, // Increased padding for mobile
  },
  keypadKeyWebMobile: {
    width: 70, // Match native key width
    height: 70, // Match native key height
    marginHorizontal: 6, // Match native key margin
    // Removed marginBottom: 2, as it's not in native key styles and keypadRow handles vertical spacing
  },
});

export default MainScreen;
