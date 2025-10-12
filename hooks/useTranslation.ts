import { useLanguage } from '../contexts/LanguageContext';

/**
 * Custom hook for easy access to translation function
 * This is a convenience hook that provides direct access to the translation function
 * without needing to destructure it from the language context every time.
 */
export const useTranslation = () => {
  const { t, language, setLanguage, isLoading } = useLanguage();

  return {
    t,
    language,
    setLanguage,
    isLoading,
  };
};
