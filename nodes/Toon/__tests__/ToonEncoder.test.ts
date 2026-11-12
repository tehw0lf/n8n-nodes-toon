/**
 * Tests for ToonEncoder - JSON to TOON conversion
 */

import { ToonEncoder } from '../ToonEncoder';
import type { EncoderOptions } from '../types';

describe('ToonEncoder', () => {
  // Default options for most tests
  const defaultOptions: EncoderOptions = {
    indent: 2,
    delimiter: ',',
    keyFolding: 'off',
    flattenDepth: 999,
  };

  describe('encode primitives', () => {
    it('should encode null', () => {
      const encoder = new ToonEncoder(defaultOptions);
      expect(encoder.encode(null)).toBe('null');
    });

    it('should encode undefined as null', () => {
      const encoder = new ToonEncoder(defaultOptions);
      expect(encoder.encode(undefined)).toBe('null');
    });

    it('should encode true', () => {
      const encoder = new ToonEncoder(defaultOptions);
      expect(encoder.encode(true)).toBe('true');
    });

    it('should encode false', () => {
      const encoder = new ToonEncoder(defaultOptions);
      expect(encoder.encode(false)).toBe('false');
    });

    it('should encode integers', () => {
      const encoder = new ToonEncoder(defaultOptions);
      expect(encoder.encode(0)).toBe('0');
      expect(encoder.encode(42)).toBe('42');
      expect(encoder.encode(-5)).toBe('-5');
    });

    it('should encode decimals', () => {
      const encoder = new ToonEncoder(defaultOptions);
      expect(encoder.encode(3.14)).toBe('3.14');
      expect(encoder.encode(0.5)).toBe('0.5');
      expect(encoder.encode(-2.5)).toBe('-2.5');
    });

    it('should encode -0 as 0', () => {
      const encoder = new ToonEncoder(defaultOptions);
      expect(encoder.encode(-0)).toBe('0');
    });

    it('should encode NaN as null', () => {
      const encoder = new ToonEncoder(defaultOptions);
      expect(encoder.encode(NaN)).toBe('null');
    });

    it('should encode Infinity as null', () => {
      const encoder = new ToonEncoder(defaultOptions);
      expect(encoder.encode(Infinity)).toBe('null');
      expect(encoder.encode(-Infinity)).toBe('null');
    });

    it('should encode plain strings without quotes', () => {
      const encoder = new ToonEncoder(defaultOptions);
      expect(encoder.encode('hello')).toBe('hello');
      expect(encoder.encode('world123')).toBe('world123');
    });

    it('should encode strings that need quoting', () => {
      const encoder = new ToonEncoder(defaultOptions);
      expect(encoder.encode('')).toBe('""');
      expect(encoder.encode('true')).toBe('"true"');
      expect(encoder.encode('false')).toBe('"false"');
      expect(encoder.encode('null')).toBe('"null"');
      expect(encoder.encode('42')).toBe('"42"');
    });

    it('should encode strings with special characters', () => {
      const encoder = new ToonEncoder(defaultOptions);
      expect(encoder.encode('hello\nworld')).toBe('"hello\\nworld"');
      expect(encoder.encode('say "hello"')).toBe('"say \\"hello\\""');
      expect(encoder.encode('path\\to\\file')).toBe('"path\\\\to\\\\file"');
    });
  });

  describe('encode objects', () => {
    it('should encode flat object', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = { name: 'Alice', age: 30 };
      const result = encoder.encode(input);
      // Keys are in insertion order
      expect(result).toBe('name: Alice\nage: 30');
    });

    it('should encode object with various value types', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        name: 'Bob',
        active: true,
        count: 42,
        value: null,
      };
      const result = encoder.encode(input);
      expect(result).toContain('name: Bob');
      expect(result).toContain('active: true');
      expect(result).toContain('count: 42');
      expect(result).toContain('value: null');
    });

    it('should encode nested object', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        user: {
          name: 'Charlie',
          age: 25,
        },
      };
      const result = encoder.encode(input);
      expect(result).toContain('user:');
      expect(result).toContain('  name: Charlie');
      expect(result).toContain('  age: 25');
    });

    it('should encode empty object', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const result = encoder.encode({});
      expect(result).toBe('');
    });

    it('should handle object keys that need quoting', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        'first-name': 'Dave',
        'my key': 'value',
        '123': 'numeric',
      };
      const result = encoder.encode(input);
      expect(result).toContain('"123": numeric');
      expect(result).toContain('"first-name": Dave');
      expect(result).toContain('"my key": value');
    });

    it('should use proper indentation for nested objects', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        level1: {
          level2: {
            level3: 'deep',
          },
        },
      };
      const result = encoder.encode(input);
      expect(result).toContain('level1:');
      expect(result).toContain('  level2:');
      expect(result).toContain('    level3: deep');
    });
  });

  describe('encode primitive arrays', () => {
    it('should encode inline array of numbers', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = [1, 2, 3];
      const result = encoder.encode(input);
      expect(result).toBe('[3]: 1,2,3');
    });

    it('should encode inline array of strings', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = ['a', 'b', 'c'];
      const result = encoder.encode(input);
      expect(result).toBe('[3]: a,b,c');
    });

    it('should encode inline array of mixed primitives', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = [1, 'two', true, null];
      const result = encoder.encode(input);
      expect(result).toBe('[4]: 1,two,true,null');
    });

    it('should keep long primitive arrays inline per §9.1', () => {
      const encoder = new ToonEncoder(defaultOptions);
      // §9.1 has no line-length threshold: primitive arrays are always inline
      const input = ['very-long-string-that-will-definitely-exceed-eighty-characters-on-one-line', 'another-item'];
      const result = encoder.encode(input);
      expect(result).toBe(
        '[2]: very-long-string-that-will-definitely-exceed-eighty-characters-on-one-line,another-item',
      );
    });

    it('should encode array as object property (inline)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = { numbers: [1, 2, 3] };
      const result = encoder.encode(input);
      expect(result).toBe('numbers[3]: 1,2,3');
    });

    it('should encode empty array in object field position as "key: []" (§9.1)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const result = encoder.encode({ tags: [] });
      expect(result).toBe('tags: []');
    });

    it('should encode empty root array as bare "[]" (§9.1)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const result = encoder.encode([]);
      expect(result).toBe('[]');
    });
  });

  describe('encode tabular arrays', () => {
    it('should encode uniform array of objects as tabular', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      const result = encoder.encode(input);
      expect(result).toBe('[2]{name,age}:\n  Alice,30\n  Bob,25');
    });

    it('should use the first object key encounter order for fields (§9.3)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = [
        { x: 1, y: 2 },
        { y: 4, x: 3 },
      ];
      const result = encoder.encode(input);
      // Field order follows the first object; later objects are reordered to match
      expect(result).toBe('[2]{x,y}:\n  1,2\n  3,4');
    });

    it('should encode tabular array as object property', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        users: [
          { name: 'Alice', active: true },
          { name: 'Bob', active: false },
        ],
      };
      const result = encoder.encode(input);
      expect(result).toBe('users[2]{name,active}:\n  Alice,true\n  Bob,false');
    });

    it('should handle tabular array with null values', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = [
        { a: 1, b: null },
        { a: null, b: 2 },
      ];
      const result = encoder.encode(input);
      expect(result).toBe('[2]{a,b}:\n  1,null\n  null,2');
    });

    it('should collapse nested-uniform columns into nested field groups (§9.3)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        orders: [
          { id: 1, customer: { name: 'Ada', country: 'DK' }, total: 99 },
          { id: 2, customer: { name: 'Bob', country: 'UK' }, total: 149 },
        ],
      };
      const result = encoder.encode(input);
      expect(result).toBe('orders[2]{id,customer{name,country},total}:\n  1,Ada,DK,99\n  2,Bob,UK,149');
    });

    it('should not use tabular form when a column mixes null with objects (§9.3)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = [{ a: { x: 1 } }, { a: null }];
      const result = encoder.encode(input);
      // A column that is neither uniform-primitive nor nested-uniform forces list form
      expect(result).toBe('[2]:\n  - a:\n      x: 1\n  - a: null');
    });

    it('should not use tabular form for arrays containing an empty object (§9.3)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const result = encoder.encode([{}, { a: 1 }]);
      expect(result).toBe('[2]:\n  -\n  - a: 1');
    });
  });

  describe('encode keyed tabular objects (§9.5)', () => {
    it('should encode an object of uniform objects as a keyed table', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        users: {
          alice: { age: 30, city: 'Berlin' },
          bob: { age: 25, city: 'Oslo' },
        },
      };
      const result = encoder.encode(input);
      expect(result).toBe('users[2:]{age,city}:\n  alice: 30,Berlin\n  bob: 25,Oslo');
    });

    it('should omit the key at the document root (§9.5)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        alice: { age: 30, city: 'Berlin' },
        bob: { age: 25, city: 'Oslo' },
      };
      const result = encoder.encode(input);
      expect(result).toBe('[2:]{age,city}:\n  alice: 30,Berlin\n  bob: 25,Oslo');
    });

    it('should not use keyed form for a single-entry object (§9.5)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const result = encoder.encode({ users: { alice: { age: 30 } } });
      expect(result).toBe('users:\n  alice:\n    age: 30');
    });

    it('should not use keyed form when entry values are non-uniform (§9.5)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const result = encoder.encode({ a: { x: 1 }, b: { y: 2 } });
      expect(result).toBe('a:\n  x: 1\nb:\n  y: 2');
    });

    it('should support nested field groups in keyed headers (§9.5)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        alice: { age: 30, loc: { city: 'Berlin', country: 'DE' } },
        bob: { age: 25, loc: { city: 'Oslo', country: 'NO' } },
      };
      const result = encoder.encode(input);
      expect(result).toBe('[2:]{age,loc{city,country}}:\n  alice: 30,Berlin,DE\n  bob: 25,Oslo,NO');
    });

    it('should quote entry keys that require quoting (§7.3)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        'my-key': { a: 1 },
        other: { a: 2 },
      };
      const result = encoder.encode(input);
      expect(result).toBe('[2:]{a}:\n  "my-key": 1\n  other: 2');
    });
  });

  describe('encode mixed arrays', () => {
    it('should encode array with mixed types (primitives and objects)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = [1, { name: 'Alice' }, 'text'];
      const result = encoder.encode(input);
      expect(result).toBe('[3]:\n  - 1\n  - name: Alice\n  - text');
    });

    it('should encode nested arrays', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = [[1, 2], [3, 4]];
      const result = encoder.encode(input);
      expect(result).toBe('[2]:\n  - [2]: 1,2\n  - [2]: 3,4');
    });

    it('should encode array of non-uniform objects', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', city: 'NYC' },
      ];
      const result = encoder.encode(input);
      // Non-uniform objects use list form with the first field on the hyphen line (§10)
      expect(result).toBe('[2]:\n  - name: Alice\n    age: 30\n  - name: Bob\n    city: NYC');
    });

    it('should encode an empty inner array as "- [0]:" (§9.2)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const result = encoder.encode([[], [1]]);
      expect(result).toBe('[2]:\n  - [0]:\n  - [1]: 1');
    });
  });

  describe('objects as list items (§10)', () => {
    it('should place the first field on the hyphen line', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        items: [
          { id: 1, name: 'First' },
          { id: 2, name: 'Second', extra: true },
        ],
      };
      const result = encoder.encode(input);
      expect(result).toBe(
        'items[2]:\n  - id: 1\n    name: First\n  - id: 2\n    name: Second\n    extra: true',
      );
    });

    it('should emit a bare hyphen for an empty object list item', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const result = encoder.encode({ items: [{}, {}] });
      expect(result).toBe('items[2]:\n  -\n  -');
    });

    it('should carry a tabular first field on the hyphen line with rows at depth +2', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        items: [
          {
            users: [
              { id: 1, name: 'Ada' },
              { id: 2, name: 'Bob' },
            ],
            status: 'active',
          },
        ],
      };
      const result = encoder.encode(input);
      expect(result).toBe(
        'items[1]:\n  - users[2]{id,name}:\n      1,Ada\n      2,Bob\n    status: active',
      );
    });

    it('should carry a keyed tabular first field on the hyphen line (§10)', () => {
      const encoder = new ToonEncoder(defaultOptions);
      // The second element's differing key set defeats tabular detection (§9.3),
      // so the array uses list form and §10 governs the first field
      const input = {
        items: [
          {
            users: { alice: { age: 30 }, bob: { age: 25 } },
            status: 'active',
          },
          { other: 1 },
        ],
      };
      const result = encoder.encode(input);
      expect(result).toBe(
        'items[2]:\n  - users[2:]{age}:\n      alice: 30\n      bob: 25\n    status: active\n  - other: 1',
      );
    });

    it('should nest an object-valued first field at depth +2', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const result = encoder.encode({ items: [{ meta: { a: 1 }, b: 2 }, { other: 1 }] });
      expect(result).toBe('items[2]:\n  - meta:\n      a: 1\n    b: 2\n  - other: 1');
    });
  });

  describe('delimiter handling', () => {
    it('should use comma delimiter by default', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, delimiter: ',' });
      const input = [1, 2, 3];
      const result = encoder.encode(input);
      expect(result).toBe('[3]: 1,2,3');
    });

    it('should use tab delimiter', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, delimiter: '\t' });
      const input = [1, 2, 3];
      const result = encoder.encode(input);
      expect(result).toBe('[3\t]: 1\t2\t3');
    });

    it('should use pipe delimiter', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, delimiter: '|' });
      const input = [1, 2, 3];
      const result = encoder.encode(input);
      expect(result).toBe('[3|]: 1|2|3');
    });

    it('should quote strings containing comma when using comma delimiter', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, delimiter: ',' });
      const input = ['a,b', 'c'];
      const result = encoder.encode(input);
      expect(result).toBe('[2]: "a,b",c');
    });

    it('should quote strings containing tab when using tab delimiter', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, delimiter: '\t' });
      const input = ['a\tb', 'c'];
      const result = encoder.encode(input);
      expect(result).toBe('[2\t]: "a\\tb"\tc');
    });

    it('should quote strings containing pipe when using pipe delimiter', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, delimiter: '|' });
      const input = ['a|b', 'c'];
      const result = encoder.encode(input);
      expect(result).toBe('[2|]: "a|b"|c');
    });

    it('should use delimiter in tabular arrays', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, delimiter: '|' });
      const input = [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ];
      const result = encoder.encode(input);
      expect(result).toContain('[2|]{a|b}:');
      expect(result).toContain('  1|2');
      expect(result).toContain('  3|4');
    });
  });

  describe('key folding', () => {
    describe('collision with a literal sibling key', () => {
      const safe = (extra: Partial<EncoderOptions> = {}) =>
        new ToonEncoder({ ...defaultOptions, keyFolding: 'safe', ...extra });

      it('keeps both values when the literal key comes first', () => {
        const out = safe().encode({ 'a.b': 1, a: { b: 2 } });
        expect(out).toBe('"a.b": 1\na:\n  b: 2');
      });

      it('keeps both values when the chain comes first', () => {
        const out = safe().encode({ a: { b: 2 }, 'a.b': 1 });
        expect(out).toBe('a:\n  b: 2\n"a.b": 1');
      });

      it('applies inside a nested object', () => {
        const out = safe().encode({ x: { 'a.b': 1, a: { b: 2 } } });
        expect(out).toBe('x:\n  "a.b": 1\n  a:\n    b: 2');
      });

      it('applies to a chain cut by flattenDepth', () => {
        const out = safe({ flattenDepth: 2 }).encode({
          'a.b': 1,
          a: { b: { c: 2 } },
        });
        expect(out).toBe('"a.b": 1\na:\n  b.c: 2');
      });

      it('applies to a full-length chain', () => {
        const out = safe().encode({ 'a.b.c': 1, a: { b: { c: 2 } } });
        expect(out).toBe('"a.b.c": 1\na:\n  b.c: 2');
      });

      it('still folds a chain without a colliding sibling', () => {
        const out = safe().encode({ 'x.y': 1, a: { b: 2 } });
        expect(out).toBe('"x.y": 1\na.b: 2');
      });
    });

    it('should not fold keys when keyFolding is off', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'off' });
      const input = {
        level1: {
          level2: {
            value: 42,
          },
        },
      };
      const result = encoder.encode(input);
      expect(result).toContain('level1:');
      expect(result).toContain('  level2:');
      expect(result).toContain('    value: 42');
    });

    it('should fold single-key chains when keyFolding is safe', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe' });
      const input = {
        level1: {
          level2: {
            value: 42,
          },
        },
      };
      const result = encoder.encode(input);
      expect(result).toContain('level1.level2.value: 42');
    });

    it('should not fold keys with multiple branches', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe' });
      const input = {
        root: {
          child1: 'a',
          child2: 'b',
        },
      };
      const result = encoder.encode(input);
      expect(result).toContain('root:');
      expect(result).toContain('  child1: a');
      expect(result).toContain('  child2: b');
    });

    it('should respect flattenDepth limit', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe', flattenDepth: 2 });
      const input = {
        a: {
          b: {
            c: {
              d: 'deep',
            },
          },
        },
      };
      const result = encoder.encode(input);
      // Should only fold up to 2 levels
      expect(result).toContain('a.b:');
      expect(result).toContain('  c:');
      expect(result).toContain('    d: deep');
    });

    it('should fold chains inside the multi-key leaf of a folded chain', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe', flattenDepth: 999 });
      const input = { a: { b: { c: { d: 1 }, e: { f: 2 } } } };
      expect(encoder.encode(input)).toBe('a.b:\n  c.d: 1\n  e.f: 2');
    });

    it('should fold inside the multi-key leaf when the chain reached flattenDepth', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe', flattenDepth: 2 });
      const input = { a: { b: { c: { d: 1 }, e: { f: 2 } } } };
      expect(encoder.encode(input)).toBe('a.b:\n  c.d: 1\n  e.f: 2');
    });

    it('should keep a literal dotted key and the colliding chain inside a folded leaf, in both key orders', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe', flattenDepth: 999 });
      const literalFirst = { a: { b: { 'c.d': 5, c: { d: 1 } } } };
      const chainFirst = { a: { b: { c: { d: 1 }, 'c.d': 5 } } };
      for (const input of [literalFirst, chainFirst]) {
        const result = encoder.encode(input);
        expect(result).toContain('5');
        expect(result).toContain('1');
      }
      expect(encoder.encode(literalFirst)).toBe('a.b:\n  "c.d": 5\n  c:\n    d: 1');
      expect(encoder.encode(chainFirst)).toBe('a.b:\n  c:\n    d: 1\n  "c.d": 5');
    });

    it('should leave a single-key leaf cut by flattenDepth nested', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe', flattenDepth: 2 });
      const input = { a: { b: { c: { d: { e: 1 } } } } };
      expect(encoder.encode(input)).toBe('a.b:\n  c:\n    d:\n      e: 1');
    });

    it('should fold inside the object at the end of a flattenDepth-cut remainder', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe', flattenDepth: 2 });
      expect(encoder.encode({ a: { b: { c: { d: { e: 1 }, f: { g: 2 } } } } })).toBe(
        'a.b:\n  c:\n    d.e: 1\n    f.g: 2',
      );
      expect(encoder.encode({ a: { b: { c: { d: { p: { q: 1 }, r: { s: 2 } } } } } })).toBe(
        'a.b:\n  c:\n    d:\n      p.q: 1\n      r.s: 2',
      );
    });

    it('should keep a literal dotted key quoted in a cut remainder', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe', flattenDepth: 2 });
      const input = { a: { b: { 'c.d': { x: { y: 1 }, z: 2 } } } };
      expect(encoder.encode(input)).toBe('a.b:\n  "c.d":\n    x.y: 1\n    z: 2');
    });

    it('should fold inside an unsafe-key object at the end of a cut remainder', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe', flattenDepth: 2 });
      const input = { a: { b: { c: { constructor: { p: { q: 1 } } } } } };
      expect(encoder.encode(input)).toBe('a.b:\n  c:\n    constructor:\n      p.q: 1');
    });

    it('should fold inside a leaf whose only key is unsafe, like the non-chain branch', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe', flattenDepth: 999 });
      const input = { a: { b: { constructor: { p: { q: 1 } } } } };
      expect(encoder.encode(input)).toBe('a.b:\n  constructor:\n    p.q: 1');
      const sibling = { x: { constructor: { p: { q: 1 } } }, y: 1 };
      expect(encoder.encode(sibling)).toBe('x:\n  constructor:\n    p.q: 1\ny: 1');
    });

    it('should fold nested chains ending in another multi-key object', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe', flattenDepth: 999 });
      const input = { a: { b: { c: { d: { x: 1, y: 2 } }, e: 3 } } };
      expect(encoder.encode(input)).toBe('a.b:\n  c.d:\n    x: 1\n    y: 2\n  e: 3');
    });

    it('should not fold keys with unsafe characters', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe' });
      const input = {
        'parent': {
          'child-key': {
            value: 42,
          },
        },
      };
      const result = encoder.encode(input);
      // 'child-key' contains hyphen, which might not be safe for folding
      // depending on isIdentifierSegment implementation
      expect(result).toContain('parent:');
    });

    describe('literal dotted keys', () => {
      const fold = new ToonEncoder({ ...defaultOptions, keyFolding: 'safe' });
      const off = new ToonEncoder(defaultOptions);

      it('quotes a literal dotted key of a nested object', () => {
        const input = { x: { 'c.d': 1 }, y: 1 };
        expect(fold.encode(input)).toBe('x:\n  "c.d": 1\ny: 1');
        expect(off.encode(input)).toBe('x:\n  c.d: 1\ny: 1');
      });

      it('quotes a literal dotted root key and header key', () => {
        expect(fold.encode({ 'c.d': 1 })).toBe('"c.d": 1');
        expect(fold.encode({ 'k.l': [1, 2] })).toBe('"k.l"[2]: 1,2');
        expect(off.encode({ 'k.l': [1, 2] })).toBe('k.l[2]: 1,2');
      });

      it('quotes keyed table entry keys and field names', () => {
        const entries = { t: { 'a.b': { x: 1 }, 'c.e': { x: 2 } } };
        expect(fold.encode(entries)).toBe('t[2:]{x}:\n  "a.b": 1\n  "c.e": 2');
        expect(off.encode(entries)).toBe('t[2:]{x}:\n  a.b: 1\n  c.e: 2');

        const fields = { t: { r1: { 'p.q': 1, z: 1 }, r2: { 'p.q': 2, z: 2 } } };
        expect(fold.encode(fields)).toBe('t[2:]{"p.q",z}:\n  r1: 1,1\n  r2: 2,2');
        expect(off.encode(fields)).toBe('t[2:]{p.q,z}:\n  r1: 1,1\n  r2: 2,2');
      });

      it('quotes a literal key inside the leaf of a folded chain', () => {
        expect(fold.encode({ a: { b: { 'c.d': 1, e: 1 } } })).toBe(
          'a.b:\n  "c.d": 1\n  e: 1',
        );
      });

      it('leaves folded keys unquoted', () => {
        expect(fold.encode({ a: { b: { c: 1 } } })).toBe('a.b.c: 1');
      });

      it('leaves dotted keys inside arrays unquoted', () => {
        expect(fold.encode({ arr: [{ 'c.d': 1, e: 2 }, { f: 1 }] })).toBe(
          'arr[2]:\n  - c.d: 1\n    e: 2\n  - f: 1',
        );
      });

      it('leaves dotted keys that expansion would not split unquoted', () => {
        expect(fold.encode({ x: { 'a..b': 1, 'x.1': 2 } })).toBe('x:\n  a..b: 1\n  x.1: 2');
      });

      it('writes a keyed table in nested form when a field is literal in one entry and folded in another', () => {
        const input = { t: { r1: { 'p.q': 1, z: 1 }, r2: { p: { q: 2 }, z: 2 } } };
        const text = fold.encode(input);
        expect(text).not.toContain('[2:]');
        expect(text).toContain('"p.q": 1');
        expect(text).toContain('p.q: 2');
      });

      it('writes a keyed table in nested form when a nested field group disagrees', () => {
        const input = {
          t: {
            r1: { p: { 'x.y': 1, w: 1 }, z: 1 },
            r2: { p: { x: { y: 2 }, w: 2 }, z: 2 },
          },
        };
        const text = fold.encode(input);
        expect(text).not.toContain('[2:]');
        expect(text).toContain('"x.y": 1');
      });
    });
  });

  describe('indentation', () => {
    it('should use 2-space indentation by default', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, indent: 2 });
      const input = {
        level1: {
          level2: 'value',
        },
      };
      const result = encoder.encode(input);
      expect(result).toContain('level1:');
      expect(result).toContain('  level2: value');
    });

    it('should use 4-space indentation', () => {
      const encoder = new ToonEncoder({ ...defaultOptions, indent: 4 });
      const input = {
        level1: {
          level2: 'value',
        },
      };
      const result = encoder.encode(input);
      expect(result).toContain('level1:');
      expect(result).toContain('    level2: value');
    });

    it('should not have trailing spaces', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = { key: 'value' };
      const result = encoder.encode(input);
      // Check no trailing spaces on any line
      const lines = result.split('\n');
      for (const line of lines) {
        expect(line).not.toMatch(/ $/);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty string values', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = { key: '' };
      const result = encoder.encode(input);
      expect(result).toBe('key: ""');
    });

    it('should handle objects with no enumerable properties', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = Object.create(null);
      const result = encoder.encode(input);
      expect(result).toBe('');
    });

    it('should handle arrays with null and undefined', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = [null, undefined, 1];
      const result = encoder.encode(input);
      expect(result).toBe('[3]: null,null,1');
    });

    it('should handle deeply nested structures', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        a: {
          b: {
            c: {
              d: {
                e: 'deep',
              },
            },
          },
        },
      };
      const result = encoder.encode(input);
      expect(result).toContain('a:');
      expect(result).toContain('  b:');
      expect(result).toContain('    c:');
      expect(result).toContain('      d:');
      expect(result).toContain('        e: deep');
    });

    it('should normalize function values to null', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = { func: () => {} };
      const result = encoder.encode(input);
      expect(result).toBe('func: null');
    });

    it('should handle large numbers correctly', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = { big: 9007199254740991, small: -9007199254740991 };
      const result = encoder.encode(input);
      expect(result).toContain('big: 9007199254740991');
      expect(result).toContain('small: -9007199254740991');
    });

    it('should handle values with special characters', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        newline: 'line1\nline2',
        tab: 'col1\tcol2',
        quote: 'say "hi"',
      };
      const result = encoder.encode(input);
      expect(result).toContain('newline: "line1\\nline2"');
      expect(result).toContain('tab: "col1\\tcol2"');
      expect(result).toContain('quote: "say \\"hi\\""');
    });
  });

  describe('complex structures', () => {
    it('should encode realistic user data', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        user: {
          id: 123,
          name: 'Alice',
          email: 'alice@example.com',
          active: true,
          tags: ['admin', 'verified'],
        },
      };
      const result = encoder.encode(input);
      expect(result).toContain('user:');
      expect(result).toContain('  id: 123');
      expect(result).toContain('  name: Alice');
      expect(result).toContain('  email: alice@example.com');
      expect(result).toContain('  active: true');
      expect(result).toContain('  tags[2]: admin,verified');
    });

    it('should encode data with multiple tabular arrays', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
        products: [
          { id: 1, price: 10.5 },
          { id: 2, price: 20.0 },
        ],
      };
      const result = encoder.encode(input);
      expect(result).toContain('users[2]{name,age}:');
      expect(result).toContain('products[2]{id,price}:');
    });

    it('should encode mixed nested structure', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const input = {
        metadata: {
          version: '1.0',
          created: '2024-01-01',
        },
        items: [
          { id: 1, value: 'first' },
          { id: 2, value: 'second' },
        ],
        flags: [true, false, true],
      };
      const result = encoder.encode(input);
      expect(result).toContain('metadata:');
      // "1.0" is quoted because it looks like a number
      expect(result).toContain('  version: "1.0"');
      expect(result).toContain('  created: 2024-01-01');
      expect(result).toContain('items[2]{id,value}:');
      expect(result).toContain('flags[3]: true,false,true');
    });
  });

  describe('toJSON() hook (§3 v3.0.3)', () => {
    it('should call toJSON() before normalization', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const obj = {
        toJSON() {
          return { name: 'Alice', age: 30 };
        },
      };
      expect(encoder.encode(obj)).toBe('name: Alice\nage: 30');
    });

    it('should recursively normalize toJSON() result', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const obj = {
        toJSON() {
          return { date: new Date('2024-01-01T00:00:00.000Z') };
        },
      };
      // Date has its own toJSON() which returns ISO string (quoted because it contains colons)
      expect(encoder.encode(obj)).toBe('date: "2024-01-01T00:00:00.000Z"');
    });

    it('should not infinitely recurse when toJSON() returns itself', () => {
      const encoder = new ToonEncoder(defaultOptions);
      const obj: Record<string, unknown> = { value: 42 };
      obj['toJSON'] = () => obj; // returns same object
      // Should fall back to plain object normalization
      expect(encoder.encode(obj)).toContain('value: 42');
    });
  });
});
