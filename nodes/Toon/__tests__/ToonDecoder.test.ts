/**
 * Tests for ToonDecoder - TOON to JSON conversion
 */

import { ToonDecoder } from '../ToonDecoder';
import type { DecoderOptions } from '../types';
import { ToonDecodingError } from '../types';

describe('ToonDecoder', () => {
  // Default options for most tests
  const defaultOptions: DecoderOptions = {
    indent: 2,
    strict: false,
    expandPaths: 'off',
  };

  describe('decode primitives', () => {
    it('should decode null', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('null')).toBe(null);
    });

    it('should decode true', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('true')).toBe(true);
    });

    it('should decode false', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('false')).toBe(false);
    });

    it('should decode integers', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('0')).toBe(0);
      expect(decoder.decode('42')).toBe(42);
      expect(decoder.decode('-5')).toBe(-5);
    });

    it('should decode decimals', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('3.14')).toBe(3.14);
      expect(decoder.decode('0.5')).toBe(0.5);
      expect(decoder.decode('-2.5')).toBe(-2.5);
    });

    it('should decode unquoted strings', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('hello')).toBe('hello');
      expect(decoder.decode('world123')).toBe('world123');
    });

    it('should decode quoted strings', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('""')).toBe('');
      expect(decoder.decode('"hello world"')).toBe('hello world');
    });

    it('should decode quoted reserved words', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('"true"')).toBe('true');
      expect(decoder.decode('"false"')).toBe('false');
      expect(decoder.decode('"null"')).toBe('null');
      expect(decoder.decode('"42"')).toBe('42');
    });

    it('should decode strings with escape sequences', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('"hello\\nworld"')).toBe('hello\nworld');
      expect(decoder.decode('"say \\"hello\\""')).toBe('say "hello"');
      expect(decoder.decode('"path\\\\to\\\\file"')).toBe('path\\to\\file');
      expect(decoder.decode('"tab\\there"')).toBe('tab\there');
      expect(decoder.decode('"line1\\rline2"')).toBe('line1\rline2');
    });

    it('should decode empty input as null', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('')).toBe(null);
      expect(decoder.decode('  \n  \n  ')).toBe(null);
    });
  });

  describe('decode objects', () => {
    it('should decode flat object', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = 'name: Alice\nage: 30';
      const result = decoder.decode(toon);
      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    it('should decode object with various value types', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = 'name: Bob\nactive: true\ncount: 42\nvalue: null';
      const result = decoder.decode(toon);
      expect(result).toEqual({
        name: 'Bob',
        active: true,
        count: 42,
        value: null,
      });
    });

    it('should decode nested object', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = 'user:\n  name: Charlie\n  age: 25';
      const result = decoder.decode(toon);
      expect(result).toEqual({
        user: {
          name: 'Charlie',
          age: 25,
        },
      });
    });

    it('should decode deeply nested object', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = 'a:\n  b:\n    c:\n      d: deep';
      const result = decoder.decode(toon);
      expect(result).toEqual({
        a: {
          b: {
            c: {
              d: 'deep',
            },
          },
        },
      });
    });

    it('should decode object with quoted keys', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '"first-name": Dave\n"my key": value\n"123": numeric';
      const result = decoder.decode(toon);
      expect(result).toEqual({
        'first-name': 'Dave',
        'my key': 'value',
        '123': 'numeric',
      });
    });

    it('should decode object with quoted string values', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = 'key1: ""\nkey2: "true"\nkey3: "42"';
      const result = decoder.decode(toon);
      expect(result).toEqual({
        key1: '',
        key2: 'true',
        key3: '42',
      });
    });
  });

  describe('decode primitive arrays', () => {
    it('should decode inline array of numbers', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[3]: 1, 2, 3';
      const result = decoder.decode(toon);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should decode inline array of strings', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[3]: a, b, c';
      const result = decoder.decode(toon);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should decode inline array of mixed primitives', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[4]: 1, two, true, null';
      const result = decoder.decode(toon);
      expect(result).toEqual([1, 'two', true, null]);
    });

    it('should decode expanded array', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[3]:\n  1\n  2\n  3';
      const result = decoder.decode(toon);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should decode empty array inline', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[0]: ';
      const result = decoder.decode(toon);
      expect(result).toEqual([]);
    });

    it('should decode empty array expanded', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[0]:';
      const result = decoder.decode(toon);
      expect(result).toEqual([]);
    });

    it('should decode array as object property (inline)', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = 'numbers[3]: 1, 2, 3';
      const result = decoder.decode(toon);
      expect(result).toEqual({ numbers: [1, 2, 3] });
    });

    it('should decode array as object property (expanded)', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = 'items[2]:\n  first\n  second';
      const result = decoder.decode(toon);
      expect(result).toEqual({ items: ['first', 'second'] });
    });

    it('should decode array with quoted strings', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[3]: "a,b", c, "true"';
      const result = decoder.decode(toon);
      expect(result).toEqual(['a,b', 'c', 'true']);
    });
  });

  describe('decode tabular arrays', () => {
    it('should decode tabular array', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[2]{name, age}:\n  Alice, 30\n  Bob, 25';
      const result = decoder.decode(toon);
      expect(result).toEqual([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]);
    });

    it('should decode tabular array with null values', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[2]{a, b}:\n  1, null\n  null, 2';
      const result = decoder.decode(toon);
      expect(result).toEqual([
        { a: 1, b: null },
        { a: null, b: 2 },
      ]);
    });

    it('should decode tabular array as object property', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = 'users[2]{name, active}:\n  Alice, true\n  Bob, false';
      const result = decoder.decode(toon);
      expect(result).toEqual({
        users: [
          { name: 'Alice', active: true },
          { name: 'Bob', active: false },
        ],
      });
    });

    it('should decode tabular array with quoted fields', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[2]{"first-name", age}:\n  Alice, 30\n  Bob, 25';
      const result = decoder.decode(toon);
      expect(result).toEqual([
        { 'first-name': 'Alice', age: 30 },
        { 'first-name': 'Bob', age: 25 },
      ]);
    });
  });

  describe('decode mixed arrays', () => {
    it('should decode array with mixed types', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[3]:\n  1\n  name: Alice\n  text';
      const result = decoder.decode(toon);
      expect(result).toEqual([1, { name: 'Alice' }, 'text']);
    });

    it('should decode nested arrays', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[2]:\n  [2]: 1, 2\n  [2]: 3, 4';
      const result = decoder.decode(toon);
      expect(result).toEqual([[1, 2], [3, 4]]);
    });

    it('should decode array of objects (non-uniform)', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[2]:\n  name: Alice\n  age: 30\n  name: Bob\n  city: NYC';
      const result = decoder.decode(toon);
      expect(result).toEqual([
        { name: 'Alice', age: 30 },
        { name: 'Bob', city: 'NYC' },
      ]);
    });
  });

  describe('delimiter handling', () => {
    it('should decode comma-delimited array', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[3]: 1, 2, 3';
      const result = decoder.decode(toon);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should decode tab-delimited array', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[3\t]: 1\t2\t3';
      const result = decoder.decode(toon);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should decode pipe-delimited array', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[3|]: 1|2|3';
      const result = decoder.decode(toon);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should decode tab-delimited tabular array', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[2\t]{a\tb}:\n  1\t2\n  3\t4';
      const result = decoder.decode(toon);
      expect(result).toEqual([
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ]);
    });

    it('should decode pipe-delimited tabular array', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[2|]{a|b}:\n  1|2\n  3|4';
      const result = decoder.decode(toon);
      expect(result).toEqual([
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ]);
    });

    it('should handle strings containing delimiter when quoted', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = '[2]: "a,b", c';
      const result = decoder.decode(toon);
      expect(result).toEqual(['a,b', 'c']);
    });
  });

  describe('strict mode', () => {
    const strictOptions: DecoderOptions = {
      indent: 2,
      strict: true,
      expandPaths: 'off',
    };

    it('should accept valid indentation in strict mode', () => {
      const decoder = new ToonDecoder(strictOptions);
      const toon = 'user:\n  name: Alice\n  age: 30';
      const result = decoder.decode(toon);
      expect(result).toEqual({ user: { name: 'Alice', age: 30 } });
    });

    it('should reject invalid indentation in strict mode', () => {
      const decoder = new ToonDecoder(strictOptions);
      const toon = 'user:\n   name: Alice'; // 3 spaces instead of 2
      expect(() => decoder.decode(toon)).toThrow(ToonDecodingError);
      expect(() => decoder.decode(toon)).toThrow('Indentation must be multiple of 2');
    });

    it('should reject tabs in indentation in strict mode', () => {
      const decoder = new ToonDecoder(strictOptions);
      const toon = 'user:\n\tname: Alice';
      expect(() => decoder.decode(toon)).toThrow(ToonDecodingError);
      expect(() => decoder.decode(toon)).toThrow('Tabs not allowed in indentation');
    });

    it('should validate array counts in strict mode', () => {
      const decoder = new ToonDecoder(strictOptions);
      const toon = '[3]: 1, 2'; // Says 3 elements but has 2
      expect(() => decoder.decode(toon)).toThrow(ToonDecodingError);
    });

    it('should allow correct array counts in strict mode', () => {
      const decoder = new ToonDecoder(strictOptions);
      const toon = '[3]: 1, 2, 3';
      const result = decoder.decode(toon);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('path expansion', () => {
    const expandOptions: DecoderOptions = {
      indent: 2,
      strict: false,
      expandPaths: 'safe',
    };

    it('should not expand paths when disabled', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = 'level1.level2.value: 42';
      const result = decoder.decode(toon);
      expect(result).toEqual({ 'level1.level2.value': 42 });
    });

    it('should expand dotted paths when enabled', () => {
      const decoder = new ToonDecoder(expandOptions);
      const toon = 'level1.level2.value: 42';
      const result = decoder.decode(toon);
      expect(result).toEqual({
        level1: {
          level2: {
            value: 42,
          },
        },
      });
    });

    it('should expand multiple dotted paths', () => {
      const decoder = new ToonDecoder(expandOptions);
      const toon = 'a.b: 1\na.c: 2\nd.e.f: 3';
      const result = decoder.decode(toon);
      expect(result).toEqual({
        a: {
          b: 1,
          c: 2,
        },
        d: {
          e: {
            f: 3,
          },
        },
      });
    });

    it('should not expand keys with unsafe characters', () => {
      const decoder = new ToonDecoder(expandOptions);
      const toon = 'key-with-hyphen.other: value';
      const result = decoder.decode(toon);
      // Should not expand because of hyphen
      expect(result).toEqual({ 'key-with-hyphen.other': 'value' });
    });

    it('should recursively expand nested objects', () => {
      const decoder = new ToonDecoder(expandOptions);
      const toon = 'outer:\n  inner.key: value';
      const result = decoder.decode(toon);
      expect(result).toEqual({
        outer: {
          inner: {
            key: 'value',
          },
        },
      });
    });
  });

  describe('leading zeros (§4 v3.0.3)', () => {
    it('should treat tokens with forbidden leading zeros as strings', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('key: 05')).toEqual({ key: '05' });
      expect(decoder.decode('key: 0001')).toEqual({ key: '0001' });
      expect(decoder.decode('key: -05')).toEqual({ key: '-05' });
      expect(decoder.decode('key: -0001')).toEqual({ key: '-0001' });
    });

    it('should treat zero integer part with fractional/exponent as numbers', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('key: 0.5')).toEqual({ key: 0.5 });
      expect(decoder.decode('key: 0e1')).toEqual({ key: 0 });
      expect(decoder.decode('key: -0.5')).toEqual({ key: -0.5 });
      expect(decoder.decode('key: -0e1')).toEqual({ key: -0 });
    });
  });

  describe('array header fall-through (§9.3 v3.0.3)', () => {
    it('should treat non-whitespace between ] and : as key-value, not array header', () => {
      const decoder = new ToonDecoder(defaultOptions);
      // foo[2][bar]: x → literal key, not array header
      expect(decoder.decode('foo[2][bar]: x')).toEqual({ 'foo[2][bar]': 'x' });
    });

    it('should still parse valid array headers with whitespace between ] and :', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('items[2]: a, b')).toEqual({ items: ['a', 'b'] });
    });

    it('should throw in strict mode when non-whitespace appears between ] and : (§14 v3.0.3)', () => {
      const decoder = new ToonDecoder({ indent: 2, strict: true, expandPaths: 'off' });
      expect(() => decoder.decode('foo[2][bar]: x')).toThrow(ToonDecodingError);
      expect(() => decoder.decode('foo[2][bar]: x')).toThrow('MUST NOT be parsed as array header');
    });
  });

  describe('error handling', () => {
    it('should parse malformed array-like keys as object keys', () => {
      const decoder = new ToonDecoder(defaultOptions);
      // These look like arrays but don't match the pattern, so treated as object keys
      expect(decoder.decode('[invalid]: values')).toEqual({ '[invalid]': 'values' });
      expect(decoder.decode('[-1]: invalid')).toEqual({ '[-1]': 'invalid' });
    });

    it('should include line number in error', () => {
      const decoder = new ToonDecoder({ ...defaultOptions, strict: true });
      const toon = 'line1: value\n   invalid: indentation';
      try {
        decoder.decode(toon);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ToonDecodingError);
        expect((err as ToonDecodingError).context?.lineNumber).toBe(2);
      }
    });
  });

  describe('complex structures', () => {
    it('should decode realistic user data', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = `user:
  id: 123
  name: Alice
  email: alice@example.com
  active: true
  tags[2]: admin, verified`;
      const result = decoder.decode(toon);
      expect(result).toEqual({
        user: {
          id: 123,
          name: 'Alice',
          email: 'alice@example.com',
          active: true,
          tags: ['admin', 'verified'],
        },
      });
    });

    it('should decode data with multiple tabular arrays', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = `users[2]{name, age}:
  Alice, 30
  Bob, 25
products[2]{id, price}:
  1, 10.5
  2, 20`;
      const result = decoder.decode(toon);
      expect(result).toEqual({
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
        products: [
          { id: 1, price: 10.5 },
          { id: 2, price: 20 },
        ],
      });
    });

    it('should decode mixed nested structure', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = `metadata:
  version: "1.0"
  created: 2024-01-01
items[2]{id, value}:
  1, first
  2, second
flags[3]: true, false, true`;
      const result = decoder.decode(toon);
      expect(result).toEqual({
        metadata: {
          version: '1.0',
          created: '2024-01-01',
        },
        items: [
          { id: 1, value: 'first' },
          { id: 2, value: 'second' },
        ],
        flags: [true, false, true],
      });
    });
  });

  describe('whitespace handling', () => {
    it('should handle trailing whitespace on lines', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = 'key: value  \nother: data  ';
      const result = decoder.decode(toon);
      expect(result).toEqual({ key: 'value', other: 'data' });
    });

    it('should handle blank lines', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = 'key1: value1\n\nkey2: value2\n\n';
      const result = decoder.decode(toon);
      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should handle windows line endings', () => {
      const decoder = new ToonDecoder(defaultOptions);
      const toon = 'key1: value1\r\nkey2: value2';
      const result = decoder.decode(toon);
      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });
  });

  describe('prototype pollution protection', () => {
    it('should reject __proto__ in path expansion', () => {
      const decoder = new ToonDecoder({ ...defaultOptions, expandPaths: 'safe' });
      const toon = '__proto__.polluted: "bad"';
      expect(() => decoder.decode(toon)).toThrow(ToonDecodingError);
      expect(() => decoder.decode(toon)).toThrow(/prototype pollution/);
    });

    it('should reject constructor in path expansion', () => {
      const decoder = new ToonDecoder({ ...defaultOptions, expandPaths: 'safe' });
      const toon = 'constructor.polluted: "bad"';
      expect(() => decoder.decode(toon)).toThrow(ToonDecodingError);
      expect(() => decoder.decode(toon)).toThrow(/prototype pollution/);
    });

    it('should reject prototype in path expansion', () => {
      const decoder = new ToonDecoder({ ...defaultOptions, expandPaths: 'safe' });
      const toon = 'prototype.polluted: "bad"';
      expect(() => decoder.decode(toon)).toThrow(ToonDecodingError);
      expect(() => decoder.decode(toon)).toThrow(/prototype pollution/);
    });

    it('should reject nested dangerous keys', () => {
      const decoder = new ToonDecoder({ ...defaultOptions, expandPaths: 'safe' });
      const toon = 'user.__proto__.isAdmin: true';
      expect(() => decoder.decode(toon)).toThrow(ToonDecodingError);
      expect(() => decoder.decode(toon)).toThrow(/prototype pollution/);
    });

    it('should allow safe keys with similar names', () => {
      const decoder = new ToonDecoder({ ...defaultOptions, expandPaths: 'safe' });
      const toon = 'proto_field: "safe"\nmy_constructor: "also safe"';
      const result = decoder.decode(toon);
      expect(result).toEqual({
        proto_field: 'safe',
        my_constructor: 'also safe',
      });
    });
  });

  // v3.3 additions
  describe('v3.3: empty array literal [] (§4/§5)', () => {
    it('should decode bare "[]" as empty root array', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('[]')).toEqual([]);
    });

    it('should decode "key: []" as empty array field', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('tags: []')).toEqual({ tags: [] });
    });
  });

  describe('v3.3: bracket length leading zeros rejected (§6)', () => {
    it('should error on [03] in strict mode', () => {
      const strictDecoder = new ToonDecoder({ ...defaultOptions, strict: true });
      expect(() => strictDecoder.decode('[03]:')).toThrow();
    });
  });

  describe('v3.3: \\uXXXX escape sequences in quoted strings (§7.1)', () => {
    it('should decode \\u0041 as "A"', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('name: "\\u0041"')).toEqual({ name: 'A' });
    });

    it('should decode \\u0000 as NUL character', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(decoder.decode('val: "\\u0000"')).toEqual({ val: '\x00' });
    });

    it('should reject lone surrogate \\ud800', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(() => decoder.decode('val: "\\ud800"')).toThrow();
    });

    it('should reject unknown escape \\x41', () => {
      const decoder = new ToonDecoder(defaultOptions);
      expect(() => decoder.decode('val: "\\x41"')).toThrow();
    });
  });
});
