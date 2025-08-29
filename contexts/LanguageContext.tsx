import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, TRANSLATIONS, Translations } from '../constants/Languages';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  t: (key: string) => string;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

const LANGUAGE_STORAGE_KEY = 'selectedLanguage';

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<string>(DEFAULT_LANGUAGE);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize language from storage or system locale
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (savedLanguage && SUPPORTED_LANGUAGES.some(lang => lang.code === savedLanguage)) {
          setLanguageState(savedLanguage);
        } else {
          const systemLanguage = getSystemLanguage();
          const supportedSystemLang = SUPPORTED_LANGUAGES.find(lang => lang.code === systemLanguage);
          if (supportedSystemLang) {
            setLanguageState(systemLanguage);
            await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, systemLanguage);
          }
        }
      } catch (error) {
        //
      } finally {
        setIsLoading(false);
      }
    };
    initializeLanguage();
  }, []);

  const getSystemLanguage = (): string => {
    try {
      if (Platform.OS === 'web') {
        const browserLang = navigator.language?.split('-')[0] || DEFAULT_LANGUAGE;
        return browserLang;
      } else {
        return DEFAULT_LANGUAGE;
      }
    } catch (error) {
      return DEFAULT_LANGUAGE;
    }
  };

  const setLanguage = async (lang: string) => {
    try {
      if (SUPPORTED_LANGUAGES.some(supportedLang => supportedLang.code === lang)) {
        setLanguageState(lang);
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      }
    } catch (error) {
      //
    }
  };

  // Translation function
  const t = (key: string): string => {
    try {
      const keys = key.split('.');
      let translation: string | string[] | Translations = TRANSLATIONS[language];
      
      if (!translation) {
        // Fallback to default language if current language not found
        translation = TRANSLATIONS[DEFAULT_LANGUAGE];
      }
      
      for (const k of keys) {
        if (typeof translation === 'object' && !Array.isArray(translation) && translation[k] !== undefined) {
          translation = translation[k];
        } else {
          // If key not found, try default language
          let fallbackTranslation: string | string[] | Translations = TRANSLATIONS[DEFAULT_LANGUAGE];
          for (const fallbackKey of keys) {
            if (typeof fallbackTranslation === 'object' && !Array.isArray(fallbackTranslation) && fallbackTranslation[fallbackKey] !== undefined) {
              fallbackTranslation = fallbackTranslation[fallbackKey];
            } else {
              // If still not found, return the key itself
              return key;
            }
          }
          return typeof fallbackTranslation === 'string' ? fallbackTranslation : key;
        }
      }
      
      return typeof translation === 'string' ? translation : key;
    } catch (error) {
      console.error('Translation error:', error);
      return key;
    }
  };

  const contextValue: LanguageContextType = {
    language,
    setLanguage,
    t,
    isLoading,
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};