import AsyncStorage from '@react-native-async-storage/async-storage';
import type React from 'react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  type Translations,
} from '../constants/Languages';

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
  const [language, setLanguageInternal] = useState<string>(DEFAULT_LANGUAGE);
  const [isLoading, setIsLoading] = useState(true);

  const getSystemLanguage = useCallback((): string => {
    try {
      if (Platform.OS === 'web') {
        const browserLang = navigator.language?.split('-')[0] || DEFAULT_LANGUAGE;
        return browserLang;
      } else {
        return DEFAULT_LANGUAGE;
      }
    } catch (error) {
      console.debug('Failed to get stored language:', error);
      return DEFAULT_LANGUAGE;
    }
  }, []);

  // Initialize language from storage or system locale
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (savedLanguage && SUPPORTED_LANGUAGES.some((lang) => lang.code === savedLanguage)) {
          setLanguageInternal(savedLanguage);
        } else {
          const systemLanguage = getSystemLanguage();
          const supportedSystemLang = SUPPORTED_LANGUAGES.find(
            (lang) => lang.code === systemLanguage
          );
          if (supportedSystemLang) {
            setLanguageInternal(systemLanguage);
            await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, systemLanguage);
          }
        }
      } catch (error) {
        console.debug('Failed to initialize language:', error);
      } finally {
        setIsLoading(false);
      }
    };
    initializeLanguage();
  }, [getSystemLanguage]);

  const setLanguage = useCallback(async (lang: string) => {
    try {
      if (SUPPORTED_LANGUAGES.some((supportedLang) => supportedLang.code === lang)) {
        setLanguageInternal(lang);
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      }
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  }, []);

  // Helper: Traverse translation object by keys
  const traverseTranslation = useCallback(
    (
      translationObj: string | string[] | Translations,
      keys: string[]
    ): string | string[] | Translations | null => {
      let current: string | string[] | Translations = translationObj;

      for (const k of keys) {
        if (typeof current === 'object' && !Array.isArray(current) && current[k] !== undefined) {
          current = current[k];
        } else {
          return null;
        }
      }

      return current;
    },
    []
  );

  // Helper: Get translation with fallback
  const getTranslationWithFallback = useCallback(
    (keys: string[]): string => {
      // Try current language
      const currentLangTranslations = TRANSLATIONS[language] || TRANSLATIONS[DEFAULT_LANGUAGE];
      const translation = traverseTranslation(currentLangTranslations, keys);

      if (translation !== null && typeof translation === 'string') {
        return translation;
      }

      // Try default language fallback
      const fallbackTranslation = traverseTranslation(TRANSLATIONS[DEFAULT_LANGUAGE], keys);

      if (fallbackTranslation !== null && typeof fallbackTranslation === 'string') {
        return fallbackTranslation;
      }

      return keys.join('.');
    },
    [language, traverseTranslation]
  );

  // Translation function
  const t = useCallback(
    (key: string): string => {
      try {
        const keys = key.split('.');
        return getTranslationWithFallback(keys);
      } catch (error) {
        console.error('Translation error:', error);
        return key;
      }
    },
    [getTranslationWithFallback]
  );

  const contextValue: LanguageContextType = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isLoading,
    }),
    [language, setLanguage, t, isLoading]
  );

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return a fallback context to prevent crashes during initialization
    console.warn('useLanguage used outside of LanguageProvider, using fallback');
    return {
      language: 'en',
      setLanguage: async () => {},
      t: (key: string) => key,
      isLoading: true,
    };
  }
  return context;
};
