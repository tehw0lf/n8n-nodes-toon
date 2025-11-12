/**
 * TOON Decoder - Parses TOON format to JSON
 * Implements TOON Specification v2.0
 */

import type { DecoderOptions, Delimiter, HeaderInfo, ParsedLine } from './types';
import { ToonDecodingError } from './types';
import * as utils from './ToonUtils';

export class ToonDecoder {
	private options: DecoderOptions;

	constructor(options: DecoderOptions) {
		this.options = options;
	}

	/**
	 * Decode TOON text to JavaScript value
	 */
	decode(toonText: string): unknown {
		// Parse into lines with metadata
		const lines = this.parseLines(toonText);

		// Filter out empty lines
		const nonEmptyLines = lines.filter((line) => !line.isEmpty);

		if (nonEmptyLines.length === 0) {
			return null;
		}

		// Determine root form per §5
		const rootForm = this.determineRootForm(nonEmptyLines);

		let result: unknown;

		if (rootForm === 'array') {
			result = this.parseArray(nonEmptyLines, 0);
		} else if (rootForm === 'primitive') {
			// Single primitive value
			const token = nonEmptyLines[0].content.trim();
			result = this.parseTokenValue(token);
		} else {
			// Object
			result = this.parseObject(nonEmptyLines, 0, 0);
		}

		// Apply path expansion if enabled
		if (this.options.expandPaths === 'safe' && utils.isPlainObject(result)) {
			result = this.expandPaths(result as Record<string, unknown>);
		}

		return result;
	}

	/**
	 * Parse text into lines with metadata
	 */
	private parseLines(text: string): ParsedLine[] {
		const rawLines = text.split('\n');
		const parsed: ParsedLine[] = [];

		for (let i = 0; i < rawLines.length; i++) {
			const line = rawLines[i];

			// Check for tabs in indentation (strict mode error per §14)
			if (this.options.strict && /^\t/.test(line)) {
				throw new ToonDecodingError('Tabs not allowed in indentation', {
					lineNumber: i + 1,
					line,
				});
			}

			// Count leading spaces
			const match = line.match(/^( *)/);
			const indent = match ? match[1].length : 0;

			// Validate indentation is multiple of indent size in strict mode
			if (this.options.strict && indent > 0 && indent % this.options.indent !== 0) {
				throw new ToonDecodingError(
					`Indentation must be multiple of ${this.options.indent}, got ${indent} spaces`,
					{
						lineNumber: i + 1,
						line,
					},
				);
			}

			parsed.push({
				content: line,
				indent,
				lineNumber: i + 1,
				isEmpty: line.trim() === '',
			});
		}

		return parsed;
	}

	/**
	 * Determine root form per §5
	 */
	private determineRootForm(lines: ParsedLine[]): 'array' | 'primitive' | 'object' {
		const firstLine = lines[0].content.trim();

		// Check for array header pattern per §6
		// Only treat as array if it starts with [ (no key before it)
		if (/^\[\d+[\t|]?\]/.test(firstLine)) {
			return 'array';
		}

		// Check if single line and no colon (primitive)
		if (lines.length === 1 && !firstLine.includes(':')) {
			return 'primitive';
		}

		// Default to object
		return 'object';
	}

	/**
	 * Parse array header per §6
	 */
	private parseArrayHeader(line: ParsedLine): HeaderInfo {
		const content = line.content.trim();

		// Match pattern: optional_key [length delimiter_symbol] optional_{fields} : optional_values
		const match = content.match(/^(.*?)\[(\d+)([\t|])?\](?:\{([^}]+)\})?:(.*)$/);

		if (!match) {
			throw new ToonDecodingError('Invalid array header format', {
				lineNumber: line.lineNumber,
				line: content,
			});
		}

		const [, keyPart, lengthStr, delimSym, fieldsPart] = match;

		// Parse key
		let key: string | null = keyPart.trim();
		if (key) {
			// Unquote if quoted
			if (key.startsWith('"') && key.endsWith('"')) {
				key = utils.unescapeString(key.slice(1, -1));
			}
		} else {
			key = null;
		}

		// Parse length
		const length = parseInt(lengthStr, 10);
		if (isNaN(length) || length < 0) {
			throw new ToonDecodingError(`Invalid array length: ${lengthStr}`, {
				lineNumber: line.lineNumber,
			});
		}

		// Determine delimiter per §11
		let delimiter: Delimiter = ',';
		if (delimSym === '\t') {
			delimiter = '\t';
		} else if (delimSym === '|') {
			delimiter = '|';
		}

		// Parse fields if present
		let fields: string[] | null = null;
		if (fieldsPart) {
			fields = this.parseDelimitedTokens(fieldsPart, delimiter).map((token) => {
				// Unquote if quoted
				if (token.startsWith('"') && token.endsWith('"')) {
					return utils.unescapeString(token.slice(1, -1));
				}
				return token;
			});
		}

		return {
			key,
			length,
			delimiter,
			fields,
			rawLine: content,
			lineNumber: line.lineNumber,
		};
	}

	/**
	 * Parse delimited tokens (respects quotes)
	 */
	private parseDelimitedTokens(text: string, delimiter: Delimiter): string[] {
		const tokens: string[] = [];
		let current = '';
		let inQuotes = false;
		let escaped = false;

		for (let i = 0; i < text.length; i++) {
			const char = text[i];

			if (escaped) {
				current += char;
				escaped = false;
				continue;
			}

			if (char === '\\') {
				current += char;
				escaped = true;
				continue;
			}

			if (char === '"' && !escaped) {
				inQuotes = !inQuotes;
				current += char;
				continue;
			}

			// Check for delimiter
			if (!inQuotes) {
				if (delimiter === ',' && text.slice(i, i + 2) === ', ') {
					tokens.push(current.trim());
					current = '';
					i++; // Skip the space after comma
					continue;
				} else if (char === delimiter) {
					tokens.push(current.trim());
					current = '';
					continue;
				}
			}

			current += char;
		}

		// Add final token
		if (current.trim()) {
			tokens.push(current.trim());
		}

		return tokens;
	}

	/**
	 * Parse an array
	 */
	private parseArray(lines: ParsedLine[], startIndex: number): unknown[] {
		const headerLine = lines[startIndex];
		const header = this.parseArrayHeader(headerLine);

		// Check if values are inline (same line as header)
		const inlineMatch = header.rawLine.match(/:\s*(.+)$/);
		if (inlineMatch && inlineMatch[1].trim()) {
			// Inline array
			const valuesStr = inlineMatch[1].trim();
			const tokens = this.parseDelimitedTokens(valuesStr, header.delimiter);
			const values = tokens.map((token) => this.parseTokenValue(token));

			// Validate count in strict mode
			if (this.options.strict && values.length !== header.length) {
				throw new ToonDecodingError(
					`Array length mismatch: expected ${header.length}, got ${values.length}`,
					{
						lineNumber: header.lineNumber,
					},
				);
			}

			return values;
		}

		// Expanded array: parse subsequent lines
		const baseIndent = headerLine.indent;
		const valueIndent = baseIndent + this.options.indent;

		// Check if tabular (has fields)
		if (header.fields) {
			return this.parseTabularArray(lines, startIndex, header);
		}

		// Parse array elements
		const values: unknown[] = [];
		let currentIndex = startIndex + 1;
		let currentObj: Record<string, unknown> | null = null;
		const seenKeys = new Set<string>();

		while (currentIndex < lines.length) {
			const line = lines[currentIndex];

			// Skip empty lines
			if (line.isEmpty) {
				if (this.options.strict) {
					throw new ToonDecodingError('Blank lines not allowed in arrays in strict mode', {
						lineNumber: line.lineNumber,
					});
				}
				currentIndex++;
				continue;
			}

			// Check if we've exited the array
			if (line.indent <= baseIndent) {
				// Save any pending object
				if (currentObj !== null) {
					values.push(currentObj);
					currentObj = null;
				}
				break;
			}

			// Check proper indentation
			if (line.indent < valueIndent) {
				throw new ToonDecodingError(
					`Invalid indentation: expected ${valueIndent}, got ${line.indent}`,
					{
						lineNumber: line.lineNumber,
					},
				);
			}

			// Parse element
			const content = line.content.trim();

			// Check if it's a nested array
			if (/^\[\d+[\t|]?\]/.test(content)) {
				// Save any pending object first
				if (currentObj !== null) {
					values.push(currentObj);
					currentObj = null;
					seenKeys.clear();
				}
				const nestedArray = this.parseArray(lines, currentIndex);
				values.push(nestedArray);
				// Check if it was inline (only one line) or expanded
				const arrayHeader = this.parseArrayHeader(lines[currentIndex]);
				const inlineMatch = arrayHeader.rawLine.match(/:\s*(.+)$/);
				if (inlineMatch && inlineMatch[1].trim()) {
					// Inline array, just move to next line
					currentIndex++;
				} else {
					// Expanded array, skip to next sibling
					currentIndex = this.findNextSiblingIndex(lines, currentIndex, valueIndent);
				}
			}
			// Check if it's an object
			else if (content.includes(':')) {
				// Could be object or key-value
				const colonIndex = this.findUnquotedColon(content);
				if (colonIndex > 0) {
					const valuePart = content.slice(colonIndex + 1).trim();
					const keyPart = content.slice(0, colonIndex).trim();

					// Parse key
					let key: string;
					if (keyPart.startsWith('"') && keyPart.endsWith('"')) {
						key = utils.unescapeString(keyPart.slice(1, -1));
					} else {
						key = keyPart;
					}

					if (!valuePart) {
						// Multi-line object (value on next lines)
						// Save any pending object first
						if (currentObj !== null) {
							values.push(currentObj);
							currentObj = null;
							seenKeys.clear();
						}
						const obj = this.parseObject(lines, currentIndex, valueIndent);
						values.push(obj);
						currentIndex = this.findNextSiblingIndex(lines, currentIndex, valueIndent);
					} else {
						// Single-line key-value - accumulate into object
						// If we see a duplicate key, start a new object
						if (seenKeys.has(key)) {
							if (currentObj !== null) {
								values.push(currentObj);
							}
							currentObj = {};
							seenKeys.clear();
						}

						if (currentObj === null) {
							currentObj = {};
						}

						currentObj[key] = this.parseTokenValue(valuePart);
						seenKeys.add(key);
						currentIndex++;
					}
				} else {
					// Primitive value
					// Save any pending object first
					if (currentObj !== null) {
						values.push(currentObj);
						currentObj = null;
						seenKeys.clear();
					}
					values.push(this.parseTokenValue(content));
					currentIndex++;
				}
			} else {
				// Primitive value
				// Save any pending object first
				if (currentObj !== null) {
					values.push(currentObj);
					currentObj = null;
					seenKeys.clear();
				}
				values.push(this.parseTokenValue(content));
				currentIndex++;
			}
		}

		// Save any final pending object
		if (currentObj !== null) {
			values.push(currentObj);
		}

		// Validate count in strict mode
		if (this.options.strict && values.length !== header.length) {
			throw new ToonDecodingError(
				`Array length mismatch: expected ${header.length}, got ${values.length}`,
				{
					lineNumber: header.lineNumber,
				},
			);
		}

		return values;
	}

	/**
	 * Parse a tabular array (with fields)
	 */
	private parseTabularArray(
		lines: ParsedLine[],
		startIndex: number,
		header: HeaderInfo,
	): Record<string, unknown>[] {
		const rows: Record<string, unknown>[] = [];
		let currentIndex = startIndex + 1;
		const baseIndent = lines[startIndex].indent;

		while (currentIndex < lines.length && rows.length < header.length) {
			const line = lines[currentIndex];

			// Skip empty lines
			if (line.isEmpty) {
				if (this.options.strict) {
					throw new ToonDecodingError('Blank lines not allowed in arrays in strict mode', {
						lineNumber: line.lineNumber,
					});
				}
				currentIndex++;
				continue;
			}

			// Check if we've exited the array
			if (line.indent <= baseIndent) {
				break;
			}

			// Parse row
			const content = line.content.trim();
			const tokens = this.parseDelimitedTokens(content, header.delimiter);

			// Validate field count in strict mode
			if (this.options.strict && tokens.length !== header.fields!.length) {
				throw new ToonDecodingError(
					`Row field count mismatch: expected ${header.fields!.length}, got ${tokens.length}`,
					{
						lineNumber: line.lineNumber,
					},
				);
			}

			// Create object from fields and values
			const row: Record<string, unknown> = {};
			for (let i = 0; i < header.fields!.length; i++) {
				const field = header.fields![i];
				const value = i < tokens.length ? this.parseTokenValue(tokens[i]) : null;
				row[field] = value;
			}

			rows.push(row);
			currentIndex++;
		}

		return rows;
	}

	/**
	 * Parse an object
	 */
	private parseObject(
		lines: ParsedLine[],
		startIndex: number,
		expectedIndent: number,
	): Record<string, unknown> {
		const obj: Record<string, unknown> = {};
		let currentIndex = startIndex;

		while (currentIndex < lines.length) {
			const line = lines[currentIndex];

			// Skip empty lines
			if (line.isEmpty) {
				currentIndex++;
				continue;
			}

			// Check if we've exited this object
			if (currentIndex > startIndex && line.indent < expectedIndent) {
				break;
			}

			// Parse key-value pair
			const content = line.content.trim();

			// Check for array
			if (/\[\d+[\t|]?\]/.test(content)) {
				const headerMatch = content.match(/^(.*?)\[/);
				if (headerMatch && headerMatch[1].trim()) {
					// Named array
					const header = this.parseArrayHeader(line);
					const array = this.parseArray(lines, currentIndex);
					if (header.key) {
						obj[header.key] = array;
					}
					currentIndex = this.findNextSiblingIndex(lines, currentIndex, expectedIndent);
				} else {
					// Anonymous array (shouldn't happen in object context)
					currentIndex++;
				}
				continue;
			}

			// Parse key-value
			const colonIndex = this.findUnquotedColon(content);
			if (colonIndex < 0) {
				// No colon, skip or error
				currentIndex++;
				continue;
			}

			const keyPart = content.slice(0, colonIndex).trim();
			const valuePart = content.slice(colonIndex + 1).trim();

			// Parse key
			let key: string;
			if (keyPart.startsWith('"') && keyPart.endsWith('"')) {
				key = utils.unescapeString(keyPart.slice(1, -1));
			} else {
				key = keyPart;
			}

			// Parse value
			if (!valuePart) {
				// Nested object or array on next lines
				const nextLine = currentIndex + 1 < lines.length ? lines[currentIndex + 1] : null;
				if (nextLine && !nextLine.isEmpty && nextLine.indent > line.indent) {
					// Check if next line is array
					if (/\[\d+[\t|]?\]/.test(nextLine.content.trim())) {
						const array = this.parseArray(lines, currentIndex + 1);
						obj[key] = array;
						currentIndex = this.findNextSiblingIndex(lines, currentIndex + 1, line.indent);
					} else {
						// Nested object
						const nestedObj = this.parseObject(lines, currentIndex + 1, line.indent + this.options.indent);
						obj[key] = nestedObj;
						currentIndex = this.findNextSiblingIndex(lines, currentIndex + 1, line.indent);
					}
				} else {
					// Empty value = null
					obj[key] = null;
					currentIndex++;
				}
			} else {
				// Value on same line
				obj[key] = this.parseTokenValue(valuePart);
				currentIndex++;
			}
		}

		return obj;
	}

	/**
	 * Find index of unquoted colon
	 */
	private findUnquotedColon(text: string): number {
		let inQuotes = false;
		let escaped = false;

		for (let i = 0; i < text.length; i++) {
			const char = text[i];

			if (escaped) {
				escaped = false;
				continue;
			}

			if (char === '\\') {
				escaped = true;
				continue;
			}

			if (char === '"') {
				inQuotes = !inQuotes;
				continue;
			}

			if (char === ':' && !inQuotes) {
				return i;
			}
		}

		return -1;
	}

	/**
	 * Find next sibling line index at the same indentation level
	 */
	private findNextSiblingIndex(lines: ParsedLine[], currentIndex: number, expectedIndent: number): number {
		let index = currentIndex + 1;

		while (index < lines.length) {
			const line = lines[index];

			if (line.isEmpty) {
				index++;
				continue;
			}

			// Return when we find a line at or below the expected indent (sibling or parent level)
			if (line.indent <= expectedIndent) {
				return index;
			}

			index++;
		}

		return lines.length;
	}

	/**
	 * Parse a token value per §4
	 */
	private parseTokenValue(token: string): unknown {
		token = token.trim();

		// Handle quoted strings
		if (token.startsWith('"') && token.endsWith('"')) {
			return utils.unescapeString(token.slice(1, -1));
		}

		// Use utils.parseToken for type inference
		return utils.parseToken(token);
	}

	/**
	 * Expand dotted paths into nested objects per §13.4 (optional)
	 */
	private expandPaths(obj: Record<string, unknown>): Record<string, unknown> {
		const result: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(obj)) {
			if (key.includes('.') && this.isExpandable(key)) {
				const segments = key.split('.');
				this.deepSet(result, segments, value);
			} else {
				// Recursively expand nested objects
				if (utils.isPlainObject(value)) {
					result[key] = this.expandPaths(value as Record<string, unknown>);
				} else {
					result[key] = value;
				}
			}
		}

		return result;
	}

	/**
	 * Check if a key is expandable (all segments are identifiers)
	 */
	private isExpandable(key: string): boolean {
		const segments = key.split('.');
		return segments.every((seg) => utils.isIdentifierSegment(seg));
	}

	/**
	 * Deep set a value in an object by path
	 */
	private deepSet(obj: Record<string, unknown>, path: string[], value: unknown): void {
		let current: Record<string, unknown> = obj;

		for (let i = 0; i < path.length - 1; i++) {
			const segment = path[i];

			if (!(segment in current)) {
				current[segment] = {};
			} else if (!utils.isPlainObject(current[segment])) {
				// Conflict: need object but found non-object
				if (this.options.strict) {
					throw new ToonDecodingError(
						`Path expansion conflict at '${path.slice(0, i + 1).join('.')}': expected object, found ${typeof current[segment]}`,
					);
				}
				// LWW: overwrite
				current[segment] = {};
			}

			current = current[segment] as Record<string, unknown>;
		}

		const lastSegment = path[path.length - 1];

		if (lastSegment in current && this.options.strict) {
			throw new ToonDecodingError(
				`Path expansion conflict: duplicate key '${path.join('.')}'`,
			);
		}

		current[lastSegment] = value;
	}
}
