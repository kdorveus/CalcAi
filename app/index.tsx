import React, { useEffect, useRef, useState, useCallback, Suspense } from 'react';
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
  Clipboard,
  ToastAndroid,
  Dimensions, // Add Dimensions import for responsive layout
  StatusBar,
} from 'react-native';
import { Audio } from 'expo-av';
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

// Preload app assets
const usePreloadAssets = () => {
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Preload the logo image
      const logoPreload = new window.Image();
      logoPreload.src = require('../assets/images/LOGO.png').uri || '';
    }
  }, []);
};

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

const MainScreen: React.FC = () => {
  const { user } = useAuth();
  const { history, addCalculation, deleteCalculation, clearAllCalculations, loading } = useCalculationHistory();

  // Setup animation values for swipe effects
  // const translateX = useSharedValue(0);
  // const translateY = useSharedValue(0);
  
  // No longer needed as we directly inject the font
  // const fallbackNeeded = false;
  
  // Add responsive dimensions
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
  const isSmallScreen = screenHeight < 700;
  const isWebMobile = Platform.OS === 'web' && screenWidth < 768;
  
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
  const keypadInputRef = useRef('');
  const speechModuleRef = useRef<any>(null); // Ref to store loaded speech module
  
  // State variables
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
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
  const [openInCalcMode, setOpenInCalcMode] = useState(false); // State for calculator mode
  const [showHistoryModal, setShowHistoryModal] = useState(false); // State for history modal
  const [historyEnabled, setHistoryEnabled] = useState(true); // State for history toggle
  
  // State for tracking tooltip hover
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  
  // Simple function to toggle tooltip visibility
  const toggleTooltip = useCallback((tooltipId: string | null) => {
    setHoveredTooltip(tooltipId);
  }, []);
  
  // Function to safely speak text when not muted
  const speakIfUnmuted = useCallback((text: string) => {
    if (!speechMutedRef.current) {
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => {},
        onStopped: () => {},
        onError: () => {}
      });
    }
  }, []);
  
  // Function to stop all speech and update mute state
  const toggleSpeechMute = useCallback(() => {
    const newMuteState = !speechMutedRef.current;
    speechMutedRef.current = newMuteState;
    setIsSpeechMuted(newMuteState); // Update state for UI
    
    if (Platform.OS === 'android') {
      ToastAndroid.show(newMuteState ? 'Voice muted' : 'Voice unmuted', ToastAndroid.SHORT);
    }
    
    // Stop any ongoing speech when muted
    if (newMuteState) {
      Speech.stop();
    }
  }, []);

  // --- Settings State ---
  const [webhookUrls, setWebhookUrls] = useState<any[]>([]);
  const [hasActiveWebhooks, setHasActiveWebhooks] = useState<boolean>(false);
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

  // Toggle mic on web with spacebar
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTranscribing) {
        event.preventDefault();
        if (!isRecording) {
          startRecording();
        } else {
          setIsRecording(false); // This will trigger recognition.onend and stop
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, isTranscribing]);

  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [expectingFreshInput, setExpectingFreshInput] = useState(false);

  // Normalize spoken math expressions
  const normalizeSpokenMath = useCallback((text: string): string => {
    let normalized = text.toLowerCase();

    // Convert spelled-out numbers (basic cases) FIRST
    const numWords: { [key: string]: string } = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
    };
    normalized = normalized.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (match) => numWords[match]);

    // IMPORTANT: Handle specific phrases BEFORE general replacements
    // Match numbers (integer or decimal)
    const numRegex = "\\d+(?:\\.\\d+)?"; 
    
    // "add [num1] to [num2]" -> "[num1] + [num2]"
    normalized = normalized.replace(new RegExp(`add (${numRegex}) to (${numRegex})`, 'g'), '$1 + $2');
    
    // "subtract [num1] from [num2]" -> "[num2] - [num1]"
    normalized = normalized.replace(new RegExp(`subtract (${numRegex}) from (${numRegex})`, 'g'), '$2 - $1');

    // "multiply/multiplied [num1] by [num2]" -> "[num1] * [num2]"
    normalized = normalized.replace(new RegExp(`(multiply|multiplied) (${numRegex}) by (${numRegex})`, 'g'), '$2 * $3');

    // "divide/divided [num1] by [num2]" -> "[num1] / [num2]"
    normalized = normalized.replace(new RegExp(`(divide|divided) (${numRegex}) by (${numRegex})`, 'g'), '$2 / $3');

    // --- General Replacements (Now run AFTER specific phrases) ---
    // Common operator words to symbols - Use word boundaries for robustness
    normalized = normalized.replace(/\b(plus|add)\b/g, ' + ');
    normalized = normalized.replace(/\b(minus|subtract|less)\b/g, ' - ');
    normalized = normalized.replace(/\b(times|multiplied by|x)\b/g, ' * '); // Match 'x' as a whole word
    normalized = normalized.replace(/\b(divided by|divide|over)\b/g, ' / ');
    normalized = normalized.replace(/\b(percent of)\b/g, ' * 0.01 * ');
    normalized = normalized.replace(/\b(percent|percentage)\b/g, ' % '); // Separate rule for just '%' 
    normalized = normalized.replace(/\b(power|raised to|to the power of)\b/g, ' ^ ');
    normalized = normalized.replace(/\b(square root of|root of)\b/g, ' sqrt ');
    normalized = normalized.replace(/\b(open parenthesis|left parenthesis)\b/g, ' ( ');
    normalized = normalized.replace(/\b(close parenthesis|right parenthesis)\b/g, ' ) ');

    // Handle decimal points explicitly
    normalized = normalized.replace(/\b(point|dot)\b/g, '.');

    // Remove only true non-math filler words (do NOT remove operator keywords)
    const fillerWords = [
      'do', 'hours', 'hour', 'box', 'and', 'the', 'a', 'an', 'equals', 'is', 'calculate', 'result', 'please', 'for', 'of'
    ];
    fillerWords.forEach(word => {
      normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
    });

    // Final cleanup: Remove characters not part of a valid expression
    // Allows: digits, whitespace, operators (+-*/%^), parentheses, decimal point, 'sqrt'
    normalized = normalized.replace(/[^\d\s\+\-\*\/\%\^\(\)\.sqrt]/g, ''); 

    // Consolidate multiple spaces into one
    normalized = normalized.replace(/\s+/g, ' ');
    // Trim leading/trailing whitespace before returning
    normalized = normalized.trim();

    return normalized;
  }, []); // No dependencies, purely functional

  // Handle input and calculation (used by keypad and speech)
  const handleInput = useCallback((val: string, type: 'user' | 'keypad' | 'speech'): string => {
    if (!val.trim()) return 'Error';

    let expression = val;
    if (type === 'speech') {
      expression = normalizeSpokenMath(val);
    }

    // Replace visual operators with standard ones for mathjs
    expression = expression.replace(/×/g, '*').replace(/÷/g, '/');
    
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
      return 'Error';
    }

    let result = 'Error'; // Default to Error

    try {
      // Use math.evaluate for robust calculation
      result = evaluate(expression).toString();
    } catch (error) {
      // console.error('Calculation Error:', error);
      result = 'Error';
    }
    return result; // Return the calculated result or 'Error'
  }, [normalizeSpokenMath]); // Dependencies: normalizeSpokenMath (stable)

  // Keypad buttons
  // const [advancedMode, setAdvancedMode] = useState(false); // Removed
  const [vibrationEnabled, setVibrationEnabled] = useState(true); // Add vibration state
  const KEYPAD = [
    ['↺', '()', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['^', '0', '.', 'CHECK_ICON']
  ];
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
          id: Date.now() + Math.random() + '', 
          type: 'error', 
          content: 'Maximum digit limit reached (100 digits)' 
        }]);
        return;
      }
    }
    
    // Handle input after a calculation (when we have a gray result)
    if (expectingFreshInput) {
      // Case 1: Enter/Check/Backspace - clear input and start new
      if (isClearingKey) {
        console.log('Clearing input after calculation');
        setKeypadInput('');
        setPreviewResult(null);
        
        // Remove the result-input bubble and add an empty user bubble
        setBubbles(prev => {
          const filtered = prev.filter(b => b.type !== 'result-input');
          return [...filtered, { id: Date.now() + '-empty', type: 'user', content: '' }];
        });
        
        setExpectingFreshInput(false);
        // Scroll to bottom after clearing
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
        return;
      }
      
      // Case 2: Any other key - confirm result and continue
      console.log('Continuing calculation after result');
      const currentResult = keypadInput;
      
      // Append the key to the current result
      const newInput = currentResult + key;
      setKeypadInput(newInput);
      
      // Replace gray result with white result and continue
      setBubbles(prev => {
        const filtered = prev.filter(b => b.type !== 'result-input');
        return [...filtered, { id: Date.now() + '-user', type: 'user', content: newInput }];
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
        return [...others, { id: Date.now() + Math.random() + '', type: 'user', content: newInput }];
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
          return [...others, { id: Date.now() + Math.random() + '', type: 'user', content: newInput }];
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
      console.log('Processing CHECK_ICON as ok');
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
      if (result !== 'Error') {
        // Create a bubble showing the equation with equals sign
        const equationBubble: ChatBubble = { id: Date.now() + '-equation', type: 'user', content: `${expressionToCalc} = ${result}` };
        // Create the result bubble to show just the result
        const resultBubble: ChatBubble = { id: Date.now() + '-calc', type: 'calc', content: result };
        
        if (enterKeyNewLine) {
          // New Line Mode: Create a new empty user bubble instead of showing the result
          const newEmptyBubble: ChatBubble = {
            id: Date.now() + '-empty', 
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
            id: Date.now() + '-user', 
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
        const errorBubble: ChatBubble = { id: Date.now() + '-error', type: 'error', content: 'Error' }; // Or use a specific error message
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
      return [...others, { id: Date.now() + Math.random() + '', type: 'user', content: newInput }];
    });
    
    // Always scroll to bottom after any key press
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
  }, [keypadInput, handleInput, setKeypadInput, setBubbles, expectingFreshInput, vibrationEnabled]); // Dependencies: state and handlers

  // Web keyboard handler (numbers and math symbols)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Handle paste (Ctrl+V)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        // Filter only numbers and allowed operators
        const filtered = text.replace(/[^0-9+\-*/.()%^]/g, '');
        if (filtered) {
          filtered.split('').forEach(char => onKeypadPress(char));
        }
      });
      return;
    }

    // Use mapped symbols ('×', '÷') in allowed list
    const allowed = ['0','1','2','3','4','5','6','7','8','9','+','-','×','÷','.','(',')','%','^','√'];
    let key = e.key;
    if (key === '*') key = '×';
    if (key.toLowerCase() === 'x') key = '×';
    if (key === '/') key = '÷';
    
    // Handle special keyboard shortcuts
    if (key.toLowerCase() === 'r') {
      // Reset shortcut
      setBubbles([]);
      setKeypadInput('');
      setPreviewResult(null);
      setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
      return;
    }
    
    if (key.toLowerCase() === 'm') {
      // Mute shortcut
      toggleSpeechMute();
      return;
    }
    
    // Re-enable Enter key mapping
    if (allowed.includes(key) || key === 'Backspace' || key === 'Enter') {
      if (key === 'Backspace') {
        onKeypadPress('⌫');
      } else if (key === 'Enter') {
        onKeypadPress('='); // Map Enter to equals
      } else {
        onKeypadPress(key);
      }
      e.preventDefault();
    }
  }, [onKeypadPress]); // Dependency: Ensure listener uses latest handler

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]); // Dependency: Ensure listener uses latest handler

  // Scroll to bottom on any bubble change (legacy, non-animated)
  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: false });
  }, [bubbles]);

  // Scroll to bottom with animation when a new result appears
  useEffect(() => {
    if (bubbles.length > 0 && bubbles[bubbles.length - 1].type === 'result') {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100); // allow render
    }
  }, [bubbles]);

  // Live result preview effect
  useEffect(() => {
    if (!keypadInput.trim()) {
      setPreviewResult(null);
      return;
    }

    try {
      let expression = keypadInput.replace(/×/g, '*').replace(/÷/g, '/');
      expression = expression.replace(/(\d+)%/g, '($1 / 100)');
      expression = expression.replace(/%/g, '/100'); // Trailing %

      // Basic check to avoid errors on partial input (e.g., "5+")
      const lastChar = expression.trim().slice(-1);
      if (['+','-','*','/','^','('].includes(lastChar)) {
        return // Still return to avoid evaluation error, but keep existing preview
      }

      const result = evaluate(expression);
      // Avoid showing preview if result is complex or an object/function
      if (typeof result === 'number' || (typeof result === 'string' && !isNaN(parseFloat(result)))) {
        if (keypadInput.trim() === result.toString()) {
          setPreviewResult(null);
        } else {
          setPreviewResult(result.toString());
        }
      } else {
        setPreviewResult(null)
      }
    } catch (error) {
      // Ignore errors during preview, just don't show a result
      setPreviewResult(null);
    }
  }, [keypadInput, handleInput]);

  // Audio recording logic for speech-to-text
  // Platform-specific speech-to-text
  const startRecording = async () => {
    if (Platform.OS === 'web') {
      // Web Speech API
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        Alert.alert('Speech recognition not supported in this browser.');
        return;
      }
      const WebSpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new WebSpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setIsRecording(true);
      setIsTranscribing(true);
      recognition.onresult = (event: any) => {
        handleWebSpeechResult(event.results[0][0].transcript);
      };
      recognition.onerror = (event: any) => {
        // Silent error handling
        setIsRecording(false);
        setIsTranscribing(false);
      };
      recognition.onend = () => {
        setIsRecording(false);
        setIsTranscribing(false);
      };
      recognition.start();
      return;
    }
    
    // --- Native speech recognition (Android/iOS) ---
    try {
      if (!speechModuleRef.current) {
        speechModuleRef.current = await import('expo-speech-recognition');
      }
      const { ExpoSpeechRecognitionModule } = speechModuleRef.current;

      // Always make sure we start clean
      if (isRecording || isTranscribing) {
        // Already recording or processing, don't start again
        return;
      }
      
      // Immediately clean up any existing listeners
      if (speechListenerRef.current) {
        speechListenerRef.current.remove();
        speechListenerRef.current = null;
      }
      if (errorListenerRef.current) {
        errorListenerRef.current.remove();
        errorListenerRef.current = null;
      }
      
      setIsRecording(true);
      setIsTranscribing(true);
      
      // Check permissions for audio recording first
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission required', 'Microphone permission is required.');
        setIsRecording(false);
        setIsTranscribing(false);
        return;
      }
      
      // Important: Use a single-result approach
      // Create a processing function that will only be called once
      let resultProcessed = false;
      
      const handleResult = (event: any) => {
        // Critical: Immediately remove all listeners to prevent duplicates
        if (speechListenerRef.current) {
          speechListenerRef.current.remove();
          speechListenerRef.current = null;
        }
        if (errorListenerRef.current) {
          errorListenerRef.current.remove();
          errorListenerRef.current = null;
        }
        
        // Ensure we only process results once
        if (resultProcessed) return;
        resultProcessed = true;
        
        // Stop recognition immediately
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch (error: unknown) {
          // Silent error handling
        }
        
        setIsRecording(false);
        setIsTranscribing(false);
        
        if (event.results && event.results.length > 0) {
          const transcript = event.results[0].transcript;
          // Remove console.log
          setTimeout(() => {
            processNativeTranscription(transcript);
          }, 10);
        } else {
          if (Platform.OS === 'android') {
            ToastAndroid.show('No speech detected', ToastAndroid.SHORT);
          } else {
            // For iOS, use a subtle bubble that auto-dismisses
            setBubbles(prev => [
              { 
                id: Date.now() + '-empty', 
                type: 'calc', 
                content: 'Try speaking again' 
              },
              ...prev
            ]);
            // Auto-remove the bubble after 2 seconds
            setTimeout(() => {
              setBubbles(prev => prev.filter(b => !b.id.endsWith('-empty')));
            }, 2000);
          }
        }
      };
      
      const handleError = (event: any) => {
        // Critical: Immediately remove all listeners to prevent duplicates
        if (speechListenerRef.current) {
          speechListenerRef.current.remove();
          speechListenerRef.current = null;
        }
        if (errorListenerRef.current) {
          errorListenerRef.current.remove();
          errorListenerRef.current = null;
        }
        
        // Ensure we only process errors once
        if (resultProcessed) return;
        resultProcessed = true;
        
        // Stop recognition immediately
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch (error: unknown) {
          // Silent error handling
        }
        
        setIsRecording(false);
        setIsTranscribing(false);
        
        if (Platform.OS === 'android') {
          ToastAndroid.show('Try speaking again', ToastAndroid.SHORT);
        } else {
          // For iOS, use a subtle bubble that auto-dismisses
          setBubbles(prev => [
            { 
              id: Date.now() + '-empty', 
              type: 'calc', 
              content: 'Try speaking again' 
            },
            ...prev
          ]);
          // Auto-remove the bubble after 2 seconds
          setTimeout(() => {
            setBubbles(prev => prev.filter(b => !b.id.endsWith('-empty')));
          }, 2000);
        }
      };
      
      // Add listeners
      speechListenerRef.current = ExpoSpeechRecognitionModule.addListener('result', handleResult);
      errorListenerRef.current = ExpoSpeechRecognitionModule.addListener('error', handleError);
      
      // Add a safety timeout to prevent hanging in recording state
      const safetyTimeout = setTimeout(() => {
        if (isRecording) {
          // If we're still recording after 10 seconds, force stop
          stopRecording();
          setBubbles(prev => [...prev, { 
            id: Date.now() + Math.random() + '', 
            type: 'error', 
            content: 'Recording stopped: Maximum time limit reached (10 seconds)' 
          }]);
        }
      }, 10000);
      
      // Add silence detection timeout
      let lastAudioLevel = 0;
      let silenceCounter = 0;
      const silenceTimeout = setInterval(() => {
        if (!isRecording) {
          clearInterval(silenceTimeout);
          return;
        }
        
        // Get audio level from the recognition module
        ExpoSpeechRecognitionModule.getAudioLevel().then((level: number) => {
          if (level === lastAudioLevel || level < 0.1) { // Threshold for silence
            silenceCounter++;
            if (silenceCounter >= 3) { // 3 consecutive silence checks (1.5 seconds)
              stopRecording();
              setBubbles(prev => [...prev, { 
                id: Date.now() + Math.random() + '', 
                type: 'calc', 
                content: 'Recording stopped: Silence detected' 
              }]);
              clearInterval(silenceTimeout);
            }
          } else {
            silenceCounter = 0;
          }
          lastAudioLevel = level;
        });
      }, 500); // Check every 500ms
      
      // Start speech recognition
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        continuous: false,
        interimResults: false  // Changed to false - we only want final results
      });
      
    } catch (e) {
      // Silent error handling
      setIsRecording(false);
      setIsTranscribing(false);
      
      // Clean up any listeners that might have been created
      if (speechListenerRef.current) {
        speechListenerRef.current.remove();
        speechListenerRef.current = null;
      }
      if (errorListenerRef.current) {
        errorListenerRef.current.remove();
        errorListenerRef.current = null;
      }
      
      if (Platform.OS === 'android') {
        ToastAndroid.show('Try speaking again', ToastAndroid.SHORT);
      } else {
        // For iOS, use a subtle bubble that auto-dismisses
        setBubbles(prev => [
          { 
            id: Date.now() + '-empty', 
            type: 'calc', 
            content: 'Try speaking again' 
          },
          ...prev
        ]);
        // Auto-remove the bubble after 2 seconds
        setTimeout(() => {
          setBubbles(prev => prev.filter(b => !b.id.endsWith('-empty')));
        }, 2000);
      }
    }
  };

  // Only needed for manual stop (web or if we need to cancel)
  const stopRecording = async () => {
    if (Platform.OS === 'web') return;
    
    setIsRecording(false);
    setIsTranscribing(false);
    
    try {
      if (!speechModuleRef.current) {
        // Should ideally be loaded by startRecording, but as a fallback:
        speechModuleRef.current = await import('expo-speech-recognition');
      }
      const { ExpoSpeechRecognitionModule } = speechModuleRef.current;
      // Stop native speech recognition
      await ExpoSpeechRecognitionModule.stop();
      
      // Remove listeners
      if (speechListenerRef.current) {
        speechListenerRef.current.remove();
        speechListenerRef.current = null;
      }
      
      if (errorListenerRef.current) {
        errorListenerRef.current.remove();
        errorListenerRef.current = null;
      }
    } catch (e) {
      console.error('Error stopping speech recognition:', e);
    }
  };

  // Process native speech recognition results
  const processNativeTranscription = (transcript: string) => {
    if (!transcript) {
      setBubbles(prev => [...prev, { 
        id: Date.now() + Math.random() + '', 
        type: 'error', 
        content: 'Empty transcript received.' 
      }]);
      return;
    }

    // Stage 1: Lowercase and normalize whitespace
    let processedTranscript = transcript.toLowerCase();
    processedTranscript = processedTranscript.replace(/\s+/g, ' ');
    
    // Using the same normalization logic
    let normalized = normalizeSpokenMath(processedTranscript);
    normalized = normalized.trim();
    const trimmedNormalized = normalized;

    // Check if input starts with an operator and prepend last result if applicable
    const startsWithOperator = ['+', '-', '*', '/', '%'].some(op => trimmedNormalized.startsWith(op));
    if (startsWithOperator) {
      const lastResult = lastResultRef.current;
      if (lastResult !== null) {
        // Ensure space between last result and operator
        normalized = lastResult + ' ' + trimmedNormalized;
      }
    }

    // Calculate the result from the normalized transcript
    const result = handleInput(normalized, 'speech');
    
    if (result !== 'Error') {
      // Create a bubble showing the equation with equals sign
      const equationBubble: ChatBubble = { id: Date.now() + '-equation', type: 'user', content: `${normalized} = ${result}` };
      // Create the result bubble to show just the result
      const resultBubble: ChatBubble = { id: Date.now() + '-calc', type: 'calc', content: result };
      // Create a result-input bubble for gray preview (same as keypad input)
      const nextUserBubble: ChatBubble = { 
        id: Date.now() + '-user', 
        type: 'result-input',
        content: result 
      };
      
      if (enterKeyNewLine) {
        // New Line Mode: Create a new empty user bubble instead of showing the result
        const newEmptyBubble: ChatBubble = {
          id: Date.now() + '-empty', 
          type: 'user',
          content: ''
        };
        
        setBubbles(prev => {
          // Remove any current equation bubble if it exists
          const filteredBubbles = prev.filter(b => b.type !== 'user' || b.content !== keypadInput);
          // Append the equation bubble, result bubble, and a new empty bubble
          return [...filteredBubbles, equationBubble, resultBubble, newEmptyBubble];
        });
        
        // Clear the keypad input for the new line
        setKeypadInput('');
        // Don't show preview result in new line mode
        setPreviewResult(null);
      } else {
        // Normal Mode: Show the result in the input field (same as keypad input)
        setBubbles(prev => {
          // Remove any current equation bubble if it exists
          const filteredBubbles = prev.filter(b => b.type !== 'user' || b.content !== keypadInput);
          // Append the equation bubble, result bubble and the result input bubble
          return [...filteredBubbles, equationBubble, resultBubble, nextUserBubble];
        });
        
        // Set the result as the current input
        setKeypadInput(result);
      }
      
      // Common operations regardless of mode
      // Speak only the result if not muted
      speakIfUnmuted(result);
      lastResultRef.current = result; // Set the ref here
      setExpectingFreshInput(true); // Next '=' or operation starts fresh
      // Send to webhook if configured
      if (historyEnabled) {
        addCalculation(normalized, result);
      }
      sendWebhookData(normalized, result);
    } else {
      setBubbles((prev: ChatBubble[]) => [...prev, { 
        id: Date.now() + Math.random() + '', 
        type: 'error', 
        content: 'Sorry, please try again' // Changed from 'Could not calculate'
      }]);
      setKeypadInput('');
      setExpectingFreshInput(false);
    }
  };

  // Process Web Speech Result (separate from recognition callback)
  const handleWebSpeechResult = (transcript: string) => {
    if (transcript) {
      // Normalize the spoken text to get the equation
      let spokenEquation = normalizeSpokenMath(transcript);
      spokenEquation = spokenEquation.trim(); // Trim here
      const trimmedEquation = spokenEquation; // Use the trimmed value

      // Check if input starts with an operator and prepend last result if applicable
      const startsWithOperator = ['+', '-', '*', '/', '%'].some(op => 
        trimmedEquation.startsWith(op)
      );
      if (startsWithOperator) {
        const lastResult = lastResultRef.current;
        if (lastResult !== null) {
          // Ensure space between last result and operator
          spokenEquation = lastResult + ' ' + trimmedEquation;
        }
      }

      // Calculate the result using the (potentially modified) equation
      const result = handleInput(spokenEquation, 'speech');
      
      if (result !== 'Error') {
        // Create a bubble showing the equation with equals sign
        const equationBubble: ChatBubble = { id: Date.now() + '-equation', type: 'user', content: `${spokenEquation} = ${result}` };
        // Create the result bubble to show just the result
        const resultBubble: ChatBubble = { id: Date.now() + '-calc', type: 'calc', content: result };
        // Create a result-input bubble for gray preview (same as keypad input)
        const nextUserBubble: ChatBubble = { 
          id: Date.now() + '-user', 
          type: 'result-input',
          content: result 
        };
        
        if (enterKeyNewLine) {
          // New Line Mode: Create a new empty user bubble instead of showing the result
          const newEmptyBubble: ChatBubble = {
            id: Date.now() + '-empty', 
            type: 'user',
            content: ''
          };
          
          setBubbles(prev => {
            // Remove any current equation bubble if it exists
            const filteredBubbles = prev.filter(b => b.type !== 'user' || b.content !== keypadInput);
            // Append the equation bubble, result bubble, and a new empty bubble
            return [...filteredBubbles, equationBubble, resultBubble, newEmptyBubble];
          });
          
          // Clear the keypad input for the new line
          setKeypadInput('');
          // Don't show preview result in new line mode
          setPreviewResult(null);
        } else {
          // Normal Mode: Show the result in the input field (same as keypad input)
          setBubbles(prev => {
            // Remove any current equation bubble if it exists
            const filteredBubbles = prev.filter(b => b.type !== 'user' || b.content !== keypadInput);
            // Append the equation bubble, result bubble and the result input bubble
            return [...filteredBubbles, equationBubble, resultBubble, nextUserBubble];
          });
          
          // Set the result as the current input
          setKeypadInput(result);
        }
        
        // Common operations regardless of mode
        // Speak only the result if not muted
        speakIfUnmuted(result);
        lastResultRef.current = result; // Set the ref here
        setExpectingFreshInput(true); // Next '=' or operation starts fresh
        // --- Webhook: also send vocal result to webhook ---
        if (historyEnabled) {
          addCalculation(spokenEquation, result);
        }
        sendWebhookData(spokenEquation, result);
       } else {
        setBubbles((prev: ChatBubble[]) => [...prev, { id: Date.now() + Math.random() + '', type: 'error', content: 'Sorry, please try again' }]); // Changed from 'Could not calculate'
        // No error speech
        setKeypadInput(''); // Clear input on error
        setExpectingFreshInput(false);
      }
    } else {
      setBubbles(prev => [...prev, { id: Date.now() + Math.random() + '', type: 'error', content: 'No transcript received.' }]);
    }

    setIsRecording(false); // Ensure recording stops
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
          ToastAndroid.show('Could not send data', ToastAndroid.SHORT);
        }
      }
    } else {
      // Add to bulk queue without logging
      const newItem = {
        id: Date.now() + Math.random(),
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
        setHasActiveWebhooks(webhookItems.some((item: WebhookItem) => item.active));
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
              axios.post(webhook.url, dataToSend)
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
        ToastAndroid.show('Could not save settings', ToastAndroid.SHORT);
      }
    }
  }, [webhookUrls, sendEquation, streamResults]);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [storedOpenInCalcMode, storedSpeechMuted, storedHistoryEnabled] = await Promise.all([
          AsyncStorage.getItem('openInCalcMode'),
          AsyncStorage.getItem('speechMuted'),
          AsyncStorage.getItem('historyEnabled')
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
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Save settings when they change
  useEffect(() => {
    const saveSettings = async () => {
      try {
        await Promise.all([
          AsyncStorage.setItem('openInCalcMode', JSON.stringify(openInCalcMode)),
          AsyncStorage.setItem('speechMuted', JSON.stringify(isSpeechMuted)),
          AsyncStorage.setItem('historyEnabled', JSON.stringify(historyEnabled))
        ]);
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    };
    saveSettings();
  }, [openInCalcMode, isSpeechMuted, historyEnabled]);

  // --- Component Lifecycle & Effects ---
  
  // Add keyboard event listener for shortcuts (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // M key for mute toggle
      if (e.key.toLowerCase() === 'm') {
        toggleSpeechMute();
      }
      
      // Ctrl+Backspace for reset
      if (e.key === 'Backspace' && e.ctrlKey) {
        console.log('Ctrl+Backspace detected for reset');
        setBubbles([]);
        setKeypadInput('');
        setPreviewResult(null);
        setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
        e.preventDefault(); // Prevent default backspace behavior
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleSpeechMute]);

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
        Alert.alert("Invalid URL", "Webhook URL must start with http:// or https://");
      }
    } else if (urlExists) {
      Alert.alert("Duplicate", "This URL is already added.");
    } else {
      Alert.alert("Invalid URL", "Please enter a valid URL.");
    }
  };

  const handleDeleteWebhook = (urlToDelete: string) => {
    setWebhookUrls(webhookUrls.filter(webhook => webhook.url !== urlToDelete));
  };
  
  // Handle toggling webhook activation
  const handleToggleWebhook = (url: string, active: boolean) => {
    console.log('Toggling webhook:', url, 'to', active);
    setWebhookUrls(webhookUrls.map(webhook => 
      webhook.url === url ? { ...webhook, active } : webhook
    ));
    
    // If activating a webhook and there are pending calculations, log it
    if (active && pendingWebhookDataRef.current.length > 0) {
      console.log(`Webhook activated with ${pendingWebhookDataRef.current.length} pending calculations`);
    }
  };

  // Implement handleSendBulkData to send bulk data to active webhooks
  const handleSendBulkData = async () => {
    if (bulkData.length === 0) {
      Alert.alert("No Data", "There is no stored data to send.");
      return;
    }
    const activeWebhooks = webhookUrls.filter(webhook => webhook.active);
    if (activeWebhooks.length === 0) {
      Alert.alert("No Active URLs", "Please activate at least one webhook URL in settings.");
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
          const promise = axios.post(webhookUrl, itemData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 8000 // Slightly longer timeout for bulk potentially
          })
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
              // Access the url property which is definitely a string
              console.log(`Bulk send success to ${urlOutcome.value.url} for item ${bulkData[itemIndex]?.id}`);
            } else {
              failureCount++;
              // Explicitly cast the reason to our failure payload type
              const failureInfo = urlOutcome.reason;
              console.error(`Bulk send failed to ${failureInfo.url} for item ${bulkData[itemIndex]?.id}:`, 
                failureInfo.error?.message || failureInfo.error);
            }
          }
        } else {
          // This means the Promise.allSettled for an item batch rejected
          console.error(`Error processing bulk item ${bulkData[itemIndex]?.id}:`, itemOutcome.reason);
          failureCount += activeWebhooks.length; // Assume failure for all URLs for this item
        }
      }

      // Clear bulk data after attempting to send
      setBulkData([]);

      // Provide summary feedback
      Alert.alert(
        "Bulk Send Complete",
        `Successfully sent data to ${successCount} endpoints.\nFailed to send data to ${failureCount} endpoints.`
      );

    } catch (error) {
      console.error("Error during bulk send process:", error);
      Alert.alert("Bulk Send Error", "An unexpected error occurred during the bulk send process.");
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
      Clipboard.setString(text);
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
            id: Date.now() + '-copy', 
            type: 'calc', 
            content: 'Answer copied to clipboard' 
          },
          ...prev
        ]);
        // Remove the notification bubble after 2 seconds
        setTimeout(() => {
          setBubbles(prev => prev.filter(b => !b.id.endsWith('-copy')));
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
      if (isCurrentUserBubble) {
        return (
          <View style={styles.currentUserBubbleContainer}>
            <View style={styles.userBubble}>
              <Text style={styles.userText}>{item.content || ' '}</Text>
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
              <Text style={[styles.userText, { color: '#888' }]}>{item.content}</Text>
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
  }, [bubbles.length, keypadInput, vibrationEnabled]);

  // Log rendering outside of JSX to avoid TypeScript errors
  // console.log('CalculatorScreen rendering...');
  
  // Wrapper component for Web Empty State with logging
  const WebEmptyState = () => {
    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/images/LOGO.png')} 
            style={{ width: 200, height: 80, resizeMode: 'contain' }}
            fadeDuration={0}
            // Use default loading priority
            defaultSource={require('../assets/images/LOGO.png')}
          />
          <Text style={styles.betaText}>BETA</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <AppIcon name="keyboard-space" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>Press <Text style={styles.emptyStateHighlight}>Space</Text> to start recording</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <AppIcon name="send" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>Press <Text style={styles.emptyStateHighlight}>Send</Text> to confirm calculation</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <AppIcon name="webhook" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>Use <Text style={styles.emptyStateHighlight}>Webhook</Text> to send results to Google Sheets</Text>
        </View>
      </View>
    );
  };

  // Wrapper component for Mobile Empty State with logging
  const MobileEmptyState = () => {
    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/images/LOGO.png')} 
            style={{ width: 180, height: 72, resizeMode: 'contain' }}
            fadeDuration={0}
            // Use default loading priority
            defaultSource={require('../assets/images/LOGO.png')}
          />
          <Text style={styles.betaText}>BETA</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <AppIcon name="microphone" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>Press <Text style={styles.emptyStateHighlight}>Record icon</Text> to start recording</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <AppIcon name="send" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>Press <Text style={styles.emptyStateHighlight}>Send</Text> to confirm calculation</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <AppIcon name="webhook" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>Use <Text style={styles.emptyStateHighlight}>Webhook</Text> to send results</Text>
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
                <Text style={styles.tooltipText}>Reset (Ctrl+Backspace)</Text>
              </View>
            )}
          </View>
        )}
        {/* History Button: always show */}
        <View style={styles.tooltipContainer}>
          <HistoryButton onPress={() => setShowHistoryModal(true)} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      
      {/* Render Header Controls */}
      {renderHeaderControls()}

      <FlatList
        style={{ flex: 1 }}
        ref={flatListRef}
        data={
          previewResult
            ? [...bubbles, { id: 'preview', type: 'result', content: previewResult }]
            : bubbles
        }
        renderItem={renderBubble}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.chatArea}
        ListEmptyComponent={
          showKeypad ? null : (
            Platform.OS === 'web' ? <WebEmptyState /> : <MobileEmptyState />
          )
        }
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
          setHistoryEnabled={setHistoryEnabled} // Add this line
        />
      </Suspense>

      {/* History Modal */}
      <Suspense fallback={null}>
        <HistoryModal
          visible={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          history={history}
          onDelete={deleteCalculation}
          onClearAll={clearAllCalculations}
          onSelect={(item) => {
            // Handle selecting a history item, e.g., fill input or display
            if (item.result) {
              setKeypadInput(item.result); // Or append to current input
              setShowHistoryModal(false); // Close modal after selection
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
            isRecording ? { backgroundColor: '#0066cc' } : {}, // Blue if recording
            isWebMobile && styles.micButtonWebMobile // Additional styles for web mobile
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
        >
          {isTranscribing ? (
            <ActivityIndicator color="#eee" />
          ) : (
            <AppIcon name={isRecording ? "stop" : "microphone"} size={isWebMobile ? 40 : 60} color="#eee" />
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
                    <Text style={[styles.tooltipText, { fontWeight: 'bold', fontSize: 16, color: '#888' }]}>ACTIVE WEBHOOKS</Text>
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
                    <Text style={[styles.tooltipText, { fontWeight: 'bold', fontSize: 16, color: '#888' }]}>ACTIVE WEBHOOKS</Text>
                  </View>
                  <Text style={[styles.tooltipText, { fontSize: 13 }]}>None</Text>
                </View>
              )}
              
              {/* Bulk data info */}
              {!streamResults && bulkData.length > 0 && (
                <View>
                  <Text style={[styles.tooltipText, { fontWeight: 'bold', fontSize: 16, color: '#888', marginBottom: 8 }]}>DATA QUEUE</Text>
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
        } 
      : {
          backgroundColor: '#1C1C1E',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 3,
          elevation: 3,
        }
    ),
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 5,
    borderRadius: 4,
    bottom: -30, // Position below the icon
    left: -20, // Center it better
    width: 80,
    alignItems: 'center',
    opacity: 0.9,
    zIndex: 1000, // Ensure tooltip is above other elements
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
    color: '#fff',
    fontSize: 12,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
