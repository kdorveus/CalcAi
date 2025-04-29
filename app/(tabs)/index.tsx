import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Button, 
  ViewStyle, 
  TextStyle, 
  ImageStyle,
  Pressable,
  Image
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { evaluate } from 'mathjs';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Settings from '../components/Settings';
import * as SpeechRecognition from 'expo-speech-recognition';
import { 
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from 'expo-speech-recognition';
import Animated from 'react-native-reanimated';

// Add debug logs
// console.log('CalculatorScreen module loading...');

// Types
interface ChatBubble {
  id: string;
  type: 'user' | 'result' | 'error' | 'speech' | 'calc' | 'result-input';
  content: string;
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
  // Setup animation values for swipe effects
  // const translateX = useSharedValue(0);
  // const translateY = useSharedValue(0);
  
  // Refs
  const flatListRef = useRef<FlatList>(null);
  const keypadInputRef = useRef('');
  const soundRef = useRef<Audio.Sound | null>(null);
  
  // State variables
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [showKeypad, setShowKeypad] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const lastResultRef = useRef<string | null>(null);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false); // State for modal
  const [isUnsentDataModalVisible, setIsUnsentDataModalVisible] = useState(false); // State for unsent data alert modal
  const [isSpeechMuted, setIsSpeechMuted] = useState(false); // State for UI updates
  const speechMutedRef = useRef(false); // Ref for actual mute control
  
  // State for tracking tooltip hover
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  
  // Simple function to toggle tooltip visibility
  const toggleTooltip = useCallback((tooltipId: string | null) => {
    setHoveredTooltip(tooltipId);
  }, []);
  
  // Function to safely speak text when not muted
  const speakIfUnmuted = useCallback((text: string) => {
    console.log('Speaking if unmuted:', text, 'Muted:', speechMutedRef.current);
    if (!speechMutedRef.current) {
      Speech.speak(text, { language: 'en-US' });
    }
  }, []);
  
  // Function to stop all speech and update mute state
  const toggleSpeechMute = useCallback(() => {
    const newMuteState = !speechMutedRef.current;
    speechMutedRef.current = newMuteState;
    setIsSpeechMuted(newMuteState); // Update state for UI
    
    console.log('Mute toggled to:', newMuteState);
    
    // Stop any ongoing speech when muted
    if (newMuteState) {
      Speech.stop();
    }
    
    // Show notification about mute state
    const message = newMuteState ? 'Voice output muted' : 'Voice output enabled';
    setBubbles(prev => [...prev, { 
      id: Date.now() + '-notification', 
      type: 'calc' as const, 
      content: message 
    }]);
  }, []);

  // --- Settings State ---
  const [webhookUrls, setWebhookUrls] = useState<any[]>([]);
  const [hasActiveWebhooks, setHasActiveWebhooks] = useState<boolean>(false);
  const [enterKeyNewLine, setEnterKeyNewLine] = useState<boolean>(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState<string>('');
  const [newWebhookTitle, setNewWebhookTitle] = useState<string>(''); // Add state for webhook title
  const [sendEquation, setSendEquation] = useState<boolean>(false); // Send 'equation=result' vs 'result'
  const [streamResults, setStreamResults] = useState<boolean>(false); // Send immediately vs bulk
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
  const [advancedMode, setAdvancedMode] = useState(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(true); // Add vibration state
  const KEYPAD = [
    ['↺', '%', '^', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['()', '0', '.', 'CHECK_ICON']
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
      Vibration.vibrate(10); // Only vibrate if enabled
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
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
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
  }, [keypadInput, handleInput, setAdvancedMode, setKeypadInput, setBubbles, expectingFreshInput, vibrationEnabled]); // Dependencies: state and handlers

  // Web keyboard handler (numbers and math symbols)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
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
        console.error('Web Speech API Error:', event.error);
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
          console.error('Error stopping speech recognition:', error);
        }
        
        setIsRecording(false);
        setIsTranscribing(false);
        
        if (event.results && event.results.length > 0) {
          const transcript = event.results[0].transcript;
          console.log('Transcript received:', transcript);
          
          // Process after a short delay to ensure everything is cleaned up
          setTimeout(() => {
            processNativeTranscription(transcript);
          }, 10);
        } else {
          setBubbles(prev => [...prev, { 
            id: Date.now() + Math.random() + '', 
            type: 'error', 
            content: 'No speech detected.' 
          }]);
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
          console.error('Error stopping speech recognition:', error);
        }
        
        console.error('Speech recognition error:', event);
        setIsRecording(false);
        setIsTranscribing(false);
        
        setBubbles(prev => [...prev, { 
          id: Date.now() + Math.random() + '', 
          type: 'error', 
          content: 'Speech recognition failed.' 
        }]);
      };
      
      // Add listeners
      speechListenerRef.current = ExpoSpeechRecognitionModule.addListener('result', handleResult);
      errorListenerRef.current = ExpoSpeechRecognitionModule.addListener('error', handleError);
      
      // Add a safety timeout to prevent hanging in recording state
      const safetyTimeout = setTimeout(() => {
        if (isRecording) {
          // If we're still recording after 10 seconds, force stop
          stopRecording();
        }
      }, 10000);
      
      // Start speech recognition
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        continuous: false,
        interimResults: false  // Changed to false - we only want final results
      });
      
    } catch (e) {
      console.error('Error starting speech recognition:', e);
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
      
      Alert.alert('Error', 'Could not start speech recognition.');
    }
  };

  // Only needed for manual stop (web or if we need to cancel)
  const stopRecording = async () => {
    if (Platform.OS === 'web') return;
    
    setIsRecording(false);
    setIsTranscribing(false);
    
    try {
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
      sendWebhookData(normalized, result);
    } else {
      setBubbles((prev: ChatBubble[]) => [...prev, { 
        id: Date.now() + Math.random() + '', 
        type: 'error', 
        content: 'Could not calculate' 
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
        sendWebhookData(spokenEquation, result);
       } else {
        setBubbles((prev: ChatBubble[]) => [...prev, { id: Date.now() + Math.random() + '', type: 'error', content: 'Could not calculate' }]);
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
    console.log('Sending webhook data:', equation, result, 'Settings loaded:', webhookSettingsLoaded);
    
    // If settings aren't loaded yet, store the calculation for later
    if (!webhookSettingsLoaded) {
      console.log('Settings not loaded yet, storing calculation for later');
      pendingWebhookDataRef.current.push({equation, result});
      return;
    }
    
    // ALWAYS store calculations for potential later use
    // This ensures we can send them if webhooks are activated later
    pendingWebhookDataRef.current.push({equation, result});
    
    // Get active webhooks only
    const activeWebhooks = webhookUrls.filter(webhook => webhook.active);
    
    // IMPORTANT: Only proceed if there are active webhooks
    if (activeWebhooks.length === 0) {
      console.log('No active webhook URLs configured. Calculation stored for later.');
      return; // No active URLs to send to
    }

    // Sanitize data before sending
    const sanitizedEquation = equation.replace(/[<>]/g, '');
    const sanitizedResult = result.replace(/[<>]/g, '');
    const dataToSend = sendEquation ? `${sanitizedEquation}=${sanitizedResult}` : sanitizedResult;

    if (streamResults) {
      // Stream immediately
      const activeWebhooks = webhookUrls.filter(webhook => webhook.active && webhook.url.startsWith('https://'));
      console.log(`Streaming data to ${activeWebhooks.length} URLs:`, dataToSend);
      
      // Rate limiting - max 10 requests per second
      const requests = activeWebhooks.map((webhook, index) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              axios.post(webhook.url, 
                { 
                  data: dataToSend,
                  timestamp: Date.now(),
                  type: 'calculation'
                }, 
                {
                  headers: { 
                    'Content-Type': 'application/json',
                    'X-App-Version': '1.0.0',
                    'X-Request-ID': `${Date.now()}-${Math.random()}`
                  },
                  timeout: 5000
                }
              )
            );
          }, index * 100); // Spread requests 100ms apart
        });
      });

      try {
        const results = await Promise.allSettled(requests);
        results.forEach(outcome => {
          if (outcome.status === 'fulfilled') {
            const response = (outcome as PromiseFulfilledResult<any>).value;
            console.log(`Successfully sent data:`, response.status);
          } else {
            const error = (outcome as PromiseRejectedResult).reason;
            console.error(`Failed to send data:`, error.message || error);
          }
        });
      } catch (error) {
        console.error('Error sending webhook data:', error);
      }
    } else {
      // Add to bulk data array with additional metadata
      const newItem = {
        id: Date.now() + Math.random(),
        timestamp: Date.now(),
        data: dataToSend,
        type: 'calculation',
        version: '1.0.0'
      };
      setBulkData(prev => [...prev, newItem]);
      console.log('Added data to bulk queue:', newItem);
    }
  };

  // --- Load/Save Webhook Settings ---
  const SETTINGS_KEYS = {
    URLS: 'webhookUrls',
    SEND_EQUATION: 'sendEquation',
    STREAM_RESULTS: 'streamResults',
  };

  const loadSettings = useCallback(async () => {
    console.log('[loadSettings] Starting...'); // Log start
    try {
      console.log('[loadSettings] Getting items from AsyncStorage...'); // Log before reads
      const storedUrls = await AsyncStorage.getItem(SETTINGS_KEYS.URLS);
      const storedSendEquation = await AsyncStorage.getItem(SETTINGS_KEYS.SEND_EQUATION);
      const storedStreamResults = await AsyncStorage.getItem(SETTINGS_KEYS.STREAM_RESULTS);
      console.log('[loadSettings] Got items. storedUrls:', storedUrls, 'storedSendEquation:', storedSendEquation, 'storedStreamResults:', storedStreamResults); // Log values read

      if (storedUrls) {
        console.log('[loadSettings] Parsing storedUrls...'); // Log before parse
        const parsedUrls = JSON.parse(storedUrls); 
        console.log('[loadSettings] Parsed storedUrls:', parsedUrls); // Log parsed value
        // Convert legacy string[] format to WebhookItem[] if needed
        const webhookItems = Array.isArray(parsedUrls) ? 
          parsedUrls.map(url => {
            return typeof url === 'string' ? { url, active: true } : url;
          }) : [];
        console.log('[loadSettings] Mapped webhookItems:', webhookItems); // Log mapped value
        setWebhookUrls(webhookItems);
        // Update hasActiveWebhooks state
        setHasActiveWebhooks(webhookItems.some(webhook => webhook.active));
        console.log('[loadSettings] Set webhookUrls and hasActiveWebhooks state.'); // Log after state set
      }
      if (storedSendEquation) {
        console.log('[loadSettings] Parsing storedSendEquation...'); // Log before parse
        const parsedSendEquation = JSON.parse(storedSendEquation);
        console.log('[loadSettings] Parsed storedSendEquation:', parsedSendEquation); // Log parsed value
        setSendEquation(parsedSendEquation);
        console.log('[loadSettings] Set sendEquation state.'); // Log after state set
      }
      if (storedStreamResults) {
        console.log('[loadSettings] Parsing storedStreamResults...'); // Log before parse
        const parsedStreamResults = JSON.parse(storedStreamResults);
        console.log('[loadSettings] Parsed storedStreamResults:', parsedStreamResults); // Log parsed value
        setStreamResults(parsedStreamResults);
        console.log('[loadSettings] Set streamResults state.'); // Log after state set
      }
      
      // Mark settings as loaded
      setWebhookSettingsLoaded(true);
      console.log('[loadSettings] Set webhookSettingsLoaded to true.'); // Log state set
      
      // Process any pending webhook data ONLY if there are active webhooks
      // Use a temporary variable to ensure we read the latest state if possible, though state updates might still be async
      const currentWebhookUrls = webhookUrls; // Read current state, though might not be updated yet
      const activeWebhooksExist = currentWebhookUrls.some((webhook: {url: string, active: boolean}) => webhook.active);
      console.log('[loadSettings] Checking for pending data. Pending count:', pendingWebhookDataRef.current.length, 'Active webhooks exist:', activeWebhooksExist); // Log before pending check
      if (pendingWebhookDataRef.current.length > 0 && activeWebhooksExist) {
        console.log('Processing pending webhook data:', pendingWebhookDataRef.current.length, 'items');
        // Create a copy of the pending data before processing
        const pendingData = [...pendingWebhookDataRef.current];
        // Clear the pending data before processing to avoid duplicates
        pendingWebhookDataRef.current = [];
        
        // Process each pending calculation
        for (const item of pendingData) {
          // Send directly to webhooks, bypassing the storage mechanism
          const dataToSend = sendEquation ? `${item.equation}=${item.result}` : item.result;
          const activeWebhooks = webhookUrls.filter(webhook => webhook.active);
          
          if (streamResults) {
            // Stream immediately
            console.log(`Streaming pending data to ${activeWebhooks.length} URLs:`, dataToSend);
            try {
              const requests = activeWebhooks.map(webhook => {
                return axios.post(webhook.url, { data: dataToSend }, {
                  headers: { 'Content-Type': 'application/json' },
                  timeout: 5000
                });
              });
              await Promise.allSettled(requests);
            } catch (error) {
              console.error('Error sending pending data:', error);
            }
          } else {
            // Add to bulk data array
            const newItem = {
              id: Date.now() + Math.random(),
              timestamp: Date.now(),
              data: dataToSend,
            };
            setBulkData(prev => [...prev, newItem]);
          }
        }
      }
    } catch (error) { // Catch block might hide the specific error
      console.error("[loadSettings] ERROR caught:", error); // Log the actual error
      Alert.alert("Error", "Could not load webhook settings.");
      // Mark settings as loaded even on error to avoid blocking forever
      setWebhookSettingsLoaded(true); 
      console.log('[loadSettings] Set webhookSettingsLoaded to true in CATCH block.'); // Log state set in catch
    }
  }, []); // Empty dependency array - runs once on mount

  const saveSettings = useCallback(async (urls: any[], sendEq: boolean, stream: boolean) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEYS.URLS, JSON.stringify(urls));
      await AsyncStorage.setItem(SETTINGS_KEYS.SEND_EQUATION, JSON.stringify(sendEq));
      await AsyncStorage.setItem(SETTINGS_KEYS.STREAM_RESULTS, JSON.stringify(stream));
    } catch (error) {
      console.error("Failed to save webhook settings:", error);
      // Optional: Alert user if saving fails
      // Alert.alert("Error", "Could not save webhook settings.");
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Save settings whenever they change
  useEffect(() => {
    // Don't save during initial load potentially triggered by loadSettings itself
    // A simple check like length > 0 might suffice if initial state is always empty
    // Or use a separate 'isLoaded' state if needed for more complex scenarios
    if (webhookUrls.length > 0 || !sendEquation || !streamResults) { // Basic check to avoid saving initial empty/default state unnecessarily
       saveSettings(webhookUrls, sendEquation, streamResults);
    }
    
    // Update hasActiveWebhooks whenever webhookUrls changes
    const newActiveState = webhookUrls.some(webhook => webhook.active);
    const previousActiveState = hasActiveWebhooks;
    setHasActiveWebhooks(newActiveState);
    
    // If webhooks just became active and settings are loaded, process pending data
    if (webhookSettingsLoaded && newActiveState && !previousActiveState && pendingWebhookDataRef.current.length > 0) {
      console.log('Webhooks activated, processing pending data');
      // Create a copy of the pending data
      const pendingData = [...pendingWebhookDataRef.current];
      // Clear pending data to avoid duplicates
      pendingWebhookDataRef.current = [];
      
      // Process each pending calculation
      pendingData.forEach(item => {
        // Call sendWebhookData for each pending item
        sendWebhookData(item.equation, item.result);
      });
    }
  }, [webhookUrls, sendEquation, streamResults, saveSettings, hasActiveWebhooks, webhookSettingsLoaded]);

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
    console.log(`[renderBubble] Rendering bubble ${index}, type: ${item.type}, id: ${item.id}`); // Log renderBubble call
    const isLastBubble = index === bubbles.length - 1;
    // Check if it's the last user bubble and its content matches the current keypadInput state
    const isCurrentUserBubble = item.type === 'user' && isLastBubble && item.content === keypadInput;

    if (item.type === 'result') {
      return (
        <View style={styles.resultBubble}>
          <Text style={styles.resultText}>{item.content}</Text>
        </View>
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
      // Special layout for the result in input field (grayed out)
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
        // Special layout for the live input row
        return (
          <View style={styles.currentUserBubbleContainer}>
            <View style={styles.userBubble}>
              <Text style={styles.userText}>{item.content || ' '}</Text>
            </View>
          </View>
        );
      } else {
        // Standard layout for past user bubbles
        // Check if the content contains an equals sign
        const hasEquals = item.content.includes('=');
        return (
          <View style={styles.userBubble}>
            <Text style={[styles.userText, hasEquals ? { color: '#888' } : null]}>{item.content}</Text>
          </View>
        );
      }
    }

    // Fallback for safety, should not be reached if types are handled
    return null;
  }, [bubbles.length, keypadInput, onKeypadPress]);

  // Log rendering outside of JSX to avoid TypeScript errors
  // console.log('CalculatorScreen rendering...');
  
  // Wrapper component for Web Empty State with logging
  const WebEmptyState = () => {
    console.log('[MainScreen] Rendering Web Empty State - Inside Component'); // Log inside component
    return (
      <View style={styles.emptyStateContainer}>
        <Image 
          source={require('../../assets/images/LOGO.png')} 
          style={{ width: 200, height: 80, marginBottom: 30, resizeMode: 'contain' }} 
        />
        <View style={styles.emptyStateItem}>
          <MaterialIcons name="space-bar" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>Press <Text style={styles.emptyStateHighlight}>Space</Text> to start recording</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <MaterialIcons name="send" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>Press <Text style={styles.emptyStateHighlight}>Send</Text> to confirm calculation</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <MaterialIcons name="webhook" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>Use <Text style={styles.emptyStateHighlight}>Webhook</Text> to send results to Google Sheets</Text>
        </View>
      </View>
    );
  };

  // Wrapper component for Mobile Empty State with logging
  const MobileEmptyState = () => {
    console.log('[MainScreen] Rendering Mobile Empty State');
    return (
      <View style={styles.emptyStateContainer}>
        <Image 
          source={require('../../assets/images/LOGO.png')} 
          style={{ width: 180, height: 72, marginBottom: 30, resizeMode: 'contain' }} 
        />
        <View style={styles.emptyStateItem}>
          <MaterialIcons name="mic" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>Press <Text style={styles.emptyStateHighlight}>Record icon</Text> to start recording</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <MaterialIcons name="send" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>Press <Text style={styles.emptyStateHighlight}>Send</Text> to confirm calculation</Text>
        </View>
        <View style={styles.emptyStateItem}>
          <MaterialIcons name="webhook" size={24} color="#ffffff" />
          <Text style={styles.emptyStateText}>Use <Text style={styles.emptyStateHighlight}>Webhook</Text> to send results</Text>
        </View>
      </View>
    );
  };

  console.log(`[MainScreen] Starting render...`); // Log start of render function
  console.log(`[MainScreen] Bubbles length: ${bubbles.length}, showKeypad: ${showKeypad}`); // Log bubbles length and showKeypad state
  return (
    <SafeAreaView style={styles.container}>
      {/* Remove the headerControls View */}
      <View style={{ 
        flex: 1, 
        minHeight: 200, 
        marginBottom: 15,
        maxHeight: showKeypad ? '50%' : '85%' // Adjust height based on keypad visibility
      }}> 
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
      </View> 
      
      {showKeypad && (
        <>
          <TouchableOpacity
            style={{
              alignSelf: 'flex-end',
              padding: 10,
              marginRight: 20,
            }}
            onPress={() => onKeypadPress('⌫')}
            activeOpacity={0.7}
            delayPressIn={0}
          >
            <MaterialIcons name="backspace" size={28} color="#eee" />
          </TouchableOpacity>
          <View style={styles.calculatorArea}>
            {KEYPAD.map((row, i) => (
              <View key={i} style={styles.keypadRow}>
                {row.map((key) => {
                  // Determine the button style
                  let buttonStyle = Platform.OS === 'web' 
                    ? styles.keypadKeyWeb
                    : (key === 'CHECK_ICON' 
                      ? styles.keypadKeyEnter
                      : ['+', '-', '×', '÷'].includes(key) 
                        ? styles.keypadKeyOperator
                        : styles.keypadKeyMobile);
                  
                  return (
                    <TouchableOpacity
                      key={key}
                      style={buttonStyle}
                      onPress={() => onKeypadPress(key)}
                      activeOpacity={0.7}
                      delayPressIn={0}
                    >
                      {key === '↺' ? (
                        // Render reset icon
                        <MaterialIcons name="refresh" size={28} color="#eee" style={{ transform: [{ scaleX: -1 }] }} />
                      ) : key === 'CHECK_ICON' ? (
                        // Render a send icon instead of return icon
                        <MaterialIcons name="send" size={24} color="#eee" />
                      ) : (
                        <Text style={styles.keypadKeyText}>{key}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </>
      )}
      
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
      />
      
      {/* Bottom bar with proper spacing and button sizes */}
      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={() => setShowKeypad(s => !s)} style={styles.bottomButton}>
          <MaterialIcons name="calculate" size={28} color="#ccc" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.micButton, // Base style
            isRecording ? { backgroundColor: '#0066cc' } : // Blue if recording
            {} // Default grey otherwise (covers idle and transcribing)
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
        >
          {isTranscribing ? (
            <ActivityIndicator color="#eee" />
          ) : (
            <MaterialIcons name={isRecording ? "stop" : "mic"} size={60} color="#eee" />
          )}
        </TouchableOpacity>
        {/* Webhook Icon with tooltip */}
        <View style={styles.tooltipContainer}>
          <Pressable 
            onPress={() => setIsSettingsModalVisible(true)}
            style={styles.bottomButton}
            onHoverIn={() => Platform.OS === 'web' && toggleTooltip('webhook')}
            onHoverOut={() => Platform.OS === 'web' && toggleTooltip(null)}
          > 
            <View>
              <MaterialIcons name="settings" size={28} color={hasActiveWebhooks ? "#0066cc" : "#ccc"} />
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
                    <MaterialIcons name="webhook" size={16} color="#888" style={{ marginRight: 5 }} />
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
                    <MaterialIcons name="webhook" size={16} color="#888" style={{ marginRight: 5 }} />
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
  bottomButton: ViewStyle;
  micButton: ViewStyle;
  calculatorArea: ViewStyle;
  keypadRow: ViewStyle;
  keypadKey: ViewStyle;
  keypadKeyText: TextStyle;
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
    marginTop: 40,
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
});

export default MainScreen;
