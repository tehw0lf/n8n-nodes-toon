/**
 * TOON Encoder - Converts JSON to TOON format
 * Implements TOON Specification v4.1
 */

import type { EncoderOptions, Delimiter, FieldEntry } from './types';
import { ToonEncodingError } from './types';
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

    // Reject unrepresentable strings before emitting anything (§3)
    this.assertRepresentable(normalized, '');

    // Apply key folding if enabled
    const folded =
      this.options.keyFolding === 'safe' && utils.isPlainObject(normalized)
        ? this.foldKeys(normalized)
        : normalized;

    // Join lines without trailing newline per §12
    return this.encodeRoot(folded).join('\n');
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

    // Per §3: honor toJSON() hook before other host-type mappings
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as Record<string, unknown>)['toJSON'] === 'function'
    ) {
      const toJSON = (value as Record<string, unknown>)['toJSON'] as () => unknown;
      const serialized = toJSON.call(value);
      // Guard against toJSON() returning the same object (infinite recursion)
      if (serialized !== value) {
        return this.normalizeValue(serialized);
      }
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
   * Walk a normalized value and reject strings or keys carrying an unpaired
   * surrogate, which are not representable in TOON (§3).
   */
  private assertRepresentable(value: unknown, path: string): void {
    if (typeof value === 'string') {
      if (!utils.isRepresentableString(value)) {
        throw new ToonEncodingError(
          'String contains an unpaired surrogate and is not representable in TOON',
          { path, value },
        );
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => this.assertRepresentable(item, `${path}[${index}]`));
      return;
    }

    if (utils.isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (!utils.isRepresentableString(key)) {
          throw new ToonEncodingError(
            'Key contains an unpaired surrogate and is not representable in TOON',
            { path, key },
          );
        }
        this.assertRepresentable(item, path === '' ? key : `${path}.${key}`);
      }
    }
  }

  /**
   * Encode the document root per §5
   */
  private encodeRoot(value: unknown): string[] {
    if (Array.isArray(value)) {
      // Empty root arrays are the bare token "[]" (§9.1)
      if (value.length === 0) {
        return ['[]'];
      }
      return this.encodeArray(value, null, 0);
    }

    if (utils.isPlainObject(value)) {
      // An empty object at the root yields an empty document (§8)
      if (Object.keys(value).length === 0) {
        return [];
      }
      return this.encodeObject(value, 0);
    }

    // Root primitive
    return [this.encodePrimitive(value, this.documentDelimiter)];
  }

  /**
   * Encode a primitive value (§2, §7.2)
   */
  private encodePrimitive(value: unknown, delimiter: Delimiter): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
      return utils.canonicalizeNumber(value);
    }
    if (typeof value === 'string') {
      if (utils.needsQuoting(value, delimiter, delimiter, 'array')) {
        return `"${utils.escapeString(value)}"`;
      }
      // Unquoted values skip escapeString, so check representability here (§3)
      utils.assertNoLoneSurrogate(value);
      return value;
    }
    return 'null';
  }

  /**
   * Render a header's bracket segment and optional field list (§6)
   */
  private header(
    key: string | null,
    length: number,
    fields: FieldEntry[] | null,
    keyed: boolean,
  ): string {
    const keyPart = key === null ? '' : utils.encodeKey(key);
    const keyedMarker = keyed ? ':' : '';
    const delimSym = utils.delimiterSymbol(this.documentDelimiter);
    const fieldsPart =
      fields === null ? '' : `{${utils.serializeFields(fields, this.documentDelimiter)}}`;

    return `${keyPart}[${length}${keyedMarker}${delimSym}]${fieldsPart}:`;
  }

  /**
   * Encode an object's fields (§8), collapsing to keyed tabular form when
   * detection succeeds (§9.5)
   */
  private encodeObject(obj: Record<string, unknown>, depth: number): string[] {
    // An object whose values are uniform objects becomes a keyed table (§9.5)
    const keyedFields = utils.getKeyedTabularFields(obj);
    if (keyedFields !== null) {
      return this.encodeKeyedTabular(obj, keyedFields, null, depth);
    }

    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      lines.push(...this.encodeField(key, value, depth));
    }
    return lines;
  }

  /**
   * Encode a single object field (§8)
   */
  private encodeField(key: string, value: unknown, depth: number): string[] {
    const indentStr = utils.indent(depth, this.options.indent);
    const encodedKey = utils.encodeKey(key);

    if (Array.isArray(value)) {
      // Empty arrays in object-field position use the explicit form (§9.1)
      if (value.length === 0) {
        return [`${indentStr}${encodedKey}: []`];
      }
      return this.encodeArray(value, key, depth);
    }

    if (utils.isPlainObject(value)) {
      const nested = value as Record<string, unknown>;

      // A nested object that qualifies collapses into a keyed table (§9.5)
      const keyedFields = utils.getKeyedTabularFields(nested);
      if (keyedFields !== null) {
        return this.encodeKeyedTabular(nested, keyedFields, key, depth);
      }

      // Nested or empty objects: "key:" alone, fields at depth + 1 (§8)
      const lines = [`${indentStr}${encodedKey}:`];
      lines.push(...this.encodeObject(nested, depth + 1));
      return lines;
    }

    // Object field values quote against the document delimiter (§11.1)
    const encodedValue = this.encodePrimitive(value, this.documentDelimiter);
    return [`${indentStr}${encodedKey}: ${encodedValue}`];
  }

  /**
   * Encode an object in keyed tabular form (§9.5)
   */
  private encodeKeyedTabular(
    obj: Record<string, unknown>,
    fields: FieldEntry[],
    key: string | null,
    depth: number,
  ): string[] {
    const indentStr = utils.indent(depth, this.options.indent);
    const entries = Object.entries(obj);

    const lines = [`${indentStr}${this.header(key, entries.length, fields, true)}`];
    lines.push(...this.entryRows(entries, fields, depth + 1));
    return lines;
  }

  /**
   * Render the entry rows of a keyed table at a given depth (§9.5)
   */
  private entryRows(
    entries: [string, unknown][],
    fields: FieldEntry[],
    depth: number,
  ): string[] {
    const rowIndent = utils.indent(depth, this.options.indent);

    return entries.map(([entryKey, entryValue]) => {
      const cells = utils
        .collectLeafValues(entryValue as Record<string, unknown>, fields)
        .map((cell) => this.encodePrimitive(cell, this.documentDelimiter));

      return `${rowIndent}${utils.encodeKey(entryKey)}: ${cells.join(this.documentDelimiter)}`;
    });
  }

  /**
   * Encode an array, selecting the form from its shape per §9
   */
  private encodeArray(arr: unknown[], key: string | null, depth: number): string[] {
    // Tabular form when every column is uniform-primitive or nested-uniform (§9.3)
    const fields = utils.getTabularFields(arr);
    if (fields !== null) {
      return this.encodeTabular(arr as Record<string, unknown>[], fields, key, depth);
    }

    // Non-empty primitive arrays render inline on the header line (§9.1)
    if (arr.every((item) => utils.isPrimitive(item))) {
      return this.encodeInlineArray(arr, key, depth);
    }

    // Everything else uses list form (§9.2, §9.4)
    return this.encodeListArray(arr, key, depth);
  }

  /**
   * Encode a primitive array inline per §9.1
   */
  private encodeInlineArray(arr: unknown[], key: string | null, depth: number): string[] {
    const indentStr = utils.indent(depth, this.options.indent);
    const values = arr.map((item) => this.encodePrimitive(item, this.documentDelimiter));

    return [
      `${indentStr}${this.header(key, arr.length, null, false)} ${values.join(this.documentDelimiter)}`,
    ];
  }

  /**
   * Encode an array of uniform objects in tabular form per §9.3
   */
  private encodeTabular(
    arr: Record<string, unknown>[],
    fields: FieldEntry[],
    key: string | null,
    depth: number,
  ): string[] {
    const indentStr = utils.indent(depth, this.options.indent);

    const lines = [`${indentStr}${this.header(key, arr.length, fields, false)}`];
    lines.push(...this.tabularRows(arr, fields, depth + 1));
    return lines;
  }

  /**
   * Render tabular rows at a given depth (§9.3)
   */
  private tabularRows(
    arr: Record<string, unknown>[],
    fields: FieldEntry[],
    depth: number,
  ): string[] {
    const rowIndent = utils.indent(depth, this.options.indent);

    return arr.map((obj) => {
      const cells = utils
        .collectLeafValues(obj, fields)
        .map((cell) => this.encodePrimitive(cell, this.documentDelimiter));

      return `${rowIndent}${cells.join(this.documentDelimiter)}`;
    });
  }

  /**
   * Encode an array in list form per §9.2 and §9.4
   */
  private encodeListArray(arr: unknown[], key: string | null, depth: number): string[] {
    const indentStr = utils.indent(depth, this.options.indent);
    const lines = [`${indentStr}${this.header(key, arr.length, null, false)}`];

    for (const item of arr) {
      lines.push(...this.encodeListItem(item, depth + 1));
    }

    return lines;
  }

  /**
   * Encode one list item at the given depth (§9.2, §9.4, §10)
   */
  private encodeListItem(item: unknown, depth: number): string[] {
    const indentStr = utils.indent(depth, this.options.indent);
    const marker = `${indentStr}- `;

    if (Array.isArray(item)) {
      // Inner arrays are keyless headers on the hyphen line (§9.2, §9.4)
      if (item.every((element) => utils.isPrimitive(element))) {
        const values = item.map((element) => this.encodePrimitive(element, this.documentDelimiter));
        const header = this.header(null, item.length, null, false);
        // Empty inner arrays carry no inline content (§9.2)
        return [
          item.length === 0 ? `${marker}${header}` : `${marker}${header} ${values.join(this.documentDelimiter)}`,
        ];
      }

      // Nested arrays of objects use list form; tabular form is unavailable
      // here because a keyless fields-bearing header is root-only (§6, §9.4)
      const lines = [`${marker}${this.header(null, item.length, null, false)}`];
      for (const element of item) {
        lines.push(...this.encodeListItem(element, depth + 1));
      }
      return lines;
    }

    if (utils.isPlainObject(item)) {
      return this.encodeListItemObject(item as Record<string, unknown>, depth);
    }

    return [`${marker}${this.encodePrimitive(item, this.documentDelimiter)}`];
  }

  /**
   * Encode an object appearing as a list item per §10
   */
  private encodeListItemObject(obj: Record<string, unknown>, depth: number): string[] {
    const indentStr = utils.indent(depth, this.options.indent);
    const entries = Object.entries(obj);

    // Empty object list item: a bare "-" at the list-item depth (§10)
    if (entries.length === 0) {
      return [`${indentStr}-`];
    }

    const [firstKey, firstValue] = entries[0];
    const restEntries = entries.slice(1);
    const lines: string[] = [];

    // When the first field is a tabular array or keyed tabular object, its
    // header goes on the hyphen line and its rows sit at depth + 2 (§10)
    const firstFieldLines = this.encodeListItemFirstField(firstKey, firstValue, depth);
    lines.push(...firstFieldLines);

    // All other fields appear at depth + 1 under the hyphen line (§10)
    for (const [key, value] of restEntries) {
      lines.push(...this.encodeField(key, value, depth + 1));
    }

    return lines;
  }

  /**
   * Encode the first field of a list-item object, carried on the hyphen line (§10)
   */
  private encodeListItemFirstField(key: string, value: unknown, depth: number): string[] {
    const marker = `${utils.indent(depth, this.options.indent)}- `;

    if (Array.isArray(value) && value.length > 0) {
      const fields = utils.getTabularFields(value);
      if (fields !== null) {
        // Header on the hyphen line, rows at depth + 2 (§10)
        const header = this.header(key, value.length, fields, false);
        return [
          `${marker}${header}`,
          ...this.tabularRows(value as Record<string, unknown>[], fields, depth + 2),
        ];
      }
    }

    if (utils.isPlainObject(value)) {
      const nested = value as Record<string, unknown>;
      const keyedFields = utils.getKeyedTabularFields(nested);
      if (keyedFields !== null) {
        // Keyed header on the hyphen line, entry rows at depth + 2 (§10)
        const header = this.header(key, Object.keys(nested).length, keyedFields, true);
        return [
          `${marker}${header}`,
          ...this.entryRows(Object.entries(nested), keyedFields, depth + 2),
        ];
      }
    }

    // All other first fields: encode normally, then splice the hyphen marker
    // in place of the leading indentation of the field's first line (§10).
    const fieldLines = this.encodeField(key, value, depth + 1);
    const indentWidth = (depth + 1) * this.options.indent;
    fieldLines[0] = `${marker}${fieldLines[0].slice(indentWidth)}`;
    return fieldLines;
  }

  /**
   * Apply key folding (optional feature)
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
      // Skip unsafe keys to prevent prototype pollution
      if (!utils.isSafeKey(nextKey)) {
        break;
      }
      chain.push(nextKey);
      // nosemgrep: javascript.lang.security.audit.prototype-pollution.prototype-pollution-loop.prototype-pollution-loop
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
      // Skip unsafe keys to prevent prototype pollution
      if (!utils.isSafeKey(keys[0])) {
        return current;
      }
      // nosemgrep: javascript.lang.security.audit.prototype-pollution.prototype-pollution-loop.prototype-pollution-loop
      current = (current as Record<string, unknown>)[keys[0]];
    }
    return current;
  }
}
