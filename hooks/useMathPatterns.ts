import { useCallback, useMemo } from 'react';
import { LANGUAGE_PATTERNS, type LanguagePatterns } from '../constants/Languages';
import type { CompiledLanguageRegex } from '../utils/mathNormalization';

export function useMathPatterns(language: string): CompiledLanguageRegex {
  // Get language-specific math patterns
  const getMathPatterns = useCallback((lang: string): LanguagePatterns => {
    return LANGUAGE_PATTERNS[lang] ?? LANGUAGE_PATTERNS.en;
  }, []); // Dependencies: none

  // Helper functions for regex compilation
  const createPhraseRegex = useCallback((phrase: string | undefined) => {
    return phrase ? new RegExp(phrase, 'g') : null;
  }, []);

  const compileOperationRegexes = useCallback(
    (operations: any, joinEscaped: (arr: string[]) => string) => {
      return {
        addition: operations.addition.length
          ? new RegExp(`\\b(${joinEscaped(operations.addition)})\\b`, 'g')
          : null,
        subtraction: operations.subtraction.length
          ? new RegExp(`\\b(${joinEscaped(operations.subtraction)})\\b`, 'g')
          : null,
        multiplication: operations.multiplication.length
          ? new RegExp(`\\b(${joinEscaped(operations.multiplication)})\\b`, 'g')
          : null,
        division: operations.division.length
          ? new RegExp(`\\b(${joinEscaped(operations.division)})\\b`, 'g')
          : null,
        percentOf: operations.percentOf.length
          ? new RegExp(`\\b(${joinEscaped(operations.percentOf)})\\b`, 'g')
          : null,
        percentage: operations.percentage.length
          ? new RegExp(`\\b(${joinEscaped(operations.percentage)})\\b`, 'g')
          : null,
        power: operations.power.length
          ? new RegExp(`\\b(${joinEscaped(operations.power)})\\b`, 'g')
          : null,
        sqrt: operations.sqrt.length
          ? new RegExp(`\\b(${joinEscaped(operations.sqrt)})\\b`, 'g')
          : null,
        openParen: operations.parentheses.open.length
          ? new RegExp(`\\b(${joinEscaped(operations.parentheses.open)})\\b`, 'g')
          : null,
        closeParen: operations.parentheses.close.length
          ? new RegExp(`\\b(${joinEscaped(operations.parentheses.close)})\\b`, 'g')
          : null,
        decimal: operations.decimal.length
          ? new RegExp(`\\b(${joinEscaped(operations.decimal)})\\b`, 'g')
          : null,
      };
    },
    []
  );

  // Precompile regex per language to avoid rebuilding on every normalization
  const compiledLanguageRegex = useMemo(() => {
    const p = getMathPatterns(language);
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const joinEscaped = (arr: string[]) => arr.map(escapeRegex).join('|');

    const numberWordsKeys = Object.keys(p.numbers).join('|');
    const numberWordsRegex = numberWordsKeys ? new RegExp(`\\b(${numberWordsKeys})\\b`, 'g') : null;

    const phraseRegexes = {
      phraseAddTo: createPhraseRegex(p.specificPhrases.addTo),
      phraseSubtractFrom: createPhraseRegex(p.specificPhrases.subtractFrom),
      phraseMultiplyBy: createPhraseRegex(p.specificPhrases.multiplyBy),
      phraseDivideBy: createPhraseRegex(p.specificPhrases.divideBy),
    };

    const operationRegexes = compileOperationRegexes(p.operations, joinEscaped);

    return {
      patterns: p,
      numberWordsRegex,
      ...phraseRegexes,
      ...operationRegexes,
    } as const;
  }, [language, getMathPatterns, createPhraseRegex, compileOperationRegexes]);

  return compiledLanguageRegex;
}
