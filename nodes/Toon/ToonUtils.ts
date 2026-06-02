/**
 * TOON Utilities - Core helper functions for encoding and decoding
 * Implements TOON Specification v3.3
 */

import type { Delimiter } from './types';

/**
 * Escape string according to TOON spec §7.1
 * - U+0000–U+001F: \uXXXX (except \n, \r, \t which use named escapes)
 * - backslash → \\, quote → \", LF → \n, CR → \r, HTAB → \t
 */
export function escapeString(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = str.charCodeAt(i);
    if (ch === '\\') {
      result += '\\\\';
    } else if (ch === '"') {
      result += '\\"';
    } else if (ch === '\n') {
      result += '\\n';
    } else if (ch === '\r') {
      result += '\\r';
    } else if (ch === '\t') {
      result += '\\t';
    } else if (code <= 0x1f) {
      // Other U+0000–U+001F controls MUST use \uXXXX per §7.1
      result += '\\u' + code.toString(16).padStart(4, '0');
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * Unescape string and validate escape sequences per §7.1
 * Accepts: \\, \", \n, \r, \t, \uXXXX (4 hex digits, no lone surrogates)
 */
export function unescapeString(str: string): string {
  let result = '';
  let i = 0;

  while (i < str.length) {
    if (str[i] === '\\') {
      if (i + 1 >= str.length) {
        throw new Error(`Invalid escape sequence: trailing backslash at position ${i}`);
      }

      const nextChar = str[i + 1];
      switch (nextChar) {
        case '\\':
          result += '\\';
          i += 2;
          break;
        case '"':
          result += '"';
          i += 2;
          break;
        case 'n':
          result += '\n';
          i += 2;
          break;
        case 'r':
          result += '\r';
          i += 2;
          break;
        case 't':
          result += '\t';
          i += 2;
          break;
        case 'u': {
          // \uXXXX — must be exactly 4 hex digits
          if (i + 5 >= str.length + 1) {
            throw new Error(`Invalid escape sequence: \\u requires 4 hex digits at position ${i}`);
          }
          const hexStr = str.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hexStr)) {
            throw new Error(`Invalid escape sequence: \\u${hexStr} at position ${i}. Must be 4 hex digits`);
          }
          const codePoint = parseInt(hexStr, 16);
          // Reject lone surrogates (U+D800–U+DFFF)
          if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
            throw new Error(`Invalid escape sequence: \\u${hexStr} is a lone surrogate`);
          }
          result += String.fromCharCode(codePoint);
          i += 6;
          break;
        }
        default:
          throw new Error(
            `Invalid escape sequence: \\${nextChar} at position ${i}`,
          );
      }
    } else {
      result += str[i];
      i++;
    }
  }

  return result;
}

/**
 * Convert delimiter option to actual character
 */
export function getDelimiterChar(option: 'comma' | 'tab' | 'pipe'): Delimiter {
  switch (option) {
    case 'comma':
      return ',';
    case 'tab':
      return '\t';
    case 'pipe':
      return '|';
    default:
      return ',';
  }
}

/**
 * Determine if a string value needs quoting per TOON spec §7.2
 * @param value The string to check
 * @param activeDelimiter The active delimiter in current context (for arrays)
 * @param documentDelimiter The document-level delimiter (for object values)
 * @param context Whether this is in array or object context
 */
export function needsQuoting(
  value: string,
  activeDelimiter: string,
  documentDelimiter: string,
  context: 'array' | 'object',
): boolean {
  // Empty string always needs quotes
  if (value === '') {
    return true;
  }

  // Leading or trailing whitespace
  if (/^[\s]|[\s]$/.test(value)) {
    return true;
  }

  // Reserved literals
  if (value === 'true' || value === 'false' || value === 'null') {
    return true;
  }

  // Looks like a number (including scientific notation)
  if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) {
    return true;
  }

  // Leading zeros (like "007")
  if (/^0\d+$/.test(value)) {
    return true;
  }

  // Contains structural characters
  if (/[:"\\[\]{}]/.test(value)) {
    return true;
  }

  // Contains control characters U+0000–U+001F per §7.2
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(value)) {
    return true;
  }

  // Hyphen-only or starts with hyphen followed by non-digit
  if (value === '-' || /^-[^\d]/.test(value)) {
    return true;
  }

  // Delimiter-aware quoting per §11
  // In array context: check active delimiter
  // In object context: check document delimiter
  const relevantDelimiter = context === 'array' ? activeDelimiter : documentDelimiter;
  if (value.includes(relevantDelimiter)) {
    return true;
  }

  return false;
}

/**
 * Canonicalize number per TOON spec §2
 * - 0 or 1e-6 ≤ |n| < 1e21: fixed decimal, no trailing zeros, no leading zeros
 * - |n| < 1e-6 or |n| ≥ 1e21: MAY use exponent notation (lowercase e, explicit sign per §2)
 * - -0 becomes 0
 */
export function canonicalizeNumber(num: number): string {
  if (!isFinite(num)) {
    return 'null';
  }

  if (Object.is(num, -0)) {
    return '0';
  }

  const absNum = Math.abs(num);

  // For numbers outside the canonical fixed-point range, use exponent notation per §2
  if (absNum !== 0 && (absNum < 1e-6 || absNum >= 1e21)) {
    // Produce lowercase e with explicit sign for byte-for-byte determinism
    const raw = num.toExponential();
    // Strip trailing zeros in mantissa, then normalize exponent sign
    return raw
      .replace(/(\.\d*?)0+(e)/, '$1$2')
      .replace(/\.(e)/, '$1')
      .replace(/e([+-]?\d+)$/, (_, e) => {
        const sign = e.startsWith('-') ? '-' : '+';
        const digits = e.replace(/^[+-]/, '').replace(/^0+(\d)/, '$1');
        return `e${sign}${digits}`;
      });
  }

  // Fixed decimal form for the canonical range
  const basicStr = num.toString();
  let str: string;
  if (basicStr.includes('e') || basicStr.includes('E')) {
    str = expandToFixedDecimal(num);
  } else {
    str = basicStr;
  }

  if (str.includes('.')) {
    str = str.replace(/\.?0+$/, '');
  }

  return str;
}

/**
 * Expand a number to fixed-point decimal string (for the canonical range 1e-6 ≤ |n| < 1e21)
 */
function expandToFixedDecimal(num: number): string {
  if (Number.isInteger(num)) {
    return num.toString();
  }
  return num.toFixed(20).replace(/\.?0+$/, '');
}

/**
 * Check if a string token looks like a number
 * Per §4: tokens with forbidden leading zeros in the integer part are strings.
 * Forbidden: "05", "0001", "-05", "-0001"
 * Allowed: "0.5", "0e1", "-0.5", "-0e1" (zero integer part with fractional/exponent)
 */
export function isNumericToken(token: string): boolean {
  if (!/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(token) || token === '' || token === '-') {
    return false;
  }
  // Reject forbidden leading zeros: integer part > 1 digit starting with 0
  // e.g. "05", "0001", "-05", "-0001" → string
  // but "0.5", "0e1", "-0.5", "-0e1" → valid number (zero integer part + fractional/exponent)
  if (/^-?0\d/.test(token) && !/^-?0[.eE]/.test(token)) {
    return false;
  }
  return true;
}

/**
 * Check if a string is a valid identifier segment for key folding per §13.4
 * Must match: ^[A-Za-z_][A-Za-z0-9_]*$
 */
export function isIdentifierSegment(segment: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(segment);
}

/**
 * Check if a string is a valid TOON key (allows dots for paths)
 * Must match: ^[A-Za-z_][A-Za-z0-9_.]*$
 */
export function isValidKey(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(key);
}

/**
 * Determine if a key needs quoting
 * Keys that match ^[A-Za-z_][A-Za-z0-9_.]* don't need quotes per §7.3
 */
export function keyNeedsQuoting(key: string): boolean {
  return !isValidKey(key);
}

/**
 * Create indentation string
 */
export function indent(level: number, size: number): string {
  return ' '.repeat(level * size);
}

/**
 * Parse a potential number token to JavaScript number
 */
export function parseNumber(token: string): number {
  const num = Number(token);
  if (isNaN(num)) {
    throw new Error(`Invalid number: ${token}`);
  }
  return num;
}

/**
 * Determine the type of a token and parse it per §4
 */
export function parseToken(token: string): unknown {
  // Boolean literals
  if (token === 'true') {
    return true;
  }
  if (token === 'false') {
    return false;
  }

  // Null literal
  if (token === 'null') {
    return null;
  }

  // Numeric
  if (isNumericToken(token)) {
    return parseNumber(token);
  }

  // Everything else is a string
  return token;
}

/**
 * Check if value is a plain object (not array, not null)
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a key is safe for property assignment (not __proto__, constructor, or prototype)
 * to prevent prototype pollution attacks
 */
export function isSafeKey(key: string): boolean {
  return key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
}

/**
 * Check if array contains only primitives (no objects or arrays)
 */
export function isArrayOfPrimitives(arr: unknown[]): boolean {
  return arr.every((item) => {
    const type = typeof item;
    return (
      item === null ||
      type === 'string' ||
      type === 'number' ||
      type === 'boolean' ||
      type === 'undefined'
    );
  });
}

/**
 * Check if array is uniform (all objects with identical keys) per §9.3
 */
export function isUniformArray(arr: unknown[]): arr is Record<string, unknown>[] {
  if (arr.length === 0) {
    return false;
  }

  // All elements must be plain objects
  if (!arr.every((item) => isPlainObject(item))) {
    return false;
  }

  const objects = arr as Record<string, unknown>[];

  // Get keys from first object
  const firstKeys = Object.keys(objects[0]).sort();

  if (firstKeys.length === 0) {
    return false;
  }

  // All objects must have exact same keys
  for (let i = 1; i < objects.length; i++) {
    const keys = Object.keys(objects[i]).sort();

    if (keys.length !== firstKeys.length) {
      return false;
    }

    for (let j = 0; j < keys.length; j++) {
      if (keys[j] !== firstKeys[j]) {
        return false;
      }
    }
  }

  // All values must be primitives
  for (const obj of objects) {
    for (const value of Object.values(obj)) {
      const type = typeof value;
      if (
        value !== null &&
        type !== 'string' &&
        type !== 'number' &&
        type !== 'boolean' &&
        type !== 'undefined'
      ) {
        return false;
      }
    }
  }

  return true;
}
