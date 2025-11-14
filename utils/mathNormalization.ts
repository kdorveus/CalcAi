import type { LanguagePatterns } from '../constants/Languages';

// Type for compiled language regex structure
export interface CompiledLanguageRegex {
  patterns: LanguagePatterns;
  numberWordsRegex: RegExp | null;
  phraseAddTo: RegExp | null;
  phraseSubtractFrom: RegExp | null;
  phraseMultiplyBy: RegExp | null;
  phraseDivideBy: RegExp | null;
  addition: RegExp | null;
  subtraction: RegExp | null;
  multiplication: RegExp | null;
  division: RegExp | null;
  percentOf: RegExp | null;
  percentage: RegExp | null;
  power: RegExp | null;
  sqrt: RegExp | null;
  openParen: RegExp | null;
  closeParen: RegExp | null;
  decimal: RegExp | null;
}

// Helper: Convert compound numbers (e.g., "5million" -> "5000000")
export function convertCompoundNumbers(text: string): string {
  const compoundRegex =
    /(\d+)\s*(million|milliard|milliarde|milhão|milione|billion|mil millones|billón|bilhão|miliardo|trillion|trilhão|trillione)/g;
  return text.replaceAll(compoundRegex, (_match, number, multiplier) => {
    const num = Number.parseInt(number, 10);
    const multiplierLower = multiplier.toLowerCase();

    if (['million', 'milliard', 'milliarde', 'milhão', 'milione'].includes(multiplierLower)) {
      return (num * 1000000).toString();
    }
    if (['billion', 'mil millones', 'bilhão', 'miliardo'].includes(multiplierLower)) {
      return (num * 1000000000).toString();
    }
    if (['trillion', 'billón', 'trilhão', 'trillione'].includes(multiplierLower)) {
      return (num * 1000000000000).toString();
    }
    return num.toString();
  });
}

// Helper: Get fraction denominator map
export function getFractionMap(): { [key: string]: number } {
  return {
    half: 2,
    halves: 2,
    halfs: 2,
    third: 3,
    thirds: 3,
    thir: 3,
    thirdith: 3,
    thirdth: 3,
    fourth: 4,
    fourths: 4,
    quarter: 4,
    quarters: 4,
    forth: 4,
    forths: 4,
    fifth: 5,
    fifths: 5,
    fith: 5,
    fiths: 5,
    sixth: 6,
    sixths: 6,
    sikth: 6,
    sikths: 6,
    seventh: 7,
    sevenths: 7,
    sevnth: 7,
    sevnths: 7,
    eighth: 8,
    eighths: 8,
    aith: 8,
    aiths: 8,
    eith: 8,
    eiths: 8,
    ninth: 9,
    ninths: 9,
    nith: 9,
    niths: 9,
    tenth: 10,
    tenths: 10,
    tinth: 10,
    tinths: 10,
    demi: 2,
    demis: 2,
    tiers: 3,
    quart: 4,
    quarts: 4,
    cinquième: 5,
    cinquièmes: 5,
    sixième: 6,
    sixièmes: 6,
    septième: 7,
    septièmes: 7,
    huitième: 8,
    huitièmes: 8,
    medio: 2,
    medios: 2,
    meio: 2,
    meios: 2,
    mezzo: 2,
    mezzi: 2,
    tercio: 3,
    tercios: 3,
    terço: 3,
    terços: 3,
    terzo: 3,
    terzi: 3,
    cuarto: 4,
    cuartos: 4,
    quarto: 4,
    quartos: 4,
    quarti: 4,
    quinto: 5,
    quintos: 5,
    quinti: 5,
    sexto: 6,
    sextos: 6,
    sesto: 6,
    sesti: 6,
  };
}

// Helper: Clean number string for percentage calculations
export function cleanNumberString(str: string): string {
  return String(str)
    .replace(/[ \u00A0\u202F]/g, '')
    .replaceAll(',', '.');
}

// Helper: Normalize decimal separators and spaces
export function normalizeDecimalsAndSpaces(text: string, compiled: CompiledLanguageRegex): string {
  let result = text;
  result = result.replace(/[\u00A0\u202F\u2007]/g, ' ');
  if (compiled.decimal) result = result.replace(compiled.decimal, '.');
  result = result.replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');
  result = result.replace(/\b(\d{1,3})(?:,\d{3})+\b/g, (m) => m.replaceAll(',', ''));
  result = result.replace(/\b(\d+),(\d+)\b/g, '$1.$2');
  return result;
}

// Helper: Apply number word conversions and compound numbers
export function applyNumberConversions(text: string, compiled: CompiledLanguageRegex): string {
  let result = convertCompoundNumbers(text);
  const numWords = compiled.patterns.numbers;
  if (compiled.numberWordsRegex) {
    result = result.replace(compiled.numberWordsRegex, (match: string) => numWords[match]);
  }
  result = result.replace(/\b(\d{1,3})(?:[ \u00A0\u202F]\d{3})+\b/g, (m) =>
    m.replace(/[ \u00A0\u202F]/g, '')
  );
  return result;
}

// Helper: Apply percentage operations
export function applyPercentageOperations(text: string): string {
  const numberPattern = String.raw`\d+(?:[ \u00A0\u202F]{0,10}[.,][ \u00A0\u202F]{0,10}\d+)?`;
  const wsPattern = String.raw`[\s\u00A0\u202F]{1,20}`;
  const ofWords = '(?:of|de|di|von)';
  const toWords = '(?:to|à|a|zu)';
  const addWords = '(?:add|ajouter|adicionar|hinzufügen|aggiungere)';
  const subtractWords = '(?:subtract|soustraire|subtrair|subtrahieren|sottrarre)';
  const fromWords = '(?:from|de|von|da)';

  let result = text;

  // "X% of Y" pattern
  result = result.replaceAll(
    new RegExp(
      `(${numberPattern})\\s*%${wsPattern}${ofWords}${wsPattern}(${numberPattern})(?:${wsPattern}%)?`,
      'gi'
    ),
    (_m, p1, p2) => `(${cleanNumberString(p2)} * ${cleanNumberString(p1)} / 100)`
  );

  // "add X% to Y" pattern
  result = result.replaceAll(
    new RegExp(
      `${addWords}${wsPattern}(${numberPattern})\\s*%${wsPattern}${toWords}${wsPattern}(${numberPattern})`,
      'gi'
    ),
    (_m, p1, p2) => `(${cleanNumberString(p2)} * (1 + ${cleanNumberString(p1)} / 100))`
  );

  // "X + Y%" pattern
  result = result.replaceAll(
    new RegExp(`(${numberPattern})\\s*\\+\\s*(${numberPattern})\\s*%`, 'gi'),
    (_m, base, pct) => `(${cleanNumberString(base)} * (1 + ${cleanNumberString(pct)} / 100))`
  );

  // "subtract X% from Y" pattern
  result = result.replaceAll(
    new RegExp(
      `${subtractWords}${wsPattern}(${numberPattern})\\s*%${wsPattern}${fromWords}${wsPattern}(${numberPattern})`,
      'gi'
    ),
    (_m, p1, p2) => `(${cleanNumberString(p2)} * (1 - ${cleanNumberString(p1)} / 100))`
  );

  // "X - Y%" pattern
  result = result.replaceAll(
    new RegExp(`(${numberPattern})\\s*-\\s*(${numberPattern})\\s*%`, 'gi'),
    (_m, base, pct) => `(${cleanNumberString(base)} * (1 - ${cleanNumberString(pct)} / 100))`
  );

  return result;
}

// Normalize spoken math expressions
export function normalizeSpokenMath(text: string, compiled: CompiledLanguageRegex): string {
  if (text.length > 1000) {
    return text.substring(0, 1000).toLowerCase();
  }
  let normalized = text.toLowerCase();

  normalized = normalized.replace(
    /([a-zàáâãäåèéêëìíîïòóôõöùúûüýÿ])-([a-zàáâãäåèéêëìíîïòóôõöùúûüýÿ])/gi,
    '$1$2'
  );

  normalized = applyNumberConversions(normalized, compiled);

  // Handle numeric fractions: "1/200 of 2562" → "(1/200) * 2562"
  normalized = normalized.replace(
    /(\d+)\s?\/\s?(\d+)\s+(?:of|de|di|von)\s+(\d+(?:\.\d+)?)/gi,
    '(($1/$2) * $3)'
  );

  // Handle word fractions: "3 fourths of 100" → "(3/4) * 100"
  const fractionMap = getFractionMap();
  normalized = normalized.replace(
    /(\d+)\s+([a-zàáâãäåèéêëìíîïòóôõöùúûüýÿ]{2,20})\s+(?:of|de|di|von)\s+(\d+(?:\.\d+)?)/gi,
    (match, numerator, fractionWord, number) => {
      const denominator = fractionMap[fractionWord.toLowerCase()];
      return denominator ? `((${numerator}/${denominator}) * ${number})` : match;
    }
  );

  normalized = normalizeDecimalsAndSpaces(normalized, compiled);
  normalized = applyPercentageOperations(normalized);

  // Handle language-specific phrase patterns
  if (compiled.phraseAddTo) normalized = normalized.replace(compiled.phraseAddTo, '$1 + $2');
  if (compiled.phraseSubtractFrom)
    normalized = normalized.replace(compiled.phraseSubtractFrom, '$2 - $1');
  if (compiled.phraseMultiplyBy)
    normalized = normalized.replace(compiled.phraseMultiplyBy, '$2 * $3');
  if (compiled.phraseDivideBy) normalized = normalized.replace(compiled.phraseDivideBy, '$2 / $3');

  // Common operator words to symbols
  if (compiled.addition) normalized = normalized.replace(compiled.addition, ' + ');
  if (compiled.subtraction) normalized = normalized.replace(compiled.subtraction, ' - ');
  if (compiled.multiplication) normalized = normalized.replace(compiled.multiplication, ' * ');
  if (compiled.division) normalized = normalized.replace(compiled.division, ' / ');
  if (compiled.percentOf && !/%/.test(normalized))
    normalized = normalized.replace(compiled.percentOf, ' * 0.01 * ');
  if (compiled.percentage) normalized = normalized.replace(compiled.percentage, ' % ');
  if (compiled.power) normalized = normalized.replace(compiled.power, ' ^ ');
  if (compiled.sqrt) normalized = normalized.replace(compiled.sqrt, ' sqrt ');
  if (compiled.openParen) normalized = normalized.replace(compiled.openParen, ' ( ');
  if (compiled.closeParen) normalized = normalized.replace(compiled.closeParen, ' ) ');

  // Final cleanup
  normalized = normalized.replace(/\bsqrt\b/g, '__SQRT__');
  normalized = normalized.replace(/[''"`]+/g, ' ');
  normalized = normalized.replace(/[a-zA-ZÀ-ÿ]+/g, ' ');
  normalized = normalized.replaceAll('__SQRT__', ' sqrt ');
  normalized = normalized.replace(/\+\s*\+/g, '+');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}
