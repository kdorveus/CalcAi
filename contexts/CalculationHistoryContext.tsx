import AsyncStorage from '@react-native-async-storage/async-storage';
import type React from 'react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Define the shape of a calculation history item
export interface CalculationHistoryItem {
  expression: string;
  result: string;
  created_at: string;
}

// Define the shape of the context data
type CalculationHistoryContextType = {
  history: CalculationHistoryItem[];
  addCalculation: (expression: string, result: string) => Promise<void>;
  deleteCalculation: (created_at: string) => Promise<void>;
  clearAllCalculations: () => Promise<void>;
  loading: boolean;
};

// Create the context with a default value
const CalculationHistoryContext = createContext<CalculationHistoryContextType>({
  history: [],
  addCalculation: async () => {},
  deleteCalculation: async () => {},
  clearAllCalculations: async () => {},
  loading: false,
});

// Define props for the CalculationHistoryProvider
interface CalculationHistoryProviderProps {
  children: ReactNode;
}

// Storage key for AsyncStorage
const HISTORY_STORAGE_KEY = 'calculation_history';

// Create the CalculationHistoryProvider component
export const CalculationHistoryProvider: React.FC<CalculationHistoryProviderProps> = ({
  children,
}) => {
  const [history, setHistory] = useState<CalculationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load history from AsyncStorage
  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const storedHistory = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error('Error loading calculation history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load history from AsyncStorage on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Save history to AsyncStorage
  const saveHistory = async (newHistory: CalculationHistoryItem[]) => {
    try {
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving calculation history:', error);
    }
  };

  // Add a new calculation to history
  const addCalculation = async (expression: string, result: string) => {
    try {
      // Create a new history item
      const newItem: CalculationHistoryItem = {
        expression,
        result,
        created_at: new Date().toISOString(),
      };

      // Update state and storage
      const updatedHistory = [newItem, ...history];
      setHistory(updatedHistory);
      await saveHistory(updatedHistory);
    } catch (error) {
      console.error('Error adding calculation:', error);
    }
  };

  // Delete a calculation from history - KISS approach
  const deleteCalculation = async (created_at: string) => {
    try {
      const updatedHistory = history.filter((item) => item.created_at !== created_at);
      setHistory(updatedHistory);
      await saveHistory(updatedHistory);
    } catch (error) {
      console.error('Error deleting calculation:', error);
    }
  };

  // Clear all calculations - KISS approach
  const clearAllCalculations = async () => {
    try {
      setHistory([]);
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing calculation history:', error);
    }
  };

  const contextValue = useMemo(
    () => ({
      history,
      addCalculation,
      deleteCalculation,
      clearAllCalculations,
      loading,
    }),
    [history, addCalculation, deleteCalculation, clearAllCalculations, loading]
  );

  return (
    <CalculationHistoryContext.Provider value={contextValue}>
      {children}
    </CalculationHistoryContext.Provider>
  );
};

// Export the hook to use the calculation history context
export const useCalculationHistory = () => useContext(CalculationHistoryContext);
