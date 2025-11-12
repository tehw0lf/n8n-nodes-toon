/**
 * TOON Utilities - Core helper functions for encoding and decoding
 * Implements TOON Specification v2.0
 */

import type { Delimiter } from './types';

/**
 * Escape string according to TOON spec §7.1
 * Only escape: backslash, quote, newline, carriage return, tab
 */
export function escapeString(str: string): string {
	return str
		.replace(/\\/g, '\\\\') // Backslash must be first
		.replace(/"/g, '\\"')
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r')
		.replace(/\t/g, '\\t');
}

/**
 * Unescape string and validate escape sequences per §7.1
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
					break;
				case '"':
					result += '"';
					break;
				case 'n':
					result += '\n';
					break;
				case 'r':
					result += '\r';
					break;
				case 't':
					result += '\t';
					break;
				default:
					throw new Error(
						`Invalid escape sequence: \\${nextChar} at position ${i}. Only \\\\, \\", \\n, \\r, \\t are allowed`,
					);
			}
			i += 2;
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

	// Contains whitespace characters
	if (/[\n\r\t]/.test(value)) {
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
 * - No exponent notation
 * - No trailing zeros after decimal
 * - -0 becomes 0
 * - No leading zeros
 */
export function canonicalizeNumber(num: number): string {
	// Handle non-finite numbers
	if (!isFinite(num)) {
		return 'null';
	}

	// Handle negative zero
	if (Object.is(num, -0)) {
		return '0';
	}

	// Convert to string without exponent if possible
	let str: string;

	// Check if number is in exponential notation
	const basicStr = num.toString();
	if (basicStr.includes('e') || basicStr.includes('E')) {
		// Manually expand exponential notation
		str = expandExponentialNotation(num);
	} else {
		str = basicStr;
	}

	// Remove trailing zeros after decimal point
	if (str.includes('.')) {
		str = str.replace(/\.?0+$/, '');
	}

	// Remove leading zeros (but keep single 0)
	if (str !== '0' && !str.startsWith('0.')) {
		str = str.replace(/^(-?)0+(\d)/, '$1$2');
	}

	return str;
}

/**
 * Expand exponential notation to fixed-point notation
 */
function expandExponentialNotation(num: number): string {
	// For very large or very small numbers, use toPrecision
	const absNum = Math.abs(num);

	if (absNum >= 1e21 || (absNum < 1e-6 && absNum > 0)) {
		// For these ranges, use toFixed with appropriate precision
		const str = num.toExponential();
		const match = str.match(/^(-?\d\.?\d*)e([+-]\d+)$/);

		if (match) {
			const [, mantissa, exponent] = match;
			const exp = parseInt(exponent, 10);
			const mantissaNum = parseFloat(mantissa);

			if (exp >= 0) {
				// Positive exponent: move decimal right
				const shifted = mantissaNum * Math.pow(10, exp);
				return shifted.toString().replace(/\.?0+$/, '');
			} else {
				// Negative exponent: move decimal left
				const precision = Math.abs(exp) + 10;
				return mantissaNum.toFixed(precision).replace(/\.?0+$/, '');
			}
		}
	}

	// For normal range, use toFixed with enough precision
	if (Number.isInteger(num)) {
		return num.toString();
	}

	// Calculate needed decimal places
	const str = num.toString();
	if (!str.includes('e') && !str.includes('E')) {
		return str;
	}

	// Use toFixed with maximum precision
	return num.toFixed(20).replace(/\.?0+$/, '');
}

/**
 * Check if a string token looks like a number
 */
export function isNumericToken(token: string): boolean {
	return /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(token) && token !== '' && token !== '-';
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
