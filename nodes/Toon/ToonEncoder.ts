/**
 * TOON Encoder - Converts JSON to TOON format
 * Implements TOON Specification v2.0
 */

import type { EncoderOptions, Delimiter } from './types';
import * as utils from './ToonUtils';

export class ToonEncoder {
	private options: EncoderOptions;
	private documentDelimiter: Delimiter;

	constructor(options: EncoderOptions) {
		this.options = options;
		this.documentDelimiter = options.delimiter;
	}

	/**
	 * Encode a value to TOON format
	 */
	encode(value: unknown): string {
		// Normalize value per §3
		const normalized = this.normalizeValue(value);

		// Apply key folding if enabled
		const folded =
			this.options.keyFolding === 'safe' && utils.isPlainObject(normalized)
				? this.foldKeys(normalized)
				: normalized;

		// Encode the value
		const lines = this.encodeValue(folded, 0);

		// Join lines without trailing newline per §12
		return lines.join('\n');
	}

	/**
	 * Normalize value per §3
	 * - undefined → null
	 * - function → null
	 * - symbol → null
	 * - NaN/Infinity → null
	 */
	private normalizeValue(value: unknown): unknown {
		if (value === undefined || value === null) {
			return null;
		}

		if (typeof value === 'function' || typeof value === 'symbol') {
			return null;
		}

		if (typeof value === 'number') {
			if (!isFinite(value)) {
				return null;
			}
			return value;
		}

		if (Array.isArray(value)) {
			return value.map((item) => this.normalizeValue(item));
		}

		if (utils.isPlainObject(value)) {
			const result: Record<string, unknown> = {};
			for (const [key, val] of Object.entries(value)) {
				result[key] = this.normalizeValue(val);
			}
			return result;
		}

		return value;
	}

	/**
	 * Encode a value at a given depth
	 */
	private encodeValue(value: unknown, depth: number, activeDelimiter?: Delimiter): string[] {
		if (value === null) {
			return ['null'];
		}

		if (typeof value === 'boolean') {
			return [value.toString()];
		}

		if (typeof value === 'number') {
			return [utils.canonicalizeNumber(value)];
		}

		if (typeof value === 'string') {
			return [this.encodeString(value, activeDelimiter || this.documentDelimiter, 'object')];
		}

		if (Array.isArray(value)) {
			return this.encodeArray(value, null, depth);
		}

		if (utils.isPlainObject(value)) {
			return this.encodeObject(value, depth);
		}

		// Fallback for unknown types
		return ['null'];
	}

	/**
	 * Encode a string value with proper quoting
	 */
	private encodeString(value: string, delimiter: Delimiter, context: 'array' | 'object'): string {
		if (utils.needsQuoting(value, delimiter, this.documentDelimiter, context)) {
			return `"${utils.escapeString(value)}"`;
		}
		return value;
	}

	/**
	 * Encode an object
	 */
	private encodeObject(obj: Record<string, unknown>, depth: number): string[] {
		const lines: string[] = [];
		const indentStr = utils.indent(depth, this.options.indent);

		for (const [key, value] of Object.entries(obj)) {
			// Encode key per §7.3
			const encodedKey = utils.keyNeedsQuoting(key)
				? `"${utils.escapeString(key)}"`
				: key;

			if (value === null) {
				lines.push(`${indentStr}${encodedKey}: null`);
			} else if (typeof value === 'boolean') {
				lines.push(`${indentStr}${encodedKey}: ${value.toString()}`);
			} else if (typeof value === 'number') {
				lines.push(`${indentStr}${encodedKey}: ${utils.canonicalizeNumber(value)}`);
			} else if (typeof value === 'string') {
				const encodedValue = this.encodeString(value, this.documentDelimiter, 'object');
				lines.push(`${indentStr}${encodedKey}: ${encodedValue}`);
			} else if (Array.isArray(value)) {
				// Array as object property
				const arrayLines = this.encodeArray(value, key, depth);
				lines.push(...arrayLines);
			} else if (utils.isPlainObject(value)) {
				// Nested object
				lines.push(`${indentStr}${encodedKey}:`);
				const nestedLines = this.encodeObject(value as Record<string, unknown>, depth + 1);
				lines.push(...nestedLines);
			} else {
				lines.push(`${indentStr}${encodedKey}: null`);
			}
		}

		return lines;
	}

	/**
	 * Encode an array with optional key
	 */
	private encodeArray(arr: unknown[], key: string | null, depth: number): string[] {
		// Determine if array should be encoded as tabular per §9.3
		if (utils.isUniformArray(arr)) {
			return this.encodeTabular(arr, key, depth);
		}

		// Check if array contains only primitives
		if (utils.isArrayOfPrimitives(arr)) {
			return this.encodePrimitiveArray(arr, key, depth);
		}

		// Mixed array: encode in expanded form
		return this.encodeMixedArray(arr, key, depth);
	}

	/**
	 * Encode an array of primitives (inline or expanded based on size)
	 */
	private encodePrimitiveArray(arr: unknown[], key: string | null, depth: number): string[] {
		const lines: string[] = [];
		const indentStr = utils.indent(depth, this.options.indent);
		const delimiter = this.options.delimiter;

		// Encode array header per §6
		const delimiterSym = delimiter === ',' ? '' : delimiter === '\t' ? '\t' : '|';
		const keyPart = key ? (utils.keyNeedsQuoting(key) ? `"${utils.escapeString(key)}"` : key) : '';
		const header = `${indentStr}${keyPart}[${arr.length}${delimiterSym}]:`;

		// Encode values
		const encodedValues = arr.map((item) =>
			this.encodePrimitiveValue(item, delimiter),
		);

		// Try inline first
		const inlineValues = encodedValues.join(delimiter === ',' ? ', ' : delimiter);
		const inlineLine = `${header} ${inlineValues}`;

		// Use inline if reasonable length (< 80 chars)
		if (inlineLine.length < 80 && !inlineValues.includes('\n')) {
			return [inlineLine];
		}

		// Use expanded form
		lines.push(header);
		const valueIndentStr = utils.indent(depth + 1, this.options.indent);
		for (const encoded of encodedValues) {
			lines.push(`${valueIndentStr}${encoded}`);
		}

		return lines;
	}

	/**
	 * Encode a primitive value for array context
	 */
	private encodePrimitiveValue(value: unknown, delimiter: Delimiter): string {
		if (value === null) {
			return 'null';
		}
		if (typeof value === 'boolean') {
			return value.toString();
		}
		if (typeof value === 'number') {
			return utils.canonicalizeNumber(value);
		}
		if (typeof value === 'string') {
			return this.encodeString(value, delimiter, 'array');
		}
		return 'null';
	}

	/**
	 * Encode a tabular array (uniform objects with primitive values)
	 */
	private encodeTabular(
		arr: Record<string, unknown>[],
		key: string | null,
		depth: number,
	): string[] {
		const lines: string[] = [];
		const delimiter = this.options.delimiter;
		const indentStr = utils.indent(depth, this.options.indent);

		// Get field names from first object
		const fields = Object.keys(arr[0]).sort();

		// Encode array header with fields per §6
		const delimiterSym = delimiter === ',' ? '' : delimiter === '\t' ? '\t' : '|';
		const keyPart = key ? (utils.keyNeedsQuoting(key) ? `"${utils.escapeString(key)}"` : key) : '';

		// Encode field names
		const encodedFields = fields.map((field) =>
			utils.keyNeedsQuoting(field) ? `"${utils.escapeString(field)}"` : field,
		);
		const fieldsStr = encodedFields.join(delimiter === ',' ? ', ' : delimiter);

		const header = `${indentStr}${keyPart}[${arr.length}${delimiterSym}]{${fieldsStr}}:`;
		lines.push(header);

		// Encode each row
		const valueIndentStr = utils.indent(depth + 1, this.options.indent);
		for (const obj of arr) {
			const values = fields.map((field) => this.encodePrimitiveValue(obj[field], delimiter));
			const rowStr = values.join(delimiter === ',' ? ', ' : delimiter);
			lines.push(`${valueIndentStr}${rowStr}`);
		}

		return lines;
	}

	/**
	 * Encode a mixed array (contains objects or nested arrays)
	 */
	private encodeMixedArray(arr: unknown[], key: string | null, depth: number): string[] {
		const lines: string[] = [];
		const indentStr = utils.indent(depth, this.options.indent);
		const delimiter = this.options.delimiter;

		// Encode array header
		const delimiterSym = delimiter === ',' ? '' : delimiter === '\t' ? '\t' : '|';
		const keyPart = key ? (utils.keyNeedsQuoting(key) ? `"${utils.escapeString(key)}"` : key) : '';
		const header = `${indentStr}${keyPart}[${arr.length}${delimiterSym}]:`;
		lines.push(header);

		// Encode each element
		for (const item of arr) {
			if (item === null || typeof item === 'boolean' || typeof item === 'number' || typeof item === 'string') {
				const valueIndentStr = utils.indent(depth + 1, this.options.indent);
				const encoded = this.encodePrimitiveValue(item, delimiter);
				lines.push(`${valueIndentStr}${encoded}`);
			} else if (Array.isArray(item)) {
				// Nested array
				const nestedLines = this.encodeArray(item, null, depth + 1);
				lines.push(...nestedLines);
			} else if (utils.isPlainObject(item)) {
				// Object element
				const objLines = this.encodeObject(item as Record<string, unknown>, depth + 1);
				lines.push(...objLines);
			} else {
				const valueIndentStr = utils.indent(depth + 1, this.options.indent);
				lines.push(`${valueIndentStr}null`);
			}
		}

		return lines;
	}

	/**
	 * Apply key folding per §13.4 (optional feature)
	 * Collapses single-key object chains into dotted paths
	 */
	private foldKeys(obj: Record<string, unknown>): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		const maxDepth = this.options.flattenDepth;

		for (const [key, value] of Object.entries(obj)) {
			const chain = this.extractFoldableChain(key, value, maxDepth);

			if (chain.length > 1 && this.isChainSafe(chain)) {
				// Fold the chain
				const foldedKey = chain.join('.');
				const leafValue = this.getLeafValue(value, chain.length - 1);
				result[foldedKey] = leafValue;
			} else {
				// Keep as-is, but recursively fold nested objects
				if (utils.isPlainObject(value)) {
					result[key] = this.foldKeys(value as Record<string, unknown>);
				} else {
					result[key] = value;
				}
			}
		}

		return result;
	}

	/**
	 * Extract a foldable chain from a key-value pair
	 */
	private extractFoldableChain(
		key: string,
		value: unknown,
		maxDepth: number,
	): string[] {
		const chain: string[] = [key];
		let current = value;
		let depth = 1;

		while (
			depth < maxDepth &&
			utils.isPlainObject(current)
		) {
			const keys = Object.keys(current);
			if (keys.length !== 1) {
				break;
			}

			const nextKey = keys[0];
			chain.push(nextKey);
			current = (current as Record<string, unknown>)[nextKey];
			depth++;
		}

		return chain;
	}

	/**
	 * Check if all segments in chain are safe identifiers
	 */
	private isChainSafe(chain: string[]): boolean {
		return chain.every((segment) => utils.isIdentifierSegment(segment));
	}

	/**
	 * Get the leaf value after following a chain
	 */
	private getLeafValue(value: unknown, depth: number): unknown {
		let current = value;
		for (let i = 0; i < depth; i++) {
			if (!utils.isPlainObject(current)) {
				return current;
			}
			const keys = Object.keys(current);
			if (keys.length !== 1) {
				return current;
			}
			current = (current as Record<string, unknown>)[keys[0]];
		}
		return current;
	}
}
