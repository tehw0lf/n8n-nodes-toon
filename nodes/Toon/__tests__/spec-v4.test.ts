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
      expect(() => decode('a: 1\n\t# not a comment')).toThrow();
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
  });

  describe('keyed tabular decoding (§9.5)', () => {
    it('accepts an entry count of zero', () => {
      expect(decode('key[0:]{f}:')).toEqual({ key: {} });
    });

    it('errors when the entry row count does not match N', () => {
      expect(() => decode('u[3:]{a}:\n  x: 1\n  y: 2')).toThrow();
    });

    it('errors when an entry row is too narrow', () => {
      expect(() => decode('u[1:]{a,b}:\n  x: 1')).toThrow();
    });

    it('treats a bare entry key as zero cells (§9.5)', () => {
      expect(() => decode('u[1:]{a}:\n  x:')).toThrow();
    });

    it('errors on a line at entry depth without an unquoted colon', () => {
      expect(() => decode('u[2:]{a}:\n  x: 1\n  bare')).toThrow();
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
      expect(() => decode('u[2:]:\n  x: 1\n  y: 2')).toThrow();
    });

    it('rejects a keyless keyed header outside root position (§14.2)', () => {
      expect(() => decode('a:\n  [2:]{f}:\n    x: 1\n    y: 2')).toThrow();
    });
  });

  describe('header grammar (§6, §14.2)', () => {
    it('rejects an empty field list', () => {
      expect(() => decode('a[1]{}:\n  1')).toThrow();
    });

    it('rejects a duplicated field name in one field list', () => {
      expect(() => decode('a[1]{x,x}:\n  1,2')).toThrow();
    });

    it('allows the same name at different nesting levels', () => {
      expect(decode('a[1]{x,n{x}}:\n  1,2')).toEqual({ a: [{ x: 1, n: { x: 2 } }] });
    });

    it('rejects leading zeros in the declared length', () => {
      expect(() => decode('a[03]: 1,2,3')).toThrow();
    });

    it('rejects whitespace between a key and its bracket segment', () => {
      expect(() => decode('foo [2]: 1,2')).toThrow();
    });

    it('rejects inline content after a fields-bearing header', () => {
      expect(() => decode('items[2]{a,b}: 1,2')).toThrow();
    });

    it('rejects a keyless header in object-field position', () => {
      expect(() => decode('a:\n  [2]: x,y')).toThrow();
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
      expect(() => decode('[1]: 1\nx: 2')).toThrow();
    });

    it('rejects content after a completed keyed tabular root', () => {
      expect(() => decode('[2:]{a}:\n  x: 1\n  y: 2\nz: 3')).toThrow();
    });

    it('rejects two depth-0 scalar lines', () => {
      expect(() => decode('hello\nworld')).toThrow();
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
      expect(() => decode('a: "x"y')).toThrow();
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
      expect(() => decode('a: 1\na: 2')).toThrow();
    });

    it('applies last-write-wins in non-strict mode', () => {
      expect(decodeLax('a: 1\na: 2')).toEqual({ a: 2 });
    });

    it('treats keyed entry keys as sibling keys', () => {
      expect(() => decode('u[2:]{a}:\n  x: 1\n  x: 2')).toThrow();
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
});
