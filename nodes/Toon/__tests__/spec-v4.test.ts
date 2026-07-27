/**
 * Conformance tests for TOON Specification v4.1 features
 *
 * Covers the constructs introduced or clarified in v4.x: keyed tabular form
 * (§9.5), nested field groups (§9.3), comment lines (§5.1), the §10 list-item
 * depth model, and the decoder input requirements of §12.
 */

import { ToonEncoder } from '../ToonEncoder';
import { ToonDecoder } from '../ToonDecoder';
import type { DecoderOptions, EncoderOptions } from '../types';
import { ToonDecodingError, ToonEncodingError } from '../types';

const encoderOptions: EncoderOptions = {
  indent: 2,
  delimiter: ',',
  keyFolding: 'off',
  flattenDepth: Infinity,
};

const strictOptions: DecoderOptions = {
  indent: 2,
  strict: true,
  expandPaths: 'off',
};

const laxOptions: DecoderOptions = { ...strictOptions, strict: false };

const encode = (value: unknown) => new ToonEncoder(encoderOptions).encode(value);
const decode = (toon: string) => new ToonDecoder(strictOptions).decode(toon);
const decodeLax = (toon: string) => new ToonDecoder(laxOptions).decode(toon);

describe('TOON v4.1 conformance', () => {
  describe('Appendix A examples', () => {
    it('decodes the keyed tabular example', () => {
      const toon = 'users[2:]{age,city}:\n  alice: 30,Berlin\n  bob: 25,Oslo';
      expect(decode(toon)).toEqual({
        users: {
          alice: { age: 30, city: 'Berlin' },
          bob: { age: 25, city: 'Oslo' },
        },
      });
    });

    it('decodes a keyless keyed header as a root object (§9.5)', () => {
      const toon = '[2:]{age,city}:\n  alice: 30,Berlin\n  bob: 25,Oslo';
      expect(decode(toon)).toEqual({
        alice: { age: 30, city: 'Berlin' },
        bob: { age: 25, city: 'Oslo' },
      });
    });

    it('decodes nested field groups into nested objects (§9.3)', () => {
      const toon = 'orders[2]{id,customer{name,country},total}:\n  1,Ada,DK,99\n  2,Bob,UK,149';
      expect(decode(toon)).toEqual({
        orders: [
          { id: 1, customer: { name: 'Ada', country: 'DK' }, total: 99 },
          { id: 2, customer: { name: 'Bob', country: 'UK' }, total: 149 },
        ],
      });
    });

    it('decodes a nested tabular array inside a list item (§10)', () => {
      const toon = 'items[1]:\n  - users[2]{id,name}:\n      1,Ada\n      2,Bob\n    status: active';
      expect(decode(toon)).toEqual({
        items: [
          {
            users: [
              { id: 1, name: 'Ada' },
              { id: 2, name: 'Bob' },
            ],
            status: 'active',
          },
        ],
      });
    });

    it('keeps quoted colons inside row cells (§9.3)', () => {
      const toon = 'links[2]{id,url}:\n  1,"http://a:b"\n  2,"https://example.com?q=a:b"';
      expect(decode(toon)).toEqual({
        links: [
          { id: 1, url: 'http://a:b' },
          { id: 2, url: 'https://example.com?q=a:b' },
        ],
      });
    });

    it('round-trips the objects-as-list-items example (§10)', () => {
      const toon = 'items[2]:\n  - id: 1\n    name: First\n  - id: 2\n    name: Second\n    extra: true';
      const value = {
        items: [
          { id: 1, name: 'First' },
          { id: 2, name: 'Second', extra: true },
        ],
      };
      expect(decode(toon)).toEqual(value);
      expect(encode(value)).toBe(toon);
    });
  });

  describe('comment lines (§5.1)', () => {
    it('strips full-line comments in strict mode', () => {
      expect(decode('# leading\nid: 1\n  # indented\nname: Ada')).toEqual({
        id: 1,
        name: 'Ada',
      });
    });

    it('does not let a comment terminate a tabular scope', () => {
      expect(decode('items[2]{a}:\n  1\n# between rows\n  2')).toEqual({
        items: [{ a: 1 }, { a: 2 }],
      });
    });

    it('decodes a document of only comments as an empty object', () => {
      expect(decode('# one\n# two')).toEqual({});
    });

    it('treats "#" inside a value as ordinary content', () => {
      expect(decode('a: "#not-a-comment"')).toEqual({ a: '#not-a-comment' });
    });

    it('quotes strings starting with "#" so encoder output has no comment lines', () => {
      expect(encode({ a: '#tag' })).toBe('a: "#tag"');
    });

    it('does not treat a tab-indented "#" line as a comment (§5.1)', () => {
      // Only spaces may precede the "#"; a leading tab is an indentation error
      expect(() => decode('a: 1\n\t# not a comment')).toThrow(ToonDecodingError);
    });
  });

  describe('decoder input handling (§12)', () => {
    it('accepts CRLF line endings', () => {
      expect(decode('a: 1\r\nb: 2')).toEqual({ a: 1, b: 2 });
    });

    it('strips a leading byte-order mark', () => {
      expect(decode('\uFEFFa: 1')).toEqual({ a: 1 });
    });

    it('ignores trailing spaces when classifying lines', () => {
      expect(decode('items[2]:\n  -   \n  - a: 1')).toEqual({ items: [{}, { a: 1 }] });
    });

    it('accepts a trailing newline at end of file', () => {
      expect(decode('a: 1\n')).toEqual({ a: 1 });
    });

    it('rejects a tab anywhere in the indentation, not just column 0 (§12)', () => {
      expect(() => decode('a:\n\tb: 1')).toThrow(ToonDecodingError);
      expect(() => decode('a:\n  \tb: 1')).toThrow(ToonDecodingError);
      expect(() => decode('a:\n \t b: 1')).toThrow(ToonDecodingError);
    });

    it('strips tabs from indentation in non-strict mode (§12)', () => {
      expect(decodeLax('a:\n  \tb: 1')).toEqual({ a: { b: 1 } });
    });
  });

  describe('keyed tabular decoding (§9.5)', () => {
    it('accepts an entry count of zero', () => {
      expect(decode('key[0:]{f}:')).toEqual({ key: {} });
    });

    it('errors when the entry row count does not match N', () => {
      expect(() => decode('u[3:]{a}:\n  x: 1\n  y: 2')).toThrow(ToonDecodingError);
    });

    it('errors when an entry row is too narrow', () => {
      expect(() => decode('u[1:]{a,b}:\n  x: 1')).toThrow(ToonDecodingError);
    });

    it('treats a bare entry key as zero cells (§9.5)', () => {
      expect(() => decode('u[1:]{a}:\n  x:')).toThrow(ToonDecodingError);
    });

    it('errors on a line at entry depth without an unquoted colon', () => {
      expect(() => decode('u[2:]{a}:\n  x: 1\n  bare')).toThrow(ToonDecodingError);
    });

    it('does not apply the colon-before-delimiter rule at entry depth', () => {
      // Unlike §9.3 rows, a colon does not end a keyed scope
      expect(decode('u[2:]{a,b}:\n  x: 1,2\n  y: 3,4')).toEqual({
        u: { x: { a: 1, b: 2 }, y: { a: 3, b: 4 } },
      });
    });

    it('unescapes quoted entry keys', () => {
      expect(decode('u[2:]{a}:\n  "my-key": 1\n  other: 2')).toEqual({
        u: { 'my-key': { a: 1 }, other: { a: 2 } },
      });
    });

    it('requires a field list on a keyed header (§6)', () => {
      expect(() => decode('u[2:]:\n  x: 1\n  y: 2')).toThrow(ToonDecodingError);
    });

    it('rejects a keyless keyed header outside root position (§14.2)', () => {
      expect(() => decode('a:\n  [2:]{f}:\n    x: 1\n    y: 2')).toThrow(ToonDecodingError);
    });
  });

  describe('header grammar (§6, §14.2)', () => {
    it('rejects an empty field list', () => {
      expect(() => decode('a[1]{}:\n  1')).toThrow(ToonDecodingError);
    });

    it('rejects a duplicated field name in one field list', () => {
      expect(() => decode('a[1]{x,x}:\n  1,2')).toThrow(ToonDecodingError);
    });

    it('allows the same name at different nesting levels', () => {
      expect(decode('a[1]{x,n{x}}:\n  1,2')).toEqual({ a: [{ x: 1, n: { x: 2 } }] });
    });

    it('rejects leading zeros in the declared length', () => {
      expect(() => decode('a[03]: 1,2,3')).toThrow(ToonDecodingError);
    });

    it('rejects whitespace between a key and its bracket segment', () => {
      expect(() => decode('foo [2]: 1,2')).toThrow(ToonDecodingError);
    });

    it('rejects inline content after a fields-bearing header', () => {
      expect(() => decode('items[2]{a,b}: 1,2')).toThrow(ToonDecodingError);
    });

    it('rejects a keyless header in object-field position', () => {
      expect(() => decode('a:\n  [2]: x,y')).toThrow(ToonDecodingError);
    });

    it('treats a dotted key as a single literal key', () => {
      expect(decode('data.meta.items[2]{id}:\n  1\n  2')).toEqual({
        'data.meta.items': [{ id: 1 }, { id: 2 }],
      });
    });

    it('parses a quoted key carrying a colon as a header', () => {
      expect(decode('"a:b"[2]: 1,2')).toEqual({ 'a:b': [1, 2] });
    });

    it('classifies a line whose colon precedes its bracket as key-value', () => {
      expect(decodeLax('a:b[2]: x')).toEqual({ a: 'b[2]: x' });
    });
  });

  describe('root form and trailing content (§5)', () => {
    it('decodes an empty document as an empty object', () => {
      expect(decode('')).toEqual({});
    });

    it('decodes a bare "[]" as an empty root array', () => {
      expect(decode('[]')).toEqual([]);
    });

    it('rejects content after a completed root array', () => {
      expect(() => decode('[1]: 1\nx: 2')).toThrow(ToonDecodingError);
    });

    it('rejects content after a completed keyed tabular root', () => {
      expect(() => decode('[2:]{a}:\n  x: 1\n  y: 2\nz: 3')).toThrow(ToonDecodingError);
    });

    it('rejects two depth-0 scalar lines', () => {
      expect(() => decode('hello\nworld')).toThrow(ToonDecodingError);
    });

    it('decodes a single scalar line as a root primitive', () => {
      expect(decode('hello')).toBe('hello');
      expect(decode('42')).toBe(42);
      expect(decode('true')).toBe(true);
    });
  });

  describe('values and cells (§4, §9.1)', () => {
    it('accepts both empty-array forms', () => {
      expect(decode('tags: []')).toEqual({ tags: [] });
      expect(decode('tags[0]:')).toEqual({ tags: [] });
    });

    it('decodes "[]" inside a row as the string "[]" (§9.3)', () => {
      expect(decode('a[1]{v}:\n  []')).toEqual({ a: [{ v: '[]' }] });
    });

    it('preserves empty tokens when splitting inline arrays (§11.2)', () => {
      expect(decode('a[3]: ,x,')).toEqual({ a: ['', 'x', ''] });
    });

    it('applies the §4 number grammar rather than a host parser', () => {
      expect(decode('a: 1.5000\nb: -1E+03\nc: -0\nd: 05\ne: .5\nf: 1.\ng: +5\nh: 0x10')).toEqual({
        a: 1.5,
        b: -1000,
        c: 0,
        d: '05',
        e: '.5',
        f: '1.',
        g: '+5',
        h: '0x10',
      });
    });

    it('rejects characters after a closing quote (§7.4)', () => {
      expect(() => decode('a: "x"y')).toThrow(ToonDecodingError);
    });

    it('accepts an unquoted token an encoder would have quoted (§7.4)', () => {
      expect(decode('key: -x')).toEqual({ key: '-x' });
    });

    it('accepts any unquoted key token, even outside §7.3 (§7.4)', () => {
      expect(decode('foo-bar: 1')).toEqual({ 'foo-bar': 1 });
      expect(decode('foo-bar[2]: 1,2')).toEqual({ 'foo-bar': [1, 2] });
    });
  });

  describe('duplicate sibling keys (§14.3)', () => {
    it('errors in strict mode', () => {
      expect(() => decode('a: 1\na: 2')).toThrow(ToonDecodingError);
    });

    it('applies last-write-wins in non-strict mode', () => {
      expect(decodeLax('a: 1\na: 2')).toEqual({ a: 2 });
    });

    it('treats keyed entry keys as sibling keys', () => {
      expect(() => decode('u[2:]{a}:\n  x: 1\n  x: 2')).toThrow(ToonDecodingError);
    });
  });

  describe('non-strict tolerance (§14.1)', () => {
    it('ignores count mismatches', () => {
      expect(decodeLax('tags[5]: a,b,c')).toEqual({ tags: ['a', 'b', 'c'] });
    });

    it('omits leaf fields with no remaining cell on a narrow row', () => {
      expect(decodeLax('a[1]{x,y}:\n  1')).toEqual({ a: [{ x: 1 }] });
    });

    it('ignores surplus cells on a wide row', () => {
      expect(decodeLax('a[1]{x}:\n  1,2')).toEqual({ a: [{ x: 1 }] });
    });
  });

  describe('encoder form selection (§1.4, §9)', () => {
    it('prefers tabular over list form when detection holds', () => {
      expect(encode([{ a: 1 }, { a: 2 }])).toBe('[2]{a}:\n  1\n  2');
    });

    it('falls back to list form when an array value appears in a column', () => {
      expect(encode([{ a: [1] }, { a: [2] }])).toBe('[2]:\n  - a[1]: 1\n  - a[1]: 2');
    });

    it('emits no trailing newline or trailing spaces (§12)', () => {
      const toon = encode({ a: 1, b: [1, 2], c: { d: 2 } });
      expect(toon.endsWith('\n')).toBe(false);
      for (const line of toon.split('\n')) {
        expect(line).toBe(line.replace(/ +$/, ''));
      }
    });

    it('round-trips deeply nested structures', () => {
      const value = {
        root: { level1: { level2: { level3: { items: [{ id: 1, val: 'a' }, { id: 2, val: 'b' }] } } } },
      };
      expect(decode(encode(value))).toEqual(value);
    });

    it('round-trips unicode and emoji unquoted where permitted (§16)', () => {
      const value = { message: 'Hello 世界 👋', tags: ['🎉', '🎊', '🎈'] };
      expect(encode(value)).toBe('message: Hello 世界 👋\ntags[3]: 🎉,🎊,🎈');
      expect(decode(encode(value))).toEqual(value);
    });
  });

  describe('delimiters (§11)', () => {
    it.each([
      ['tab', '\t' as const, 'items[2\t]{sku\tname}:\n  A1\tWidget\n  B2\tGadget'],
      ['pipe', '|' as const, 'items[2|]{sku|name}:\n  A1|Widget\n  B2|Gadget'],
    ])('encodes and decodes with the %s delimiter', (_label, delimiter, expected) => {
      const value = {
        items: [
          { sku: 'A1', name: 'Widget' },
          { sku: 'B2', name: 'Gadget' },
        ],
      };
      const toon = new ToonEncoder({ ...encoderOptions, delimiter }).encode(value);
      expect(toon).toBe(expected);
      expect(decode(toon)).toEqual(value);
    });

    it('treats non-active delimiters in cells as literal data (§6)', () => {
      expect(decode('a[1|]{x}:\n  1,2')).toEqual({ a: [{ x: '1,2' }] });
    });

    it('quotes cells containing the active delimiter (§11.1)', () => {
      expect(encode({ a: ['x|y'] })).toBe('a[1]: x|y');
      const piped = new ToonEncoder({ ...encoderOptions, delimiter: '|' }).encode({ a: ['x|y'] });
      expect(piped).toBe('a[1|]: "x|y"');
    });
  });

  describe('prototype-key safety (§15)', () => {
    it('materializes __proto__ as an ordinary own entry', () => {
      const result = decode('items[1]{__proto__}:\n  polluted') as {
        items: Record<string, unknown>[];
      };
      expect(Object.prototype.hasOwnProperty.call(result.items[0], '__proto__')).toBe(true);
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });
  });

  describe('blank lines and header spans (§12)', () => {
    it('errors on a blank line between tabular rows in strict mode', () => {
      expect(() => decode('a[2]{x}:\n  1\n\n  2')).toThrow(ToonDecodingError);
    });

    it('errors on a blank line between list items in strict mode', () => {
      expect(() => decode('a[2]:\n  - 1\n\n  - 2')).toThrow(ToonDecodingError);
    });

    it('errors on a blank line between keyed entry rows in strict mode', () => {
      expect(() => decode('u[2:]{x}:\n  a: 1\n\n  b: 2')).toThrow(ToonDecodingError);
    });

    it('ignores a blank line between a header and its first row', () => {
      expect(decode('a[2]{x}:\n\n  1\n  2')).toEqual({ a: [{ x: 1 }, { x: 2 }] });
    });

    it('ignores a blank line after a scope\'s content', () => {
      expect(decode('a[1]{x}:\n  1\n\nb: 2')).toEqual({ a: [{ x: 1 }], b: 2 });
    });

    it('ignores blank lines between top-level fields', () => {
      expect(decode('a: 1\n\nb: 2')).toEqual({ a: 1, b: 2 });
    });

    it('ignores blank lines inside a header span in non-strict mode', () => {
      expect(decodeLax('a[2]{x}:\n  1\n\n  2')).toEqual({ a: [{ x: 1 }, { x: 2 }] });
    });

    it('does not let a comment line count as a blank line (§5.1)', () => {
      expect(decode('a[2]{x}:\n  1\n# comment\n  2')).toEqual({ a: [{ x: 1 }, { x: 2 }] });
      expect(decode('a[2]{x}:\n  1\n# one\n# two\n  2')).toEqual({ a: [{ x: 1 }, { x: 2 }] });
    });

    it('still errors when a blank accompanies a comment inside a span', () => {
      expect(() => decode('a[2]{x}:\n  1\n\n# c\n  2')).toThrow(ToonDecodingError);
      expect(() => decode('a[2]{x}:\n  1\n# c\n\n  2')).toThrow(ToonDecodingError);
    });

    it('errors on a blank between a list-item object\'s own fields (§10, §12)', () => {
      expect(() => decode('a[1]:\n  - id: 1\n\n    n: 2')).toThrow(ToonDecodingError);
    });

    it('errors on a blank inside an object nested within a span', () => {
      expect(() => decode('a[1]:\n  - m:\n      x: 1\n\n      y: 2')).toThrow(ToonDecodingError);
      expect(() => decode('o:\n  u[2:]{x}:\n    a: 1\n\n    b: 2')).toThrow(ToonDecodingError);
    });

    it('allows blanks in plain object scopes outside any span', () => {
      expect(decode('a: 1\n\nb:\n\n  c: 2')).toEqual({ a: 1, b: { c: 2 } });
      expect(decode('a[1]:\n  - id: 1\n\nb: 2')).toEqual({ a: [{ id: 1 }], b: 2 });
    });
  });

  describe('numbers and escapes', () => {
    it('emits canonical decimal form inside the canonical range (§2)', () => {
      expect(encode({ a: 1e6 })).toBe('a: 1000000');
      expect(encode({ a: 1e-6 })).toBe('a: 0.000001');
      expect(encode({ a: 1.5000 })).toBe('a: 1.5');
      expect(encode({ a: 1.0 })).toBe('a: 1');
      expect(encode({ a: -0 })).toBe('a: 0');
    });

    it('may use exponent notation outside the canonical range (§2)', () => {
      expect(encode({ a: 1e21 })).toBe('a: 1e+21');
      expect(encode({ a: 1e-7 })).toBe('a: 1e-7');
    });

    it('escapes control characters and quotes per §7.1', () => {
      expect(encode({ a: '\u0001' })).toBe('a: "\\u0001"');
      expect(encode({ a: 'x\ty' })).toBe('a: "x\\ty"');
      expect(encode({ a: 'x\ny' })).toBe('a: "x\\ny"');
    });

    it('rejects invalid escapes and lone surrogates on decode (§7.1)', () => {
      expect(() => decode('a: "\\ud800"')).toThrow(ToonDecodingError);
      expect(() => decode('a: "\\q"')).toThrow(ToonDecodingError);
      expect(() => decode('a: "\\u12"')).toThrow(ToonDecodingError);
      expect(() => decode('a: "abc')).toThrow(ToonDecodingError);
    });

    it('normalizes NaN, Infinity, and undefined to null (§3)', () => {
      expect(encode({ a: NaN, b: Infinity, c: -Infinity, d: undefined })).toBe(
        'a: null\nb: null\nc: null\nd: null',
      );
    });

    it('honors toJSON() during normalization (§3)', () => {
      // The ISO string contains colons, so §7.2 requires quoting
      expect(encode({ a: new Date(Date.UTC(2025, 0, 1)) })).toBe(
        'a: "2025-01-01T00:00:00.000Z"',
      );
    });
  });

  describe('delimiter scoping (§11.2)', () => {
    it('does not inherit a parent delimiter into a nested header', () => {
      expect(decode('a[1|]:\n  - [2]: 1,2')).toEqual({ a: [[1, 2]] });
    });

    it('lets a nested header declare its own delimiter', () => {
      expect(decode('a[1]:\n  - [2|]: 1|2')).toEqual({ a: [[1, 2]] });
    });
  });

  describe('unrepresentable strings (§3)', () => {
    it.each([
      ['a lone high surrogate value', { a: '\uD800' }],
      ['a lone low surrogate value', { a: '\uDC00' }],
      ['a high surrogate not followed by a low one', { a: '\uD800A' }],
      ['a lone surrogate in a nested value', { a: [{ b: '\uD800x' }] }],
      ['a lone surrogate in a key', { '\uD800': 1 }],
    ])('errors rather than emitting %s', (_label, value) => {
      expect(() => encode(value)).toThrow(ToonEncodingError);
    });

    it('accepts valid surrogate pairs', () => {
      expect(encode({ a: '👋' })).toBe('a: 👋');
      expect(encode({ '👋': 1 })).toBe('"👋": 1');
    });
  });

  describe('encoder output invariants (§13.1)', () => {
    it('emits LF only, never CR', () => {
      expect(encode({ a: { b: 1 }, c: [1, 2] })).not.toContain('\r');
    });

    it('quotes keys needing quotes in every context, including headers (§7.3)', () => {
      expect(encode({ 'my-key': [1, 2] })).toBe('"my-key"[2]: 1,2');
      expect(encode({ 'ü': 1 })).toBe('"ü": 1');
      // Dots are permitted in the unquoted-key pattern
      expect(encode({ 'a.b': 1 })).toBe('a.b: 1');
    });

    it('never emits the bare "- []" item form (§9.2)', () => {
      expect(encode({ a: [[]] })).not.toContain('- []');
      expect(encode({ a: [[]] })).toBe('a[1]:\n  - [0]:');
    });

    it('still accepts "- []" on decode (§9.2)', () => {
      expect(decode('a[1]:\n  - []')).toEqual({ a: [[]] });
    });
  });

  describe('key order (§2)', () => {
    it('preserves object key encounter order', () => {
      expect(encode({ zebra: 1, apple: 2 })).toBe('zebra: 1\napple: 2');
      expect(Object.keys(decode('z: 1\na: 2\nm: 3') as object)).toEqual(['z', 'a', 'm']);
    });

    it('reorders tabular rows to the header field order', () => {
      const decoded = decode(encode([{ x: 1, y: 2 }, { y: 4, x: 3 }])) as Record<string, unknown>[];
      expect(Object.keys(decoded[1])).toEqual(['x', 'y']);
    });

    it('reorders keyed entry values to the header field order (§9.5)', () => {
      const decoded = decode(encode({ a: { p: 1, q: 2 }, b: { q: 4, p: 3 } })) as Record<
        string,
        Record<string, unknown>
      >;
      expect(Object.keys(decoded)).toEqual(['a', 'b']);
      expect(Object.keys(decoded.b)).toEqual(['p', 'q']);
    });

    it('preserves array order', () => {
      expect(decode('[3]: 3,1,2')).toEqual([3, 1, 2]);
    });
  });
});
