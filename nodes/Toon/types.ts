/**
 * TOON (Token-Oriented Object Notation) Type Definitions
 * Spec version: 4.1
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
 * A single field entry in a tabular or keyed header's field list (§6).
 * A leaf field has no children; a nested field group carries its own
 * field entries and declares a nested-uniform column (§9.3).
 */
export interface FieldEntry {
  /** Decoded field name */
  name: string;
  /** Nested field group, or null for a leaf field */
  children: FieldEntry[] | null;
}

// Parsed header information lives in ToonUtils as `ParsedHeader`, alongside
// the §6 grammar that produces it, so there is a single canonical definition.

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
  /** Whether a blank line was dropped immediately before this line (§12) */
  blankBefore: boolean;
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
