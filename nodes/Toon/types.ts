/**
 * TOON (Token-Oriented Object Notation) Type Definitions
 * Spec version: 2.0
 */

/**
 * Delimiter types for array encoding/decoding
 */
export type Delimiter = ',' | '\t' | '|';

/**
 * Delimiter option names for n8n UI
 */
export type DelimiterOption = 'comma' | 'tab' | 'pipe';

/**
 * Key folding mode for encoding
 */
export type KeyFoldingMode = 'off' | 'safe';

/**
 * Path expansion mode for decoding
 */
export type PathExpansionMode = 'off' | 'safe';

/**
 * Encoder configuration options
 */
export interface EncoderOptions {
	/** Number of spaces per indentation level (default: 2) */
	indent: number;
	/** Delimiter for array values */
	delimiter: Delimiter;
	/** Key folding strategy (collapse single-key chains) */
	keyFolding: KeyFoldingMode;
	/** Maximum depth for key folding (default: Infinity) */
	flattenDepth: number;
}

/**
 * Decoder configuration options
 */
export interface DecoderOptions {
	/** Expected indentation size for validation */
	indent: number;
	/** Enable strict mode validation (counts, indentation) */
	strict: boolean;
	/** Path expansion strategy (split dotted keys) */
	expandPaths: PathExpansionMode;
}

/**
 * Parsed array header information
 */
export interface HeaderInfo {
	/** Optional key/name for the array */
	key: string | null;
	/** Expected array length */
	length: number;
	/** Active delimiter for this array */
	delimiter: Delimiter;
	/** Optional field names for tabular data */
	fields: string[] | null;
	/** Original line text */
	rawLine: string;
	/** Line number in source */
	lineNumber: number;
}

/**
 * Parsed line with metadata
 */
export interface ParsedLine {
	/** Line content without line number */
	content: string;
	/** Leading indentation spaces */
	indent: number;
	/** Line number (1-indexed) */
	lineNumber: number;
	/** Whether line is empty or whitespace */
	isEmpty: boolean;
}

/**
 * TOON encoding error with context
 */
export class ToonEncodingError extends Error {
	constructor(
		message: string,
		public readonly context?: {
			path?: string;
			value?: unknown;
			key?: string;
		},
	) {
		super(message);
		this.name = 'ToonEncodingError';
	}
}

/**
 * TOON decoding error with context
 */
export class ToonDecodingError extends Error {
	constructor(
		message: string,
		public readonly context?: {
			lineNumber?: number;
			line?: string;
			expected?: string;
			actual?: string;
		},
	) {
		super(message);
		this.name = 'ToonDecodingError';
	}
}
