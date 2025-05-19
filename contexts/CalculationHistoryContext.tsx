import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  deleteCalculation: (expression: string, result: string, created_at: string) => Promise<void>;
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
export const CalculationHistoryProvider: React.FC<CalculationHistoryProviderProps> = ({ children }) => {
  const [history, setHistory] = useState<CalculationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load history from AsyncStorage on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Load history from AsyncStorage
  const loadHistory = async () => {
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
  };

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

  // Delete a calculation from history
  const deleteCalculation = async (expression: string, result: string, created_at: string) => {
    try {
      // Find the item to delete
      const itemToDelete = history.find(item => item.expression === expression && item.result === result && item.created_at === created_at);
      if (!itemToDelete) return;

      // Update local storage and state
      const updatedHistory = history.filter(item => !(item.expression === expression && item.result === result && item.created_at === created_at));
      setHistory(updatedHistory);
      await saveHistory(updatedHistory);
    } catch (error) {
      console.error('Error deleting calculation:', error);
    }
  };

  // Clear all calculations
  const clearAllCalculations = async () => {
    try {
      setHistory([]);
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing calculation history:', error);
    }
  };

  return (
    <CalculationHistoryContext.Provider
      value={{
        history,
        addCalculation,
        deleteCalculation,
        clearAllCalculations,
        loading,
      }}
    >
      {children}
    </CalculationHistoryContext.Provider>
  );
};

// Export the hook to use the calculation history context
export const useCalculationHistory = () => useContext(CalculationHistoryContext);
