import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

// --- Define Interface for Styles ---
export interface ComponentStyles {
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
  textLogoContainer: ViewStyle;
  textLogo: TextStyle;
  betaText: TextStyle;
}

// --- StyleSheet ---
export const styles = StyleSheet.create<ComponentStyles>({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  headerControls: {
    position: 'absolute',
    top: 10,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
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
    height: 60, // Explicit slim height
    overflow: 'visible', // Allow mic button to overflow
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
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          outlineColor: 'transparent',
        } as any)
      : {}),
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
    backgroundColor: '#121212',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    alignSelf: 'flex-start',
  },
  errorText: {
    fontSize: 20,
    color: '#999',
  },
  fixedRightDeleteButton: {
    paddingLeft: 35, // Increased from 15 to 35 (added 20px margin)
    paddingRight: 5,
    paddingVertical: 10,
    marginBottom: 8,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    width: '100%',
  },
  textLogoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  textLogo: {
    fontSize: 72,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: -3,
    lineHeight: 72,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }),
  },
  betaText: {
    position: 'relative',
    top: -45,
    marginLeft: 4,
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
