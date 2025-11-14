import { evaluate } from 'mathjs/number';
import type { CompiledLanguageRegex } from './mathNormalization';
import { normalizeSpokenMath } from './mathNormalization';

export const MATH_ERROR = 'MATH_ERROR_INTERNAL';

export interface CalculateExpressionParams {
  val: string;
  type: 'user' | 'keypad' | 'speech';
  compiledLanguageRegex: CompiledLanguageRegex;
  formatNumber: (num: number, lang: string) => string;
  language: string;
}

// Handle input and calculation (used by keypad and speech)
export function calculateExpression({
  val,
  type,
  compiledLanguageRegex,
  formatNumber,
  language,
}: CalculateExpressionParams): string {
  if (!val.trim()) return MATH_ERROR;

  let expression = val;
  if (type === 'speech') {
    expression = normalizeSpokenMath(val, compiledLanguageRegex);
  }

  // Convert comma decimal separators to periods for both speech and keypad input
  // This handles French locale where comma is used as decimal separator
  // Only convert commas that are decimal separators (not thousands separators)
  // Pattern: digit(s) followed by comma followed by digit(s) - this is a decimal
  expression = expression.replace(/(\d+),(\d+)/g, '$1.$2');

  // Replace visual operators with standard ones for mathjs
  expression = expression.replaceAll('×', '*').replaceAll('÷', '/');

  // Trim the expression
  expression = expression.trim();

  // For speech input, check if it's just a number BEFORE removing trailing operators
  // This way "plus 2" (which becomes "+2") is detected as having an operator
  if (type === 'speech') {
    // Check if it's just a number (integer or decimal) without any operators
    // This regex checks for numbers that don't have +, -, *, /, ^, %, (, ) anywhere
    if (/^\d+(\.\d+)?$/.test(expression)) {
      return MATH_ERROR;
    }
  }

  // Check if equation ends with an operator (incomplete equation)
  const endsWithOperator = /[+\-*/^]$/.test(expression);

  // Check if equation starts with an operator (uses previous result)
  const startsWithOperator = /^[+\-*/^]/.test(expression);

  // If it ends with an operator but doesn't start with one, it's incomplete
  if (endsWithOperator && !startsWithOperator) {
    return MATH_ERROR;
  }

  // Handle percentage correctly - needs number before it
  expression = expression.replace(/(\d+)%/g, '($1 / 100)');
  // Allow trailing % interpreted as /100
  expression = expression.replaceAll('%', '/100');

  const allowedChars = /^[\d+\-*/.()^\seqrt]+$/;
  if (!allowedChars.test(expression)) {
    return MATH_ERROR;
  }

  try {
    // Use math.evaluate for robust calculation
    const evaluatedResult = evaluate(expression);
    // Format the result according to user's locale
    if (typeof evaluatedResult === 'number') {
      return formatNumber(evaluatedResult, language);
    } else {
      return evaluatedResult.toString();
    }
  } catch (error) {
    console.error('Calculation Error:', error);
    return MATH_ERROR;
  }
}
