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
import { useAuth } from '../contexts/AuthContext';
import { useCalculationHistory } from '../contexts/CalculationHistoryContext';
import HistoryButton from '../components/HistoryButton';
import { useTranslation } from '../hooks/useTranslation';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useWebhookManager } from '../hooks/useWebhookManager';
import { LOCALE_MAP, SPEECH_RECOGNITION_LANG_MAP } from '../constants/Languages';
import { sendWebhook } from '../utils/webhookService';

// Dynamically import heavy components for code splitting
const Settings = React.lazy(() => import('./components/Settings'));
const HistoryModal = React.lazy(() => import('../components/HistoryModal'));
const KeypadComponent = React.lazy(() => import('../components/KeypadComponent'));
const BubbleListComponent = React.lazy(() => import('../components/BubbleListComponent'));

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
}

const MainScreen: React.FC = () => {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const { history, addCalculation, deleteCalculation, clearAllCalculations, loading } = useCalculationHistory();

  // Number formatting function - returns raw number string (no locale formatting)
  const formatNumber = useCallback((num: number, lang: string): string => {
    // Return raw number string to avoid locale-specific formatting issues
    // (e.g., French locale would format 1.333 as "1,333" which looks like thousands)
    return num.toString();
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
  const isTTSSpeaking = useRef(false);
  
  // State variables
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const [showKeypad, setShowKeypad] = useState(false);
  // const [recording, setRecording] = useState<Audio.Recording | null>(null); // Removed Audio.Recording type usage here
  const [isRecording, setIsRecording] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const lastResultRef = useRef<string | null>(null);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false); // State for modal
  const [isUnsentDataModalVisible, setIsUnsentDataModalVisible] = useState(false); // State for unsent data alert modal
  const [isSpeechMuted, setIsSpeechMuted] = useState(false); // State for UI updates
  const speechMutedRef = useRef(false); // Ref for actual mute control
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
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      } else {
        Speech.stop();
      }
    }
  }, []);

  // --- Settings State ---
  const [enterKeyNewLine, setEnterKeyNewLine] = useState<boolean>(false);

  // Webhook Manager Hook - handles all webhook operations
  const webhookManager = useWebhookManager(t, bubbleIdRef);

  // Check for unsent data when webhook manager is ready
  useEffect(() => {
    if (webhookManager.webhookSettingsLoaded && !webhookManager.streamResults && webhookManager.bulkData.length > 0) {
      setIsUnsentDataModalVisible(true);
    }
  }, [webhookManager.webhookSettingsLoaded, webhookManager.streamResults, webhookManager.bulkData.length]);
  
  // Function to check for unsent data and show modal if needed
  const checkUnsentData = useCallback(() => {
    if (!webhookManager.streamResults && webhookManager.bulkData.length > 0) {
      setIsUnsentDataModalVisible(true);
      return true; // Has unsent data
    }
    return false; // No unsent data
  }, [webhookManager.streamResults, webhookManager.bulkData.length]);

  // Placeholder for processSpeechResult - will be defined below
  const processSpeechResultRef = useRef<(transcript: string, source: 'web' | 'native') => void>(() => {});

  // Speech recognition hook - handles all speech logic
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

  // Background initialization for speech recognition - runs immediately after app loads
  useEffect(() => {
    // Start initialization immediately after component mounts
    speechRecognition.initializeSpeech();
  }, []);

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
          addition: ['plus', 'add', 'added', 'adding', 'and', 'sum', 'total', 'combine', 'combined'],
          subtraction: ['minus', 'subtract', 'subtracted', 'subtracting', 'less', 'take away', 'remove', 'removed', 'decrease', 'decreased'],
          multiplication: ['times', 'multiplied by', 'multiply', 'multiplying', 'x', 'product', 'product of'],
          division: ['divided by', 'divided', 'divide', 'dividing', 'over', 'split', 'split by'],
          percentage: ['percent', 'percentage', '%'],
          percentOf: ['percent of', 'percentage of', '% of'],
          power: ['power', 'raised to', 'to the power of', 'to the power', 'squared', 'cubed', 'exponent'],
          sqrt: ['square root of', 'root of', 'square root', 'root'],
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
        }
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
          addition: ['más', 'sumar', 'suma', 'sumado', 'y', 'añadir', 'añade', 'añadido', 'agregar', 'agrega', 'agregado'],
          subtraction: ['menos', 'restar', 'resta', 'restado', 'quitar', 'quita', 'quitado', 'sacar', 'saca', 'sacado', 'disminuir', 'disminuye', 'disminuido'],
          multiplication: ['por', 'multiplicado por', 'multiplicar', 'multiplica', 'veces', 'x', 'producto', 'producto de'],
          division: ['dividido por', 'dividir', 'divide', 'dividido', 'sobre', 'entre'],
          percentage: ['por ciento', 'porciento', 'porcentaje', '%'],
          percentOf: ['por ciento de', 'porciento de', 'porcentaje de'],
          power: ['elevado a', 'elevado', 'a la potencia de', 'a la potencia', 'al cuadrado', 'al cubo', 'potencia', 'exponente'],
          sqrt: ['raíz cuadrada de', 'raíz de', 'raíz cuadrada', 'raíz'],
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
        }
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
          addition: ['plus', 'ajouter', 'ajoute', 'ajouté', 'et', 'additionner', 'additionne', 'additionné', 'somme', 'sommer', 'somme de', 'rajouter', 'rajoute', 'rajouté'],
          subtraction: ['moins', 'soustraire', 'soustrait', 'soustraction', 'retirer', 'retire', 'retiré', 'enlever', 'enlève', 'enlevé', 'ôter', 'ôte', 'ôté', 'diminuer', 'diminue', 'diminué'],
          multiplication: ['fois', 'multiplié par', 'multiplier', 'multiplie', 'multiplication', 'x', 'par', 'produit', 'produit de'],
          division: ['divisé', 'divisé par', 'diviser', 'divise', 'division', 'sur', 'divisée par', 'divisée'],
          percentage: ['pour cent', 'pourcent', 'pourcentage', '%'],
          percentOf: ['pour cent de', 'pourcent de', 'pourcentage de'],
          power: ['puissance', 'élevé à', 'élevé', 'à la puissance de', 'à la puissance', 'au carré', 'au cube', 'exposant'],
          sqrt: ['racine carrée de', 'racine de', 'racine carrée', 'racine'],
          parentheses: {
            open: ['ouvrir parenthèse', 'parenthèse gauche', 'ouvrir crochet', 'ouvre parenthèse'],
            close: ['fermer parenthèse', 'parenthèse droite', 'fermer crochet', 'ferme parenthèse']
          },
          decimal: ['virgule', 'point', 'décimal', 'décimale']
        },
        specificPhrases: {
          addTo: '(ajouter|ajoute|additionner|additionne) (\\d+(?:\\.\\d+)?) (à|a) (\\d+(?:\\.\\d+)?)',
          subtractFrom: '(soustraire|soustrait|retirer|retire|enlever|enlève|ôter|ôte) (\\d+(?:\\.\\d+)?) (de|à|a) (\\d+(?:\\.\\d+)?)',
          multiplyBy: '(multiplier|multiplie|multiplié) (\\d+(?:\\.\\d+)?) par (\\d+(?:\\.\\d+)?)',
          divideBy: '(diviser|divise|divisé|divisée) (\\d+(?:\\.\\d+)?) par (\\d+(?:\\.\\d+)?)'
        }
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
          addition: ['plus', 'addieren', 'addiere', 'addiert', 'und', 'hinzufügen', 'hinzufüge', 'hinzugefügt', 'dazu', 'summieren', 'summe'],
          subtraction: ['minus', 'subtrahieren', 'subtrahiere', 'subtrahiert', 'weniger', 'abziehen', 'ziehe ab', 'abgezogen', 'wegnehmen', 'nimm weg'],
          multiplication: ['mal', 'multipliziert mit', 'multiplizieren', 'multipliziere', 'x', 'produkt', 'produkt von'],
          division: ['geteilt durch', 'dividiert durch', 'teilen', 'teile', 'über', 'durch'],
          percentage: ['prozent', 'vom hundert', '%'],
          percentOf: ['prozent von', 'prozent des'],
          power: ['hoch', 'zur potenz', 'zur potenz von', 'quadrat', 'kubik', 'potenz', 'exponent'],
          sqrt: ['quadratwurzel von', 'wurzel von', 'quadratwurzel', 'wurzel'],
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
        }
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
          addition: ['mais', 'somar', 'soma', 'somado', 'e', 'adicionar', 'adiciona', 'adicionado', 'acrescentar', 'acrescenta', 'acrescentado'],
          subtraction: ['menos', 'subtrair', 'subtrai', 'subtraído', 'tirar', 'tira', 'tirado', 'retirar', 'retira', 'retirado', 'diminuir', 'diminui', 'diminuído'],
          multiplication: ['vezes', 'multiplicado por', 'multiplicar', 'multiplica', 'x', 'produto', 'produto de'],
          division: ['dividido por', 'dividir', 'divide', 'dividido', 'sobre', 'por'],
          percentage: ['por cento', 'porcento', 'percentagem', '%'],
          percentOf: ['por cento de', 'porcento de', 'percentagem de'],
          power: ['elevado a', 'elevado', 'à potência de', 'à potência', 'ao quadrado', 'ao cubo', 'potência', 'expoente'],
          sqrt: ['raiz quadrada de', 'raiz de', 'raiz quadrada', 'raiz'],
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
        }
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
          addition: ['più', 'sommare', 'somma', 'sommato', 'e', 'aggiungere', 'aggiungi', 'aggiunto', 'addizionare', 'addiziona', 'addizionato'],
          subtraction: ['meno', 'sottrarre', 'sottrai', 'sottratto', 'togliere', 'togli', 'tolto', 'levare', 'leva', 'levato', 'diminuire', 'diminuisci', 'diminuito'],
          multiplication: ['per', 'moltiplicato per', 'moltiplicare', 'moltiplica', 'x', 'prodotto', 'prodotto di'],
          division: ['diviso per', 'dividere', 'dividi', 'diviso', 'sopra', 'fratto'],
          percentage: ['per cento', 'percento', 'percentuale', '%'],
          percentOf: ['per cento di', 'percento di', 'percentuale di'],
          power: ['elevato a', 'elevato', 'alla potenza di', 'alla potenza', 'al quadrato', 'al cubo', 'potenza', 'esponente'],
          sqrt: ['radice quadrata di', 'radice di', 'radice quadrata', 'radice'],
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
        }
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
    } as const;
  }, [language, getMathPatterns]);

  // Normalize spoken math expressions
  const normalizeSpokenMath = useCallback((text: string): string => {
    let normalized = text.toLowerCase();
    const compiled = compiledLanguageRegex;
    const patterns = compiled.patterns;

    // CRITICAL FIX: Remove hyphens that are part of words (not mathematical operators)
    // This fixes French phrases like "peut-tu me dire" being interpreted as "peut - tu me dire"
    // Pattern: letter-letter → letterletter (removes hyphens between letters)
    // This preserves actual minus operations like "5 - 3" or "10-2" (number-number)
    normalized = normalized.replace(/([a-zàáâãäåèéêëìíîïòóôõöùúûüýÿ])-([a-zàáâãäåèéêëìíîïòóôõöùúûüýÿ])/gi, '$1$2');

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
    // First, remove spaces and commas from numbers (speech recognition adds these)
    // "1 000" → "1000", "10,000" → "10000"
    normalized = normalized.replace(/(\d+)[\s,]+(\d+)/g, '$1$2');
    
    // BULLETPROOF fraction logic - works for ANY fraction
    // "1/200 of 2562" → "(1/200) * 2562" = 12.81
    // "3 fourths of 100" → "(3/4) * 100" = 75
    // "1 third of 90" → "(1/3) * 90" = 30
    
    // Pattern 1: Direct fraction notation "1/200 of 2562"
    normalized = normalized.replace(/(\d+)\s*\/\s*(\d+)\s+(?:of|de|di|von)\s+(\d+(?:\.\d+)?)/gi, '(($1/$2) * $3)');
    
    // Pattern 2: Convert fraction words to division, then multiply
    // "X [fraction word] of Y" → "(X / [denominator]) * Y"
    // This handles ANY fraction word by converting it to the denominator number
    
    // Map fraction words to their denominators (all languages)
    const fractionMap: { [key: string]: number } = {
      // English
      'half': 2, 'halves': 2, 'halfs': 2,
      'third': 3, 'thirds': 3, 'thir': 3, 'thirdith': 3, 'thirdth': 3,
      'fourth': 4, 'fourths': 4, 'quarter': 4, 'quarters': 4, 'forth': 4, 'forths': 4,
      'fifth': 5, 'fifths': 5, 'fith': 5, 'fiths': 5,
      'sixth': 6, 'sixths': 6, 'sikth': 6, 'sikths': 6,
      'seventh': 7, 'sevenths': 7, 'sevnth': 7, 'sevnths': 7,
      'eighth': 8, 'eighths': 8, 'aith': 8, 'aiths': 8, 'eith': 8, 'eiths': 8,
      'ninth': 9, 'ninths': 9, 'nith': 9, 'niths': 9,
      'tenth': 10, 'tenths': 10, 'tinth': 10, 'tinths': 10,
      // French
      'demi': 2, 'demis': 2,
      'tiers': 3,
      'quart': 4, 'quarts': 4,
      'cinquième': 5, 'cinquièmes': 5,
      'sixième': 6, 'sixièmes': 6,
      'septième': 7, 'septièmes': 7,
      'huitième': 8, 'huitièmes': 8,
      // Spanish/Portuguese/Italian share many words (all Romance languages)
      'medio': 2, 'medios': 2, 'meio': 2, 'meios': 2, 'mezzo': 2, 'mezzi': 2,
      'tercio': 3, 'tercios': 3, 'terço': 3, 'terços': 3, 'terzo': 3, 'terzi': 3,
      'cuarto': 4, 'cuartos': 4, 'quarto': 4, 'quartos': 4, 'quarti': 4,
      'quinto': 5, 'quintos': 5, 'quinti': 5,
      'sexto': 6, 'sextos': 6, 'sesto': 6, 'sesti': 6,
      'séptimo': 7, 'séptimos': 7,
      'octavo': 8, 'octavos': 8,
      // German
      'halb': 2, 'halbe': 2,
      'drittel': 3,
      'viertel': 4,
      'fünftel': 5,
      'sechstel': 6,
    };
    
    // Replace fraction phrases with division
    // Matches: "3 fourths of 100", "1 third of 90", "1/200 of 2562"
    normalized = normalized.replace(/(\d+)\s+([a-zàáâãäåèéêëìíîïòóôõöùúûüýÿ]+)\s+(?:of|de|di|von)\s+(\d+(?:\.\d+)?)/gi, (match, numerator, fractionWord, number) => {
      const denominator = fractionMap[fractionWord.toLowerCase()];
      if (denominator) {
        return `((${numerator}/${denominator}) * ${number})`;
      }
      return match; // If not a fraction word, leave unchanged
    });
    
    // Advanced percentage handling BEFORE other replacements
    // Pattern: "give me 15% of 10" or "what's 15% of 10" → "10 * 0.15"
    normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*%\s+(?:of|de|di|von)\s+(\d+(?:\.\d+)?)/gi, '($2 * $1 / 100)');
    
    // Pattern: "add 15% to 10" or "10 + 15%" → "10 + (10 * 0.15)" = "10 * 1.15"
    normalized = normalized.replace(/(?:add|ajouter|adicionar|hinzufügen|aggiungere)\s+(\d+(?:\.\d+)?)\s*%\s+(?:to|à|a|zu)\s+(\d+(?:\.\d+)?)/gi, '($2 * (1 + $1 / 100))');
    normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*%/gi, '($1 * (1 + $2 / 100))');
    
    // Pattern: "subtract 15% from 10" or "10 - 15%" → "10 - (10 * 0.15)" = "10 * 0.85"
    normalized = normalized.replace(/(?:subtract|soustraire|subtrair|subtrahieren|sottrarre)\s+(\d+(?:\.\d+)?)\s*%\s+(?:from|de|von|da)\s+(\d+(?:\.\d+)?)/gi, '($2 * (1 - $1 / 100))');
    normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*%/gi, '($1 * (1 - $2 / 100))');
    
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

    // Final cleanup:
    // 1) Preserve 'sqrt' tokens
    normalized = normalized.replace(/\bsqrt\b/g, '__SQRT__');
    // 2) Remove apostrophes/quotes that can leak from contractions like what's
    normalized = normalized.replace(/[’'"`]+/g, ' ');
    // 3) Remove ALL remaining letters (including accented characters like à, é, ñ, etc.)
    normalized = normalized.replace(/[a-zA-ZÀ-ÿ]+/g, ' ');
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
    
    // Trim the expression
    expression = expression.trim();
    
    // For speech input, check if it's just a number BEFORE removing trailing operators
    // This way "plus 2" (which becomes "+2") is detected as having an operator
    if (type === 'speech') {
      // Check if it's just a number (integer or decimal) without any operators
      // This regex checks for numbers that don't have +, -, *, /, ^, %, (, ) anywhere
      if (/^\d+(\.\d+)?$/.test(expression)) {
        return MATH_ERROR;
      }
    }
    
    // Check if equation ends with an operator (incomplete equation)
    const endsWithOperator = /[+\-*/^]$/.test(expression);
    
    // Check if equation starts with an operator (uses previous result)
    const startsWithOperator = /^[+\-*/^]/.test(expression);
    
    // If it ends with an operator but doesn't start with one, it's incomplete
    if (endsWithOperator && !startsWithOperator) {
      return MATH_ERROR;
    }
    
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

  // Use webhook manager's sendWebhookData function
  const sendWebhookData = webhookManager.sendWebhookData;

  // Single TTS function to prevent duplicates
  const speakSingleResult = useCallback((text: string) => {
    if (isTTSSpeaking.current) {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      } else {
        Speech.stop();
      }
    }

    isTTSSpeaking.current = true;

    if (Platform.OS === 'web') {
      // Use Web Speech API for browser
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        // Always cancel any queued speech for zero-queue guarantee
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = getSpeechRecognitionLanguage(language);
        utterance.pitch = 1.0;
        utterance.rate = 1.1;
        
        // Select SPECIFIC local female voice for each language (fastest & consistent)
        const voices = window.speechSynthesis.getVoices();
        const targetLang = getSpeechRecognitionLanguage(language);
        
        // Hardcoded best female voices per language (fastest local voices)
        const preferredVoiceNames: { [key: string]: string[] } = {
          'en-US': ['Samantha', 'Microsoft Zira', 'Google US English Female', 'Karen'],
          'en-GB': ['Google UK English Female', 'Microsoft Hazel', 'Kate'],
          'es-ES': ['Google español Female', 'Microsoft Helena', 'Monica'],
          'es-MX': ['Google español de Estados Unidos Female', 'Microsoft Sabina', 'Paulina'],
          'fr-FR': ['Google français Female', 'Microsoft Hortense', 'Amelie'],
          'de-DE': ['Google Deutsch Female', 'Microsoft Hedda', 'Anna'],
          'pt-BR': ['Google português do Brasil Female', 'Microsoft Maria', 'Luciana'],
          'it-IT': ['Google italiano Female', 'Microsoft Elsa', 'Alice'],
        };
        
        // Get preferred voice names for this language
        const langBase = targetLang.split('-')[0];
        const preferredNames = preferredVoiceNames[targetLang] || preferredVoiceNames[`${langBase}-${langBase.toUpperCase()}`] || [];
        
        // Try to find preferred voice in order
        let selectedVoice = null;
        for (const name of preferredNames) {
          selectedVoice = voices.find(v => v.name.includes(name));
          if (selectedVoice) break;
        }
        
        // Fallback: Any local female voice
        if (!selectedVoice) {
          selectedVoice = voices.find(v => v.localService && v.name.toLowerCase().includes('female'));
        }
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        utterance.onend = () => {
          // Clear flag and reset ALL speech-related state immediately when TTS finishes
          isTTSSpeaking.current = false;
          setInterimTranscript(''); // Clear any buffered speech
          speechRecognition.lastProcessedTranscriptRef.current = ''; // Reset duplicate prevention
        };

        utterance.onerror = () => {
          // Clear flag and reset state on TTS error
          isTTSSpeaking.current = false;
          setInterimTranscript(''); // Clear any buffered speech
          speechRecognition.lastProcessedTranscriptRef.current = ''; // Reset duplicate prevention
        };

        window.speechSynthesis.speak(utterance);
      } else {
        // Fallback if speechSynthesis is not available
        isTTSSpeaking.current = false;
      }
    } else {
      // Use expo-speech for native platforms
      Speech.speak(text, {
        language: getSpeechRecognitionLanguage(language),
        pitch: 1.0,
        rate: 1.1,
        onDone: () => {
          // Clear flag and reset ALL speech-related state immediately when TTS finishes
          isTTSSpeaking.current = false;
          setInterimTranscript(''); // Clear any buffered speech
          speechRecognition.lastProcessedTranscriptRef.current = ''; // Reset duplicate prevention
        },
        onStopped: () => {
          // Clear flag and reset state when TTS is manually stopped
          isTTSSpeaking.current = false;
          setInterimTranscript(''); // Clear any buffered speech
          speechRecognition.lastProcessedTranscriptRef.current = ''; // Reset duplicate prevention
        },
        onError: () => {
          // Clear flag and reset state on TTS error
          isTTSSpeaking.current = false;
          setInterimTranscript(''); // Clear any buffered speech
          speechRecognition.lastProcessedTranscriptRef.current = ''; // Reset duplicate prevention
        }
      });
    }
  }, [language, speechRecognition.lastProcessedTranscriptRef]);

  // Helper function to handle calculation results (DRY principle - used by both keypad and speech)
  const handleCalculationResult = useCallback((equation: string, result: string, source: 'keypad' | 'speech') => {
    // Prioritize TTS: speak immediately for speech source before any UI work
    if (source === 'speech' && !speechMutedRef.current) {
      speakSingleResult(result);
    }

    // Create bubbles for display
    const equationBubble: ChatBubble = {
      id: (bubbleIdRef.current++).toString(),
      type: 'user',
      content: `${equation} = ${result}`
    };
    const resultBubble: ChatBubble = {
      id: (bubbleIdRef.current++).toString(),
      type: 'calc',
      content: result
    };

    if (enterKeyNewLine) {
      // New Line Mode: Create a new empty user bubble
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
      // Normal Mode: Show the result in the input field
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

    // Speech already triggered at the start of this function for speech source

    lastResultRef.current = result;
    setExpectingFreshInput(true);

    // Webhook and history
    if (historyEnabled) {
      addCalculation(equation, result);
    }
    sendWebhookData(equation, result);
  }, [enterKeyNewLine, keypadInput, historyEnabled, speakSingleResult, addCalculation, sendWebhookData]);

  // Keypad buttons
  const [vibrationEnabled, setVibrationEnabled] = useState(true); // Add vibration state

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
      const expressionToCalc = keypadInput;

      // Perform calculation
      const result = handleInput(expressionToCalc, 'keypad'); 

      if (result !== MATH_ERROR) {
        // Use the consolidated helper function
        handleCalculationResult(expressionToCalc, result, 'keypad');
        
        // Scroll to bottom after calculation
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      } else {
        const errorBubble: ChatBubble = { id: (bubbleIdRef.current++).toString(), type: 'error', content: t('mainApp.mathErrors.error') };
        setBubbles(prev => [...prev, errorBubble]);
        setKeypadInput('');
        setPreviewResult(null);
        setExpectingFreshInput(false);
        // Scroll to bottom after error
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      }
      return;
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
  }, [keypadInput, handleInput, handleCalculationResult, expectingFreshInput, vibrationEnabled, t]);

  // Consolidated web keyboard handling (space to record, paste, keypad, mute, reset)
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    // Spacebar toggles recording
    if (e.code === 'Space') {
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
  }, [isRecording, onKeypadPress, toggleSpeechMute]);

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

  // Single unified speech result processor (DRY principle)
  const processSpeechResult = useCallback((transcript: string, source: 'web' | 'native') => {
    if (!transcript.trim()) return;

    // Prevent duplicate processing in continuous mode
    if (source === 'web' && speechRecognition.lastProcessedTranscriptRef.current === transcript) {
      return;
    }
    speechRecognition.lastProcessedTranscriptRef.current = transcript;

    // Keep interim transcript visible during processing

    let processedEquation = normalizeSpokenMath(transcript);
    processedEquation = processedEquation.trim();
    
    // Natural language: "what's X% of that" or "X percent of that" applies to last result
    const percentOfThatPattern = /(?:what'?s?|whats|calculate|find|get)?\s*(\d+(?:\.\d+)?)\s*(?:percent|%|percentage)\s*(?:of)?\s*(?:that|it|the last|previous|result)/i;
    const percentMatch = transcript.match(percentOfThatPattern);
    if (percentMatch && lastResultRef.current !== null) {
      const percentage = parseFloat(percentMatch[1]);
      processedEquation = `${lastResultRef.current} * ${percentage} / 100`;
    }

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

      // Use the consolidated helper function
      handleCalculationResult(processedEquation, result, 'speech');
    } else {
      // Clear interim transcript and show "No Equation Detected" bubble for MATH_ERROR
      setInterimTranscript('');
      
      // Add error bubble with original transcript shown
      const errorBubble: ChatBubble = {
        id: (bubbleIdRef.current++).toString(),
        type: 'error',
        content: `${t('mainApp.noEquationDetected')}... : ${transcript}`
      };
      
      setBubbles(prev => [...prev, errorBubble]);
      
      setKeypadInput('');
      setExpectingFreshInput(false);
    }
  }, [normalizeSpokenMath, handleInput, handleCalculationResult, speechRecognition.lastProcessedTranscriptRef]);

  // Assign processSpeechResult to the ref so the hook can use it
  processSpeechResultRef.current = processSpeechResult;

  // Use the hook's startRecording and stopRecording functions
  const startRecording = speechRecognition.startRecording;
  const stopRecording = speechRecognition.stopRecording;

  // --- Load/Save Settings (App Preferences Only) ---
  // Note: Webhook settings are managed by useWebhookManager hook

  // Load app preferences on mount
  useEffect(() => {
    const loadAppPreferences = async () => {
      try {
        const [
          storedOpenInCalcMode, 
          storedSpeechMuted, 
          storedHistoryEnabled, 
          storedContinuousMode
        ] = await Promise.all([
          AsyncStorage.getItem('openInCalcMode'),
          AsyncStorage.getItem('speechMuted'),
          AsyncStorage.getItem('historyEnabled'),
          AsyncStorage.getItem('continuousMode')
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
      } catch (error) {
        // Silent error handling
      }
    };
    loadAppPreferences();
  }, []);

  // Save webhook settings when they change
  useEffect(() => {
    if (webhookManager.webhookSettingsLoaded) {
      webhookManager.saveSettings();
    }
  }, [webhookManager.webhookUrls, webhookManager.sendEquation, webhookManager.streamResults]);

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
      } catch (error) {
        // Silent error handling
      }
    };
    saveSettings();
  }, [openInCalcMode, isSpeechMuted, historyEnabled, continuousMode]);

  // --- Component Lifecycle & Effects ---
  
  // Removed extra shortcuts listener; consolidated above

  // --- Webhook Logic Handlers ---
  // Use webhook manager's handler functions
  const handleAddWebhook = webhookManager.handleAddWebhook;
  const handleDeleteWebhook = webhookManager.handleDeleteWebhook;
  const handleToggleWebhook = webhookManager.handleToggleWebhook;
  const handleSendBulkData = webhookManager.handleSendBulkData;

  // Log rendering outside of JSX to avoid TypeScript errors
  // console.log('CalculatorScreen rendering...');
  
  // Wrapper component for Web Empty State
  const WebEmptyState = () => {
    return (
      <>
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
      </>
    );
  };

  // Wrapper component for Mobile Empty State
  const MobileEmptyState = () => {
    return (
      <>
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
      </>
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

      {/* Instant Logo Render - Independent of lazy loading */}
      {!showKeypad && bubbles.length === 0 ? (
        <View style={styles.centeredEmptyStateWrapper}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/images/LOGO.webp')} 
              style={{ width: Platform.OS === 'web' ? 200 : 180, height: Platform.OS === 'web' ? 80 : 72 }}
              resizeMode="contain"
              fadeDuration={0}
            />
            <Text style={styles.betaText}>BETA</Text>
          </View>
          {Platform.OS === 'web' ? <WebEmptyState /> : <MobileEmptyState />}
        </View>
      ) : (
        <Suspense fallback={<View style={styles.chatArea} />}>
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
        </Suspense>
      )}

      {showKeypad && (
        <Suspense fallback={<View style={styles.calculatorArea} />}>
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
        </Suspense>
      )}
      
      {/* Settings Modal */}
      <Suspense fallback={null}>
        <Settings
          visible={isSettingsModalVisible}
          onClose={() => setIsSettingsModalVisible(false)}
          webhookUrls={webhookManager.webhookUrls}
          newWebhookUrl={webhookManager.newWebhookUrl}
          setNewWebhookUrl={webhookManager.setNewWebhookUrl}
          newWebhookTitle={webhookManager.newWebhookTitle}
          setNewWebhookTitle={webhookManager.setNewWebhookTitle}
          handleAddWebhook={handleAddWebhook}
          handleDeleteWebhook={handleDeleteWebhook}
          handleToggleWebhook={handleToggleWebhook}
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
          onDelete={deleteCalculation} // Pass the actual delete function
          onClearAll={clearAllCalculations} // Pass the actual clear all function
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
        >
          <AppIcon name={isRecording ? "microphone-off" : "microphone"} size={isWebMobile ? 40 : 60} color={"#eee"} />
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
              {!webhookManager.streamResults && webhookManager.bulkData.length > 0 && (
                <View style={styles.bulkBadge}>
                  <Text style={styles.bulkBadgeText}>{webhookManager.bulkData.length}</Text>
                </View>
              )}
            </View>
          </Pressable>
          
          {/* Simple Webhook Tooltip */}
          {Platform.OS === 'web' && hoveredTooltip === 'webhook' && (
            <View style={styles.webhookTooltip}>
              {/* Active Webhooks Section */}
              {webhookManager.webhookUrls.filter(webhook => webhook.active).length > 0 ? (
                <View style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <AppIcon name="webhook" size={16} color="#888" style={{ marginRight: 5 }} />
                    <Text style={[styles.tooltipText, { fontWeight: 'bold', fontSize: 16, color: '#888' }]}>{t('mainApp.activeWebhooks')}</Text>
                  </View>
                  {webhookManager.webhookUrls.filter(webhook => webhook.active).map((webhook, index) => (
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
              {!webhookManager.streamResults && webhookManager.bulkData.length > 0 && (
                <View>
                  <Text style={[styles.tooltipText, { fontWeight: 'bold', fontSize: 16, color: '#888', marginBottom: 8 }]}>{t('mainApp.dataQueue')}</Text>
                  {webhookManager.bulkData.map((item, index) => (
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
  centeredEmptyStateWrapper: ViewStyle;
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
    paddingTop: 10,
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
          boxShadow: '0px 2px 3px rgba(0,0,0,0.3)'
        } 
      : {
          backgroundColor: '#1C1C1E',
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
  centeredEmptyStateWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyStateContainer: {
    alignItems: 'center',
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
    elevation: 4,
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
