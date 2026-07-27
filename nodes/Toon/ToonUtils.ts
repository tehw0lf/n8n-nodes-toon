/**
 * TOON Utilities - Core helper functions for encoding and decoding
 * Implements TOON Specification v4.1
 */

import type { Delimiter, FieldEntry } from './types';

/**
 * Reject host strings carrying an unpaired surrogate per §3.
 *
 * Such a string is not representable in TOON, and encoders MUST error rather
 * than emit it or silently substitute U+FFFD.
 */
/**
 * Whether a host string is representable in TOON, i.e. carries no unpaired
 * surrogate (§3)
 */
export function isRepresentableString(str: string): boolean {
  try {
    assertNoLoneSurrogate(str);
    return true;
  } catch {
    return false;
  }
}

export function assertNoLoneSurrogate(str: string): void {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);

    // High surrogate: must be followed by a low surrogate
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (next < 0xdc00 || next > 0xdfff) {
        throw new Error(
          `Unpaired surrogate at position ${i}: string is not representable in TOON`,
        );
      }
      i++;
      continue;
    }

    // A low surrogate not preceded by a high surrogate is unpaired
    if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(
        `Unpaired surrogate at position ${i}: string is not representable in TOON`,
      );
    }
  }
}

/**
 * Escape string according to TOON spec §7.1
 * - U+0000–U+001F: \uXXXX (except \n, \r, \t which use named escapes)
 * - backslash → \\, quote → \", LF → \n, CR → \r, HTAB → \t
 */
export function escapeString(str: string): string {
  assertNoLoneSurrogate(str);

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
          // \uXXXX — must be exactly 4 hex digits; needs 6 chars from i (\, u, 4 hex)
          if (i + 6 > str.length) {
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
 * Unescape a quoted token without throwing, reporting invalid escapes as a
 * message so callers can attach line context (§7.1).
 */
export function tryUnescapeString(str: string): { value: string | null; error: string | null } {
  try {
    return { value: unescapeString(str), error: null };
  } catch (error) {
    return { value: null, error: (error as Error).message };
  }
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

  // Leading or trailing whitespace (U+0020 or U+0009 per §7.2)
  if (/^[ \t]|[ \t]$/.test(value)) {
    return true;
  }

  // Reserved literals
  if (value === 'true' || value === 'false' || value === 'null') {
    return true;
  }

  // Numeric-like per §7.2: /^[+-]?[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?$/i
  // This covers "42", "-3.14", "05", "+1", "1e-6"
  if (/^[+-]?[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?$/i.test(value)) {
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

  // Equals "-" or starts with "-" (any hyphen at position 0) per §7.2
  if (value.startsWith('-')) {
    return true;
  }

  // Equals "#" or starts with "#" per §7.2, keeping comment syntax (§5.1) unambiguous
  if (value.startsWith('#')) {
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
  // Per §4: negative zero decodes to zero
  return Object.is(num, -0) ? 0 : num;
}

/**
 * Split delimited text on unquoted occurrences of the active delimiter (§11.2, App. B.3).
 *
 * Empty tokens are preserved and surrounding spaces (U+0020 only, §12) are
 * trimmed. Content inside double quotes is never split; a backslash inside
 * quotes escapes the next character so that `\"` does not close the string.
 */
export function splitDelimited(text: string, delimiter: Delimiter): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes && char === '\\' && i + 1 < text.length) {
      // Keep escape pairs intact; the string parser validates them later
      current += char + text[i + 1];
      i += 2;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      i++;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      tokens.push(trimSpaces(current));
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  tokens.push(trimSpaces(current));
  return tokens;
}

/**
 * Trim surrounding spaces (exactly U+0020, no other whitespace) per §12
 */
export function trimSpaces(text: string): string {
  return text.replace(/^ +/, '').replace(/ +$/, '');
}

/**
 * Find the index of the first unquoted occurrence of a character.
 * Returns -1 when absent. Used for header/row disambiguation (§5.2, §9.3).
 */
export function findUnquoted(text: string, target: string): number {
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes && char === '\\' && i + 1 < text.length) {
      i += 2;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes && char === target) {
      return i;
    }

    i++;
  }

  return -1;
}

/**
 * Parse a header field list body (the text between the outer braces) per §6.
 *
 * Field entries are split on the active delimiter at every nesting level; a
 * name followed by `{` opens a nested field group. Braces inside quoted names
 * are ignored for matching purposes.
 *
 * @throws when braces are unmatched or a field entry is empty
 */
export function parseFieldList(body: string, delimiter: Delimiter): FieldEntry[] {
  const entries = splitFieldEntries(body, delimiter);

  // A field list MUST contain at least one field entry at every level (§6)
  if (entries.length === 0 || (entries.length === 1 && entries[0] === '')) {
    throw new Error('Empty field list in header');
  }

  return entries.map((entry) => {
    const bracePos = findUnquotedBrace(entry);

    if (bracePos < 0) {
      return { name: decodeFieldName(entry), children: null };
    }

    if (!entry.endsWith('}')) {
      throw new Error(`Unmatched braces in field list: ${entry}`);
    }

    const name = decodeFieldName(entry.slice(0, bracePos));
    const nested = entry.slice(bracePos + 1, -1);
    return { name, children: parseFieldList(nested, delimiter) };
  });
}

/**
 * Decode a field name token, unescaping it when quoted (§6, §7.1)
 */
function decodeFieldName(token: string): string {
  const trimmed = trimSpaces(token);

  if (trimmed === '') {
    throw new Error('Empty field name in header');
  }

  if (trimmed.startsWith('"')) {
    if (!trimmed.endsWith('"') || trimmed.length < 2) {
      throw new Error(`Unterminated quoted field name: ${trimmed}`);
    }
    return unescapeString(trimmed.slice(1, -1));
  }

  return trimmed;
}

/**
 * Find the first unquoted "{" in a field entry, or -1 when absent
 */
function findUnquotedBrace(text: string): number {
  return findUnquoted(text, '{');
}

/**
 * Split a field list body into top-level entries, tracking brace depth and
 * ignoring delimiters and braces inside quoted names (§6)
 */
function splitFieldEntries(body: string, delimiter: Delimiter): string[] {
  const entries: string[] = [];
  let current = '';
  let inQuotes = false;
  let braceDepth = 0;
  let i = 0;

  while (i < body.length) {
    const char = body[i];

    if (inQuotes && char === '\\' && i + 1 < body.length) {
      current += char + body[i + 1];
      i += 2;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      i++;
      continue;
    }

    if (!inQuotes) {
      if (char === '{') {
        braceDepth++;
      } else if (char === '}') {
        braceDepth--;
        if (braceDepth < 0) {
          throw new Error('Unmatched closing brace in field list');
        }
      } else if (char === delimiter && braceDepth === 0) {
        entries.push(trimSpaces(current));
        current = '';
        i++;
        continue;
      }
    }

    current += char;
    i++;
  }

  if (braceDepth !== 0) {
    throw new Error('Unmatched opening brace in field list');
  }

  entries.push(trimSpaces(current));
  return entries;
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
 * Result of attempting to parse a line as a header per §6
 */
export interface ParsedHeader {
  key: string | null;
  length: number;
  delimiter: Delimiter;
  fields: FieldEntry[] | null;
  keyed: boolean;
  /** Content after the header colon, with surrounding spaces trimmed */
  inline: string;
}

/**
 * Outcome of a non-throwing header parse attempt.
 *
 * `header` is null when the line is not a header at all; `error` carries the
 * diagnostic when the line is header-shaped but malformed (§14.2), which
 * strict decoders surface and non-strict decoders may ignore.
 */
export interface HeaderParseOutcome {
  header: ParsedHeader | null;
  error: string | null;
}

/**
 * Parse a header without throwing, reporting malformation as a message (§6).
 */
export function tryParseHeader(content: string): HeaderParseOutcome {
  try {
    return { header: parseHeader(content), error: null };
  } catch (error) {
    return { header: null, error: (error as Error).message };
  }
}

/**
 * Parse a line's content as an array or keyed header per §6.
 *
 * Returns null when the line is not a header at all (so callers may fall
 * through to key-value classification, §5.2). Throws when the line is
 * recognisably header-shaped but malformed — a header syntax error under
 * §14.2, which strict callers surface and non-strict callers may downgrade.
 */
export function parseHeader(content: string): ParsedHeader | null {
  // A line whose first unquoted colon precedes its first unquoted "[" is
  // never a header; it is a key-value line (§5.2).
  const firstColon = findUnquoted(content, ':');
  const firstBracket = findUnquoted(content, '[');

  if (firstBracket < 0 || (firstColon >= 0 && firstColon < firstBracket)) {
    return null;
  }

  const keyPart = content.slice(0, firstBracket);
  const rest = content.slice(firstBracket);

  const closing = rest.indexOf(']');
  if (closing < 0) {
    return null;
  }

  const segment = rest.slice(1, closing);

  // Whitespace MUST NOT appear between a key and its bracket segment (§6)
  if (/\s/.test(keyPart)) {
    throw new Error(`Whitespace between key and bracket segment: ${content}`);
  }

  const parsedSegment = parseBracketSegment(segment);
  if (parsedSegment === null) {
    return null;
  }

  const { length, delimiter, keyed } = parsedSegment;

  // Parse the key, unescaping when quoted (§7.3, §7.4)
  let key: string | null = null;
  if (keyPart !== '') {
    if (keyPart.startsWith('"')) {
      if (!keyPart.endsWith('"') || keyPart.length < 2) {
        throw new Error(`Unterminated quoted key in header: ${content}`);
      }
      key = unescapeString(keyPart.slice(1, -1));
    } else {
      key = keyPart;
    }
  }

  // Parse the optional field list between "]" and ":"
  let after = rest.slice(closing + 1);
  let fields: FieldEntry[] | null = null;

  if (after.startsWith('{')) {
    const closeBrace = findMatchingBrace(after);
    if (closeBrace < 0) {
      throw new Error(`Unmatched brace in header field list: ${content}`);
    }
    fields = parseFieldList(after.slice(1, closeBrace), delimiter);
    after = after.slice(closeBrace + 1);
  }

  // Content MUST NOT appear between "]"/"}" and the colon (§6)
  if (!after.startsWith(':')) {
    throw new Error(`Missing or misplaced colon in header: ${content}`);
  }

  // A keyed header MUST carry a field list (§6, §9.5)
  if (keyed && fields === null) {
    throw new Error(`Keyed header requires a field list: ${content}`);
  }

  // A field name repeated within the same field list is a header defect (§14.2)
  if (fields !== null) {
    const duplicate = findDuplicateFieldName(fields);
    if (duplicate !== null) {
      throw new Error(`Duplicate field name in header field list: ${duplicate}`);
    }
  }

  return {
    key,
    length,
    delimiter,
    fields,
    keyed,
    inline: trimSpaces(after.slice(1)),
  };
}

/**
 * Parse the interior of a bracket segment per §6.
 *
 * Returns null when the text is not a bracket segment at all; throws when it
 * is malformed in a way §6 calls out explicitly (leading zeros, misplaced
 * keyed colon, missing length).
 */
function parseBracketSegment(
  segment: string,
): { length: number; delimiter: Delimiter; keyed: boolean } | null {
  // `[N]`, `[N<delim>]`, `[N:]`, `[N:<delim>]`
  const match = segment.match(/^(\d+)(:)?([\t|])?$/);

  if (!match) {
    // A bracket segment with a digit-led but malformed body is a header error;
    // anything else (e.g. `[bar]`) is simply not a bracket segment.
    if (/^\d/.test(segment) || segment === '') {
      throw new Error(`Malformed bracket segment: [${segment}]`);
    }
    return null;
  }

  const [, digits, keyedMarker, delimSym] = match;

  // Length MUST have no leading zeros; "0" is the only form for zero (§6)
  if (digits.length > 1 && digits.startsWith('0')) {
    throw new Error(`Leading zeros are not allowed in bracket length: [${segment}]`);
  }

  const delimiter: Delimiter = delimSym === '\t' ? '\t' : delimSym === '|' ? '|' : ',';

  return {
    length: parseInt(digits, 10),
    delimiter,
    keyed: keyedMarker === ':',
  };
}

/**
 * Find the index of the brace matching the "{" at position 0, ignoring
 * braces inside quoted names (§6). Returns -1 when unmatched.
 */
function findMatchingBrace(text: string): number {
  let depth = 0;
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes && char === '\\' && i + 1 < text.length) {
      i += 2;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }

    i++;
  }

  return -1;
}

/**
 * Check if value is a plain object (not array, not null)
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Assign a decoded key as an ordinary own data property per §15.
 *
 * No key has special meaning in TOON, so `__proto__` and friends MUST become
 * own entries rather than mutating the prototype chain. Plain assignment would
 * invoke the `__proto__` setter, so define the property explicitly.
 */
export function setDecodedKey(
  obj: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  Object.defineProperty(obj, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
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
 * Check if a value is a JSON primitive (string, number, boolean, or null) per §1.6
 */
export function isPrimitive(value: unknown): boolean {
  const type = typeof value;
  return (
    value === null ||
    value === undefined ||
    type === 'string' ||
    type === 'number' ||
    type === 'boolean'
  );
}

/**
 * Check that a set of objects all share the same key set (order MAY vary) per §9.3
 */
function haveSameKeySet(objects: Record<string, unknown>[]): boolean {
  const firstKeys = Object.keys(objects[0]);
  const reference = new Set(firstKeys);

  for (let i = 1; i < objects.length; i++) {
    const keys = Object.keys(objects[i]);
    if (keys.length !== firstKeys.length) {
      return false;
    }
    for (const key of keys) {
      if (!reference.has(key)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Build the field tree for a uniform column set per §9.3.
 *
 * A column is *uniform-primitive* when every value is a primitive, and
 * *nested-uniform* when every value is a non-empty object sharing one key set
 * whose sub-columns are themselves uniform-primitive or nested-uniform.
 * Nesting depth is unbounded.
 *
 * Field order follows the first object's key encounter order, recursively.
 *
 * @returns the field entries, or null when the objects are not uniform
 */
export function buildFieldTree(objects: Record<string, unknown>[]): FieldEntry[] | null {
  if (objects.length === 0) {
    return null;
  }

  // Every object must be non-empty and share the same key set
  if (objects.some((obj) => Object.keys(obj).length === 0)) {
    return null;
  }
  if (!haveSameKeySet(objects)) {
    return null;
  }

  const fields: FieldEntry[] = [];

  // Field order is the first object's key encounter order (§9.3)
  for (const name of Object.keys(objects[0])) {
    const column = objects.map((obj) => obj[name]);

    if (column.every((value) => isPrimitive(value))) {
      fields.push({ name, children: null });
      continue;
    }

    // A nested-uniform column requires every value to be a non-empty object
    if (!column.every((value) => isPlainObject(value))) {
      return null;
    }

    const children = buildFieldTree(column as Record<string, unknown>[]);
    if (children === null) {
      return null;
    }

    fields.push({ name, children });
  }

  return fields;
}

/**
 * Determine whether an array qualifies for tabular form per §9.3.
 * Returns the header's field tree, or null when list form must be used.
 */
export function getTabularFields(arr: unknown[]): FieldEntry[] | null {
  if (arr.length === 0) {
    return null;
  }
  if (!arr.every((item) => isPlainObject(item))) {
    return null;
  }
  return buildFieldTree(arr as Record<string, unknown>[]);
}

/**
 * Determine whether an object qualifies for keyed tabular form per §9.5.
 * Requires at least two entries whose values are uniform non-empty objects.
 * Returns the header's field tree, or null when the object encodes per §8.
 */
export function getKeyedTabularFields(obj: Record<string, unknown>): FieldEntry[] | null {
  const values = Object.values(obj);

  // Encoders never emit keyed headers for fewer than two entries (§9.5)
  if (values.length < 2) {
    return null;
  }
  if (!values.every((value) => isPlainObject(value))) {
    return null;
  }

  return buildFieldTree(values as Record<string, unknown>[]);
}

/**
 * Flatten a field tree into its leaf fields in depth-first, pre-order (§9.3).
 * Row and entry-row cells map one-to-one onto this sequence.
 */
export function leafFields(fields: FieldEntry[]): FieldEntry[] {
  const leaves: FieldEntry[] = [];

  for (const field of fields) {
    if (field.children === null) {
      leaves.push(field);
    } else {
      leaves.push(...leafFields(field.children));
    }
  }

  return leaves;
}

/**
 * Count the leaf fields of a field tree (§9.3, §14.1)
 */
export function countLeafFields(fields: FieldEntry[]): number {
  return leafFields(fields).length;
}

/**
 * Collect a row's cells from an object by walking the field tree depth-first (§9.3)
 */
export function collectLeafValues(
  obj: Record<string, unknown>,
  fields: FieldEntry[],
): unknown[] {
  const values: unknown[] = [];

  for (const field of fields) {
    const value = obj[field.name];
    if (field.children === null) {
      values.push(value);
    } else {
      values.push(...collectLeafValues(value as Record<string, unknown>, field.children));
    }
  }

  return values;
}

/**
 * Check for a field name repeated within the same field list (§14.2).
 * Names repeated at different nesting levels are not duplicates.
 */
export function findDuplicateFieldName(fields: FieldEntry[]): string | null {
  const seen = new Set<string>();

  for (const field of fields) {
    if (seen.has(field.name)) {
      return field.name;
    }
    seen.add(field.name);

    if (field.children !== null) {
      const nested = findDuplicateFieldName(field.children);
      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

/**
 * Render the delimiter symbol used inside a bracket segment per §6
 * (absent for comma, HTAB for tab, "|" for pipe)
 */
export function delimiterSymbol(delimiter: Delimiter): string {
  return delimiter === ',' ? '' : delimiter;
}

/**
 * Encode a key per §7.3, quoting and escaping when required
 */
export function encodeKey(key: string): string {
  if (keyNeedsQuoting(key)) {
    return `"${escapeString(key)}"`;
  }
  // Unquoted keys skip escapeString, so check representability here (§3)
  assertNoLoneSurrogate(key);
  return key;
}

/**
 * Serialize a field tree into a header field list per §6.
 * The delimiter separates entries at every nesting level.
 */
export function serializeFields(fields: FieldEntry[], delimiter: Delimiter): string {
  return fields
    .map((field) => {
      const name = encodeKey(field.name);
      return field.children === null
        ? name
        : `${name}{${serializeFields(field.children, delimiter)}}`;
    })
    .join(delimiter);
}
