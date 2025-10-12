# Code Smell Analysis - Refactoring Plan

**Status**: 79 issues fixed. Remaining: 15 complex functions requiring refactoring.

---

## 🎯 REFACTORING PLAN

### **Priority 1: Critical Complexity (app/index.tsx)**

#### **1. Function: `onKeypadPress` (L915-1122, Complexity: 25)**
**Current Issues:**
- 207 lines, handles 15+ different key types
- Nested conditionals 4+ levels deep
- Multiple state updates per branch
- Repeated `setTimeout(() => flatListRef.current?.scrollToEnd())` pattern

**Refactoring Strategy:**
```typescript
// EXTRACT these into separate functions:
1. handleResetKey(key) - Lines 922-928
2. handleExpectingFreshInput(key) - Lines 930-994
3. handleDotKey() - Lines 1002-1016
4. handleClearKey() - Lines 1017-1025
5. handleBackspaceKey() - Lines 1026-1044
6. handleShiftBackspace() - Lines 1046-1056
7. handleCheckIcon(key) - Lines 1058-1061
8. handleParenthesesKey() - Lines 1064-1073
9. handlePercentKey() - Lines 1073-1075
10. handleEqualsKey(key) - Lines 1075-1102
11. handleRegularKey(key) - Lines 1102-1118

// CREATE a key handler map:
const keyHandlers = {
  '↺': handleResetKey,
  '.': handleDotKey,
  'C': handleClearKey,
  '⌫': handleBackspaceKey,
  'SHIFT_BACKSPACE': handleShiftBackspace,
  'CHECK_ICON': handleCheckIcon,
  '()': handleParenthesesKey,
  '%': handlePercentKey,
  'ok': handleEqualsKey,
  '=': handleEqualsKey,
};

// EXTRACT scroll helper:
const scrollToBottom = (delay = 50) => {
  setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), delay);
};
```

**Target Complexity:** 8-10 (each extracted function: 3-5)

---

#### **2. Function: `renderHeaderControls` (L1443-1491, Complexity: 17)**
**Current Issues:**
- 48 lines of JSX
- Nested conditionals for tooltips
- Repeated tooltip pattern

**Refactoring Strategy:**
```typescript
// EXTRACT components:
1. <ResetButton 
     visible={bubbles.length > 0 && !showKeypad}
     onPress={handleReset}
     showTooltip={hoveredTooltip === 'reset'}
     onHover={toggleTooltip}
   />

2. <HistoryButton
     onPress={() => setShowHistoryModal(true)}
     showTooltip={hoveredTooltip === 'history'}
     onHover={toggleTooltip}
   />

// EXTRACT tooltip wrapper:
const TooltipButton = ({ 
  icon, onPress, tooltipKey, tooltipText, visible = true 
}) => (
  <View style={styles.tooltipContainer}>
    <Pressable
      onPress={onPress}
      onHoverIn={() => Platform.OS === 'web' && toggleTooltip(tooltipKey)}
      onHoverOut={() => Platform.OS === 'web' && toggleTooltip(null)}
    >
      {icon}
    </Pressable>
    {hoveredTooltip === tooltipKey && Platform.OS === 'web' && (
      <View style={styles.tooltip}>
        <Text style={styles.tooltipText}>{tooltipText}</Text>
      </View>
    )}
  </View>
);
```

**Target Complexity:** 5-7

---

#### **3. Function: Webhook Tooltip Rendering (L1715+, Complexity: 17)**
**Current Issues:**
- Complex nested conditionals for webhook display
- Inline map with complex styling logic

**Refactoring Strategy:**
```typescript
// EXTRACT components:
1. <WebhookList webhooks={activeWebhooks} />
2. <BulkDataQueue items={bulkData} />

// SIMPLIFY with early returns:
const WebhookTooltipContent = () => {
  const activeWebhooks = webhookManager.webhookUrls.filter(w => w.active);
  
  if (activeWebhooks.length === 0) {
    return <EmptyWebhookMessage />;
  }
  
  return (
    <>
      <WebhookList webhooks={activeWebhooks} />
      {!webhookManager.streamResults && <BulkDataQueue />}
    </>
  );
};
```

**Target Complexity:** 6-8

---

### **Priority 2: Medium Complexity (app/index.tsx)**

#### **4. Function: `saveSettings` useEffect (L1397-1426, Complexity: 16)**
**Current Issues:**
- Multiple if statements checking previous values
- Repeated AsyncStorage.setItem pattern

**Refactoring Strategy:**
```typescript
// EXTRACT helper:
const createSettingSaver = (key: string, prevKey: keyof typeof prev) => {
  return (value: any) => {
    if (prev[prevKey] !== value) {
      prev[prevKey] = value;
      return AsyncStorage.setItem(key, JSON.stringify(value));
    }
    return null;
  };
};

// SIMPLIFY:
const saveSettings = async () => {
  try {
    const ops = [
      createSettingSaver('openInCalcMode', 'openInCalcMode')(openInCalcMode),
      createSettingSaver('speechMuted', 'isSpeechMuted')(isSpeechMuted),
      createSettingSaver('historyEnabled', 'historyEnabled')(historyEnabled),
      createSettingSaver('continuousMode', 'continuousMode')(continuousMode),
    ].filter(Boolean);
    
    if (ops.length > 0) await Promise.all(ops);
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};
```

**Target Complexity:** 8-10

---

#### **5. Function: Backspace Handler (L1026-1044, Complexity: 16)**
**Already part of onKeypadPress refactoring above**

---

### **Priority 3: Settings Component**

#### **6. Function: Settings Component (L108-257, Complexity: 31)**
**Current Issues:**
- 149 lines in component body
- Multiple state variables (15+)
- Complex webhook validation logic
- Premium check logic mixed with UI

**Refactoring Strategy:**
```typescript
// EXTRACT custom hooks:
1. useWebhookManagement(webhookUrls, setWebhookUrls)
   - Returns: { localWebhooks, addWebhook, deleteWebhook, editWebhook }

2. usePremiumGate(checkPremiumStatus)
   - Returns: { requirePremium, showPremiumModal, setShowPremiumModal }

3. useAuthHandlers(signOut, signInWithGoogle)
   - Returns: { handleSignOut, handleGoogleLogin }

// EXTRACT validation utilities:
1. sanitizeInput(input: string): string
2. validateWebhookUrl(url: string): string | null

// EXTRACT sub-components:
1. <GeneralSettings />
2. <LanguageSettings />
3. <WebhookSettings />
4. <AuthSection />
```

**Target Complexity:** 12-15 (component), 5-8 (each hook/utility)

---

### **Priority 4: Other Components**

#### **7. BubbleListComponent renderItem (L60-139, Complexity: 21)**
**Refactoring Strategy:**
```typescript
// EXTRACT components:
1. <ResultBubble item={item} onCopy={copyToClipboard} />
2. <ErrorBubble item={item} />
3. <UserBubble item={item} isLast={isLastBubble} />

// EXTRACT helper:
const isNoEquationError = (content: string) => {
  const noEquationPhrases = [
    'No Equation Detected',
    'No se Detectó Ecuación',
    'Aucune Équation Détectée',
    // ... etc
  ];
  return noEquationPhrases.some(phrase => content.startsWith(phrase));
};
```

**Target Complexity:** 8-10

---

#### **8. KeypadComponent button rendering (L61-111, Complexity: 18)**
**Refactoring Strategy:**
```typescript
// EXTRACT function:
const getButtonStyle = (key: string, isWebMobile: boolean): ViewStyle => {
  if (Platform.OS === 'web') {
    if (isWebMobile) {
      if (key === 'CHECK_ICON') return styles.keypadKeyEnter;
      if (['+', '-', '×', '÷', '()', '%', '^'].includes(key)) {
        return styles.keypadKeyOperator;
      }
      return styles.keypadKeyMobile;
    }
    return styles.keypadKeyWeb;
  }
  
  // Native mobile
  if (key === 'CHECK_ICON') return styles.keypadKeyEnter;
  if (['+', '-', '×', '÷'].includes(key)) return styles.keypadKeyOperator;
  return styles.keypadKeyMobile;
};

// EXTRACT component:
const KeypadButton = ({ keyValue, onPress, style }) => (
  <TouchableOpacity style={style} onPress={() => onPress(keyValue)}>
    {getKeyIcon(keyValue)}
  </TouchableOpacity>
);
```

**Target Complexity:** 8-10

---


## 🚫 RULES FOR REFACTORING

### **DO:**
1. ✅ Extract functions with clear, single responsibilities
2. ✅ Use early returns to reduce nesting
3. ✅ Create helper functions for repeated patterns
4. ✅ Extract components for complex JSX blocks
5. ✅ Use custom hooks for complex state logic
6. ✅ Add error logging to all new functions
7. ✅ Keep existing functionality 100% intact
8. ✅ Test after each extraction

### **DON'T:**
1. ❌ Change any business logic
2. ❌ Modify state management patterns
3. ❌ Remove any error handling
4. ❌ Change function signatures used by other files
5. ❌ Refactor multiple functions at once
6. ❌ Skip testing between changes
7. ❌ Touch webhook functionality (already verified working)
8. ❌ Modify any imports or dependencies

---

## 📊 ESTIMATED IMPACT

**Before:** 15 functions with complexity 16-31  
**After:** 40+ functions with complexity 3-10  
**Lines reduced:** ~500 lines through extraction  
**Maintainability:** Significantly improved  
**Risk:** Low (if done incrementally)

---

## ⚡ RECOMMENDED ORDER

1. **Start:** `onKeypadPress` (biggest impact, most complex)
2. **Then:** `renderHeaderControls` (quick win)
3. **Then:** Settings component (high value)
4. **Then:** BubbleListComponent (medium complexity)
5. **Last:** KeypadComponent (low complexity)

**Time estimate:** 4-6 hours total if done carefully
