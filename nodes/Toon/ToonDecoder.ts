/**
 * TOON Decoder - Parses TOON format to JSON
 * Implements TOON Specification v4.1
 */

import type { DecoderOptions, FieldEntry, ParsedLine } from './types';
import { ToonDecodingError } from './types';
import * as utils from './ToonUtils';

export class ToonDecoder {
  private options: DecoderOptions;

  /** Comment-stripped, non-blank lines of the document (§5.1) */
  private lines: ParsedLine[] = [];

  /** Cursor into `lines` */
  private pos = 0;

  constructor(options: DecoderOptions) {
    this.options = options;
  }

  /**
   * Decode TOON text to JavaScript value
   */
  decode(toonText: string): unknown {
    this.lines = this.parseLines(toonText);
    this.pos = 0;

    // An empty document (or one of only comments/blanks) decodes to {} (§5)
    if (this.lines.length === 0) {
      return {};
    }

    let result = this.parseRoot();

    // Apply path expansion if enabled
    if (this.options.expandPaths === 'safe' && utils.isPlainObject(result)) {
      result = this.expandPaths(result as Record<string, unknown>);
    }

    return result;
  }

  /**
   * Split input into lines, strip comments and blanks, and validate
   * indentation per §5.1 and §12
   */
  private parseLines(text: string): ParsedLine[] {
    // A single leading U+FEFF is a byte-order mark, not content (§12)
    const withoutBom = text.startsWith('﻿') ? text.slice(1) : text;
    const rawLines = withoutBom.split('\n');
    const parsed: ParsedLine[] = [];

    // Tracks whether a blank line was dropped immediately before the next
    // retained line, so §12's header-span check can still see it
    let blankBefore = false;

    for (let i = 0; i < rawLines.length; i++) {
      // A trailing CR is part of the line terminator, accepting CRLF (§12)
      let line = rawLines[i].replace(/\r$/, '');

      // Trailing spaces are not part of the line's content (§12)
      line = line.replace(/ +$/, '');

      const lineNumber = i + 1;

      // Comment lines are removed in a lexical pre-pass, in both modes (§5.1).
      // Only spaces may precede the "#"; a leading tab disqualifies the line.
      if (/^ *#/.test(line)) {
        continue;
      }

      // Blank lines never create or close structure (§12), but a blank
      // falling inside a header span is a strict-mode error, so remember it
      if (line.trim() === '') {
        blankBefore = true;
        continue;
      }

      // Tabs MUST NOT be used for indentation (§12)
      if (/^\t/.test(line)) {
        if (this.options.strict) {
          throw new ToonDecodingError('Tabs not allowed in indentation', {
            lineNumber,
            line,
          });
        }
        // Non-strict: leading tabs are removed before classification (§12)
        line = line.replace(/^\t+/, '');
      }

      const indent = line.match(/^( *)/)?.[1].length ?? 0;

      // Indentation MUST be an exact multiple of indentSize in strict mode (§12)
      if (this.options.strict && indent % this.options.indent !== 0) {
        throw new ToonDecodingError(
          `Indentation must be multiple of ${this.options.indent}, got ${indent} spaces`,
          { lineNumber, line },
        );
      }

      parsed.push({
        content: line.slice(indent),
        indent,
        lineNumber,
        isEmpty: false,
        blankBefore,
      });

      blankBefore = false;
    }

    return parsed;
  }

  /**
   * Reject a blank line falling inside a header span in strict mode (§12).
   *
   * A header span runs from a scope's first row, item, or entry line through
   * the last line of its content, so this applies only once at least one such
   * line has been read; blanks between a header and its first line are ignored.
   */
  private checkBlankInSpan(line: ParsedLine, seen: number): void {
    if (this.options.strict && seen > 0 && line.blankBefore) {
      throw new ToonDecodingError('Blank line inside a header span', {
        lineNumber: line.lineNumber,
        line: line.content,
      });
    }
  }

  /**
   * Depth of a line in indentation levels (§1.3)
   */
  private depthOf(line: ParsedLine): number {
    return Math.floor(line.indent / this.options.indent);
  }

  private peek(): ParsedLine | null {
    return this.pos < this.lines.length ? this.lines[this.pos] : null;
  }

  /**
   * Determine and parse the root form per §5
   */
  private parseRoot(): unknown {
    const first = this.lines[0];
    const content = first.content;

    // The bare token "[]" is an empty root array (§9.1)
    if (content === '[]') {
      this.pos = 1;
      this.checkNoTrailingContent();
      return [];
    }

    const header = this.tryParseHeader(first);

    // Only a *keyless* header at depth 0 defines the root form; a keyed
    // header such as `users[2:]{…}:` is an ordinary field of a root object (§5)
    if (header !== null && header.key === null && this.depthOf(first) === 0) {
      // A keyless keyed header at the root is a keyed tabular object (§9.5)
      if (header.keyed) {
        const value = this.parseKeyedTabular(header, 0);
        this.checkNoTrailingContent();
        return value;
      }

      const value = this.parseArrayBody(header, 0);
      this.checkNoTrailingContent();
      return value;
    }

    // A single non-blank line that is neither a header nor a key-value line
    // decodes as a root primitive (§5)
    if (this.lines.length === 1 && utils.findUnquoted(content, ':') < 0) {
      this.pos = 1;
      return this.parseValueToken(content, first);
    }

    // Two or more depth-0 lines that are neither headers nor key-value lines
    // make the document invalid (§5, any mode)
    const scalarLines = this.lines.filter(
      (line) =>
        this.depthOf(line) === 0 &&
        utils.findUnquoted(line.content, ':') < 0 &&
        !line.content.startsWith('- '),
    );
    if (scalarLines.length >= 2) {
      throw new ToonDecodingError(
        'Multiple depth-0 lines that are neither headers nor key-value lines',
        { lineNumber: scalarLines[1].lineNumber, line: scalarLines[1].content },
      );
    }

    return this.parseObject(0);
  }

  /**
   * Enforce that no content follows a completed root form (§5, §14.2)
   */
  private checkNoTrailingContent(): void {
    const next = this.peek();
    if (next === null) {
      return;
    }
    if (this.options.strict) {
      throw new ToonDecodingError('Trailing content after completed root form', {
        lineNumber: next.lineNumber,
        line: next.content,
      });
    }
    // Non-strict decoders MAY ignore it (§5)
    this.pos = this.lines.length;
  }

  /**
   * Attempt to parse a line as a header per §6.
   *
   * Returns null when the line is not header-shaped. Header syntax errors
   * propagate in strict mode and fall through to key-value parsing otherwise.
   */
  private tryParseHeader(line: ParsedLine): utils.ParsedHeader | null {
    const outcome = utils.tryParseHeader(line.content);

    if (outcome.error !== null && this.options.strict) {
      throw new ToonDecodingError(outcome.error, {
        lineNumber: line.lineNumber,
        line: line.content,
      });
    }

    return outcome.header;
  }

  /**
   * Parse an object scope whose content sits at `depth` (§8)
   */
  private parseObject(depth: number): Record<string, unknown> {
    const obj: Record<string, unknown> = {};

    while (this.pos < this.lines.length) {
      const line = this.lines[this.pos];
      const lineDepth = this.depthOf(line);

      // A shallower line ends this scope
      if (lineDepth < depth) {
        break;
      }

      // A deeper line whose predecessor did not open a scope belongs to no
      // scope (§8, §14.2)
      if (lineDepth > depth) {
        if (this.options.strict) {
          throw new ToonDecodingError(
            'Over-indented line: no enclosing scope was opened',
            { lineNumber: line.lineNumber, line: line.content },
          );
        }
        this.pos++;
        continue;
      }

      const { key, value } = this.parseFieldLine(line, depth);
      this.assignKey(obj, key, line);
      utils.setDecodedKey(obj, key, value);
    }

    return obj;
  }

  /**
   * Enforce the duplicate sibling key rule (§14.3)
   */
  private assignKey(
    obj: Record<string, unknown>,
    key: string,
    line: ParsedLine,
  ): void {
    if (Object.prototype.hasOwnProperty.call(obj, key) && this.options.strict) {
      throw new ToonDecodingError(`Duplicate key '${key}' at the same depth`, {
        lineNumber: line.lineNumber,
        line: line.content,
      });
    }
    // Non-strict: last-write-wins, applied silently by the caller's assignment
  }

  /**
   * Parse one key-bearing line of an object scope and its nested content (§8)
   */
  private parseFieldLine(
    line: ParsedLine,
    depth: number,
  ): { key: string; value: unknown } {
    const header = this.tryParseHeader(line);

    if (header !== null) {
      // A keyless header is valid only at the root or as a list item (§6)
      if (header.key === null) {
        if (this.options.strict) {
          throw new ToonDecodingError(
            'Keyless header is not valid in object-field position',
            { lineNumber: line.lineNumber, line: line.content },
          );
        }
      } else {
        this.pos++;
        const value = header.keyed
          ? this.parseKeyedTabularBody(header, depth + 1)
          : this.parseArrayBodyAfterHeader(header, depth);
        return { key: header.key, value };
      }
    }

    // Key-value line (§5.2)
    const colonIndex = utils.findUnquoted(line.content, ':');
    if (colonIndex < 0) {
      throw new ToonDecodingError('Missing colon in key context', {
        lineNumber: line.lineNumber,
        line: line.content,
      });
    }

    const key = this.decodeKeyToken(line.content.slice(0, colonIndex), line);
    const rest = utils.trimSpaces(line.content.slice(colonIndex + 1));
    this.pos++;

    // "key: []" is the explicit empty-array form (§9.1)
    if (rest === '[]') {
      return { key, value: [] };
    }

    if (rest !== '') {
      return { key, value: this.parseValueToken(rest, line) };
    }

    // A bare "key:" opens a nested or empty object (§8)
    return { key, value: this.parseNestedScope(depth) };
  }

  /**
   * Parse the scope opened by a bare "key:" line (§8)
   */
  private parseNestedScope(depth: number): Record<string, unknown> {
    const next = this.peek();

    if (next === null || this.depthOf(next) <= depth) {
      // No nested content: an empty object
      return {};
    }

    // The first line of a non-empty nested scope MUST be at exactly depth+1 (§8)
    if (this.options.strict && this.depthOf(next) > depth + 1) {
      throw new ToonDecodingError(
        'Indentation depth jump: nested scope must start one level deeper',
        { lineNumber: next.lineNumber, line: next.content },
      );
    }

    return this.parseObject(depth + 1);
  }

  /**
   * Parse an array whose header has already been consumed, with the header
   * line standing at `headerDepth` (§9.1–§9.4)
   */
  private parseArrayBodyAfterHeader(
    header: utils.ParsedHeader,
    headerDepth: number,
  ): unknown[] {
    return this.parseArrayContent(header, headerDepth + 1);
  }

  /**
   * Parse a root array: consumes the header line, then its content (§9)
   */
  private parseArrayBody(header: utils.ParsedHeader, headerDepth: number): unknown[] {
    this.pos++;
    return this.parseArrayContent(header, headerDepth + 1);
  }

  /**
   * Parse an array's content at `contentDepth` (§9.1–§9.4)
   */
  private parseArrayContent(
    header: utils.ParsedHeader,
    contentDepth: number,
  ): unknown[] {
    // A fields-bearing header carries no inline content (§6, §14.2)
    if (header.fields !== null && header.inline !== '') {
      throw new ToonDecodingError('Content after a fields-bearing header colon', {
        lineNumber: this.lines[this.pos - 1]?.lineNumber,
        line: header.inline,
      });
    }

    // Tabular form (§9.3)
    if (header.fields !== null) {
      return this.parseTabularRows(header, contentDepth);
    }

    // Inline primitive array (§9.1)
    if (header.inline !== '') {
      const values = utils
        .splitDelimited(header.inline, header.delimiter)
        .map((token) => this.parseValueToken(token, this.lines[this.pos - 1]));

      this.checkCount(values.length, header.length, 'inline array values');
      return values;
    }

    // Legacy empty-array header form "key[0]:" (§9.1)
    if (header.length === 0) {
      const next = this.peek();
      if (next === null || this.depthOf(next) < contentDepth) {
        return [];
      }
    }

    // List form (§9.2, §9.4)
    return this.parseListItems(header, contentDepth);
  }

  /**
   * Parse tabular rows at `rowDepth` (§9.3)
   */
  private parseTabularRows(
    header: utils.ParsedHeader,
    rowDepth: number,
  ): Record<string, unknown>[] {
    const fields = header.fields!;
    const leafCount = utils.countLeafFields(fields);
    const rows: Record<string, unknown>[] = [];

    while (this.pos < this.lines.length) {
      const line = this.lines[this.pos];

      if (this.depthOf(line) !== rowDepth) {
        break;
      }

      // Row/key-value disambiguation at row depth (§9.3)
      const colonIndex = utils.findUnquoted(line.content, ':');
      const delimIndex = utils.findUnquoted(line.content, header.delimiter);

      if (colonIndex >= 0 && (delimIndex < 0 || colonIndex < delimIndex)) {
        // Colon before delimiter (or no delimiter): end of rows
        break;
      }

      this.checkBlankInSpan(line, rows.length);

      const cells = utils.splitDelimited(line.content, header.delimiter);
      this.checkWidth(cells.length, leafCount, line);
      rows.push(this.materializeRow(cells, fields, line));
      this.pos++;
    }

    this.checkCount(rows.length, header.length, 'tabular rows');
    return rows;
  }

  /**
   * Build an object from a row's cells by walking the field tree (§9.3)
   */
  private materializeRow(
    cells: string[],
    fields: FieldEntry[],
    line: ParsedLine,
  ): Record<string, unknown> {
    let index = 0;

    const walk = (entries: FieldEntry[]): Record<string, unknown> => {
      const obj: Record<string, unknown> = {};

      for (const entry of entries) {
        if (entry.children === null) {
          // A leaf field with no remaining cell is absent (§14.1, non-strict)
          if (index < cells.length) {
            utils.setDecodedKey(obj, entry.name, this.parseValueToken(cells[index], line));
          }
          index++;
        } else {
          utils.setDecodedKey(obj, entry.name, walk(entry.children));
        }
      }

      return obj;
    };

    return walk(fields);
  }

  /**
   * Parse a keyed tabular object, consuming its header line (§9.5)
   */
  private parseKeyedTabular(
    header: utils.ParsedHeader,
    headerDepth: number,
  ): Record<string, unknown> {
    this.pos++;
    return this.parseKeyedTabularBody(header, headerDepth + 1);
  }

  /**
   * Parse a keyed tabular object's entry rows at `entryDepth` (§9.5)
   */
  private parseKeyedTabularBody(
    header: utils.ParsedHeader,
    entryDepth: number,
  ): Record<string, unknown> {
    // A fields-bearing header carries no inline content (§6, §14.2)
    if (header.inline !== '') {
      throw new ToonDecodingError('Content after a keyed header colon', {
        lineNumber: this.lines[this.pos - 1]?.lineNumber,
        line: header.inline,
      });
    }

    const fields = header.fields!;
    const leafCount = utils.countLeafFields(fields);
    const obj: Record<string, unknown> = {};
    let count = 0;

    while (this.pos < this.lines.length) {
      const line = this.lines[this.pos];

      // A keyed scope ends only when the depth decreases (§9.5)
      if (this.depthOf(line) < entryDepth) {
        break;
      }

      if (this.depthOf(line) > entryDepth) {
        if (this.options.strict) {
          throw new ToonDecodingError('Over-indented line in keyed tabular scope', {
            lineNumber: line.lineNumber,
            line: line.content,
          });
        }
        this.pos++;
        continue;
      }

      // Every line at entry depth containing an unquoted colon is an entry row (§9.5)
      const colonIndex = utils.findUnquoted(line.content, ':');
      if (colonIndex < 0) {
        if (this.options.strict) {
          throw new ToonDecodingError('Line at entry depth without an unquoted colon', {
            lineNumber: line.lineNumber,
            line: line.content,
          });
        }
        this.pos++;
        continue;
      }

      this.checkBlankInSpan(line, count);

      const entryKey = this.decodeKeyToken(line.content.slice(0, colonIndex), line);
      const rest = utils.trimSpaces(line.content.slice(colonIndex + 1));

      // An empty cell sequence is zero cells, not one empty cell (§9.5, §11.2)
      const cells = rest === '' ? [] : utils.splitDelimited(rest, header.delimiter);
      this.checkWidth(cells.length, leafCount, line);

      this.assignKey(obj, entryKey, line);
      utils.setDecodedKey(obj, entryKey, this.materializeRow(cells, fields, line));
      count++;
      this.pos++;
    }

    this.checkCount(count, header.length, 'keyed entry rows');
    return obj;
  }

  /**
   * Parse an array's list items at `itemDepth` (§9.2, §9.4, §10)
   */
  private parseListItems(header: utils.ParsedHeader, itemDepth: number): unknown[] {
    const items: unknown[] = [];

    while (this.pos < this.lines.length) {
      const line = this.lines[this.pos];
      const lineDepth = this.depthOf(line);

      if (lineDepth < itemDepth) {
        break;
      }

      // A list scope ends at the first line at item depth that is not a
      // list-item line (§9.4)
      if (lineDepth === itemDepth && !this.isListItemLine(line)) {
        break;
      }

      if (lineDepth > itemDepth) {
        if (this.options.strict) {
          throw new ToonDecodingError('Over-indented line in list scope', {
            lineNumber: line.lineNumber,
            line: line.content,
          });
        }
        this.pos++;
        continue;
      }

      this.checkBlankInSpan(line, items.length);
      items.push(this.parseListItem(line, itemDepth));
    }

    this.checkCount(items.length, header.length, 'list items');
    return items;
  }

  /**
   * A list-item line is the bare marker "-" or begins with "- " (§5.2)
   */
  private isListItemLine(line: ParsedLine): boolean {
    return line.content === '-' || line.content.startsWith('- ');
  }

  /**
   * Parse one list item (§9.2, §9.4, §10)
   */
  private parseListItem(line: ParsedLine, itemDepth: number): unknown {
    // Bare "-" is an empty-object list item (§10)
    if (line.content === '-') {
      this.pos++;
      return {};
    }

    const rest = line.content.slice(2);

    // The empty inner array item "- []" (§9.2)
    if (rest === '[]') {
      this.pos++;
      return [];
    }

    // Synthesize a line standing at the item's content position so header
    // parsing and depth accounting see the post-marker text (§10)
    const inner: ParsedLine = {
      content: rest,
      indent: line.indent + 2,
      lineNumber: line.lineNumber,
      isEmpty: false,
      blankBefore: false,
    };

    const header = this.tryParseHeader(inner);

    if (header !== null) {
      this.pos++;

      // A keyless header on a hyphen line is the list item itself; its items
      // stand at itemDepth + 1 (§10)
      if (header.key === null) {
        if (header.fields !== null && this.options.strict) {
          throw new ToonDecodingError(
            'Keyless fields-bearing header is not valid as a list item',
            { lineNumber: line.lineNumber, line: line.content },
          );
        }
        return this.parseArrayContent(header, itemDepth + 1);
      }

      // A keyed first field: the list-item object's fields stand at
      // itemDepth + 1 and this field's content at itemDepth + 2 (§10)
      const obj: Record<string, unknown> = {};
      utils.setDecodedKey(
        obj,
        header.key,
        header.keyed
          ? this.parseKeyedTabularBody(header, itemDepth + 2)
          : this.parseArrayContent(header, itemDepth + 2),
      );

      this.parseListItemRestFields(obj, itemDepth + 1);
      return obj;
    }

    // An object whose first field is carried on the hyphen line (§10)
    const colonIndex = utils.findUnquoted(rest, ':');
    if (colonIndex >= 0) {
      const key = this.decodeKeyToken(rest.slice(0, colonIndex), line);
      const valuePart = utils.trimSpaces(rest.slice(colonIndex + 1));
      this.pos++;

      const obj: Record<string, unknown> = {};

      if (valuePart === '[]') {
        utils.setDecodedKey(obj, key, []);
      } else if (valuePart !== '') {
        utils.setDecodedKey(obj, key, this.parseValueToken(valuePart, line));
      } else {
        // A nested scope opened by the first field sits at itemDepth + 2 (§10)
        utils.setDecodedKey(obj, key, this.parseNestedScope(itemDepth + 1));
      }

      this.parseListItemRestFields(obj, itemDepth + 1);
      return obj;
    }

    // Primitive list item (§9.4)
    this.pos++;
    return this.parseValueToken(rest, line);
  }

  /**
   * Parse a list-item object's remaining fields, which stand at `fieldDepth` (§10)
   */
  private parseListItemRestFields(
    obj: Record<string, unknown>,
    fieldDepth: number,
  ): void {
    while (this.pos < this.lines.length) {
      const line = this.lines[this.pos];

      if (this.depthOf(line) !== fieldDepth || this.isListItemLine(line)) {
        break;
      }

      const { key, value } = this.parseFieldLine(line, fieldDepth);
      this.assignKey(obj, key, line);
      utils.setDecodedKey(obj, key, value);
    }
  }

  /**
   * Enforce a declared count in strict mode (§14.1)
   */
  private checkCount(actual: number, declared: number, what: string): void {
    if (this.options.strict && actual !== declared) {
      throw new ToonDecodingError(
        `Count mismatch for ${what}: expected ${declared}, got ${actual}`,
      );
    }
  }

  /**
   * Enforce a row's cell count against the header's leaf-field count (§14.1)
   */
  private checkWidth(actual: number, expected: number, line: ParsedLine): void {
    if (this.options.strict && actual !== expected) {
      throw new ToonDecodingError(
        `Row width mismatch: expected ${expected} cells, got ${actual}`,
        { lineNumber: line.lineNumber, line: line.content },
      );
    }
  }

  /**
   * Decode a key token, unescaping when quoted (§7.4)
   */
  private decodeKeyToken(token: string, line: ParsedLine): string {
    const trimmed = utils.trimSpaces(token);

    if (trimmed.startsWith('"')) {
      if (!trimmed.endsWith('"') || trimmed.length < 2) {
        throw new ToonDecodingError('Unterminated quoted key', {
          lineNumber: line.lineNumber,
          line: line.content,
        });
      }
      const unescaped = utils.tryUnescapeString(trimmed.slice(1, -1));
      if (unescaped.error !== null) {
        throw new ToonDecodingError(unescaped.error, {
          lineNumber: line.lineNumber,
          line: line.content,
        });
      }
      return unescaped.value as string;
    }

    return trimmed;
  }

  /**
   * Parse a value token per §4 and §7.4
   */
  private parseValueToken(token: string, line: ParsedLine | undefined): unknown {
    const trimmed = utils.trimSpaces(token);

    // A token starting with a quote MUST be a complete quoted token (§7.4)
    if (trimmed.startsWith('"')) {
      const closing = this.findClosingQuote(trimmed);

      if (closing < 0) {
        throw new ToonDecodingError('Unterminated quoted string', {
          lineNumber: line?.lineNumber,
          line: line?.content,
        });
      }

      if (closing !== trimmed.length - 1) {
        throw new ToonDecodingError('Characters after closing quote', {
          lineNumber: line?.lineNumber,
          line: line?.content,
        });
      }

      const unescaped = utils.tryUnescapeString(trimmed.slice(1, -1));
      if (unescaped.error !== null) {
        throw new ToonDecodingError(unescaped.error, {
          lineNumber: line?.lineNumber,
          line: line?.content,
        });
      }
      return unescaped.value as string;
    }

    return utils.parseToken(trimmed);
  }

  /**
   * Find the index of the quote closing a token that starts with one
   */
  private findClosingQuote(token: string): number {
    let i = 1;

    while (i < token.length) {
      if (token[i] === '\\') {
        i += 2;
        continue;
      }
      if (token[i] === '"') {
        return i;
      }
      i++;
    }

    return -1;
  }

  /**
   * Expand dotted paths into nested objects (optional feature)
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

      // Prevent prototype pollution
      if (!utils.isSafeKey(segment)) {
        throw new ToonDecodingError(
          `Unsafe key detected in path: '${segment}' (potential prototype pollution)`,
        );
      }

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

      // nosemgrep: javascript.lang.security.audit.prototype-pollution.prototype-pollution-loop.prototype-pollution-loop
      current = current[segment] as Record<string, unknown>;
    }

    const lastSegment = path[path.length - 1];

    // Prevent prototype pollution on final segment
    if (!utils.isSafeKey(lastSegment)) {
      throw new ToonDecodingError(
        `Unsafe key detected in path: '${lastSegment}' (potential prototype pollution)`,
      );
    }

    if (lastSegment in current && this.options.strict) {
      throw new ToonDecodingError(
        `Path expansion conflict: duplicate key '${path.join('.')}'`,
      );
    }

    current[lastSegment] = value;
  }
}
