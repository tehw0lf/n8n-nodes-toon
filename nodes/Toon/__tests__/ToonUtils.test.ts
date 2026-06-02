/**
 * Tests for ToonUtils - Core utility functions
 */

import * as utils from '../ToonUtils';

describe('ToonUtils', () => {
  describe('canonicalizeNumber', () => {
    it('should handle integers', () => {
      expect(utils.canonicalizeNumber(42)).toBe('42');
      expect(utils.canonicalizeNumber(0)).toBe('0');
      expect(utils.canonicalizeNumber(-5)).toBe('-5');
    });

    it('should handle -0 as 0', () => {
      expect(utils.canonicalizeNumber(-0)).toBe('0');
    });

    it('should handle decimals without trailing zeros', () => {
      expect(utils.canonicalizeNumber(3.14)).toBe('3.14');
      expect(utils.canonicalizeNumber(1.5)).toBe('1.5');
      expect(utils.canonicalizeNumber(0.5)).toBe('0.5');
    });

    it('should remove trailing zeros after decimal point', () => {
      expect(utils.canonicalizeNumber(1.0)).toBe('1');
      expect(utils.canonicalizeNumber(2.5000)).toBe('2.5');
      expect(utils.canonicalizeNumber(100.0)).toBe('100');
    });

    it('should expand scientific notation', () => {
      expect(utils.canonicalizeNumber(1e3)).toBe('1000');
      expect(utils.canonicalizeNumber(1.5e2)).toBe('150');
      expect(utils.canonicalizeNumber(5e-1)).toBe('0.5');
    });
  });

  describe('escapeString', () => {
    it('should escape backslash', () => {
      expect(utils.escapeString('a\\b')).toBe('a\\\\b');
    });

    it('should escape double quote', () => {
      expect(utils.escapeString('say "hello"')).toBe('say \\"hello\\"');
    });

    it('should escape newline', () => {
      expect(utils.escapeString('line1\nline2')).toBe('line1\\nline2');
    });

    it('should escape carriage return', () => {
      expect(utils.escapeString('line1\rline2')).toBe('line1\\rline2');
    });

    it('should escape tab', () => {
      expect(utils.escapeString('col1\tcol2')).toBe('col1\\tcol2');
    });

    it('should handle multiple escape sequences', () => {
      expect(utils.escapeString('a\tb\nc\\d"e')).toBe('a\\tb\\nc\\\\d\\"e');
    });
  });

  describe('unescapeString', () => {
    it('should unescape backslash', () => {
      expect(utils.unescapeString('a\\\\b')).toBe('a\\b');
    });

    it('should unescape double quote', () => {
      expect(utils.unescapeString('say \\"hello\\"')).toBe('say "hello"');
    });

    it('should unescape newline', () => {
      expect(utils.unescapeString('line1\\nline2')).toBe('line1\nline2');
    });

    it('should unescape carriage return', () => {
      expect(utils.unescapeString('line1\\rline2')).toBe('line1\rline2');
    });

    it('should unescape tab', () => {
      expect(utils.unescapeString('col1\\tcol2')).toBe('col1\tcol2');
    });
  });

  describe('needsQuoting', () => {
    it('should require quotes for empty string', () => {
      expect(utils.needsQuoting('', ',', ',', 'array')).toBe(true);
    });

    it('should require quotes for strings with leading/trailing whitespace', () => {
      expect(utils.needsQuoting(' value', ',', ',', 'array')).toBe(true);
      expect(utils.needsQuoting('value ', ',', ',', 'array')).toBe(true);
      expect(utils.needsQuoting(' value ', ',', ',', 'array')).toBe(true);
    });

    it('should require quotes for reserved literals', () => {
      expect(utils.needsQuoting('true', ',', ',', 'array')).toBe(true);
      expect(utils.needsQuoting('false', ',', ',', 'array')).toBe(true);
      expect(utils.needsQuoting('null', ',', ',', 'array')).toBe(true);
    });

    it('should require quotes for numeric strings', () => {
      expect(utils.needsQuoting('42', ',', ',', 'array')).toBe(true);
      expect(utils.needsQuoting('3.14', ',', ',', 'array')).toBe(true);
      expect(utils.needsQuoting('-5', ',', ',', 'array')).toBe(true);
    });

    it('should require quotes for strings containing delimiter', () => {
      expect(utils.needsQuoting('a,b', ',', ',', 'array')).toBe(true);
      expect(utils.needsQuoting('a\tb', '\t', '\t', 'array')).toBe(true);
      expect(utils.needsQuoting('a|b', '|', '|', 'array')).toBe(true);
    });

    it('should not require quotes for plain strings', () => {
      expect(utils.needsQuoting('hello', ',', ',', 'array')).toBe(false);
      expect(utils.needsQuoting('world123', ',', ',', 'array')).toBe(false);
    });
  });

  describe('indent', () => {
    it('should create correct indentation', () => {
      expect(utils.indent(0, 2)).toBe('');
      expect(utils.indent(1, 2)).toBe('  ');
      expect(utils.indent(2, 2)).toBe('    ');
      expect(utils.indent(3, 2)).toBe('      ');
    });

    it('should handle different indent sizes', () => {
      expect(utils.indent(1, 4)).toBe('    ');
      expect(utils.indent(2, 4)).toBe('        ');
    });
  });

  describe('isSafeKey', () => {
    it('should reject prototype pollution keys', () => {
      expect(utils.isSafeKey('__proto__')).toBe(false);
      expect(utils.isSafeKey('constructor')).toBe(false);
      expect(utils.isSafeKey('prototype')).toBe(false);
    });

    it('should accept safe keys', () => {
      expect(utils.isSafeKey('name')).toBe(true);
      expect(utils.isSafeKey('user')).toBe(true);
      expect(utils.isSafeKey('data')).toBe(true);
      expect(utils.isSafeKey('_private')).toBe(true);
      expect(utils.isSafeKey('value123')).toBe(true);
    });
  });

  describe('isNumericToken', () => {
    it('should accept normal integers and decimals', () => {
      expect(utils.isNumericToken('0')).toBe(true);
      expect(utils.isNumericToken('42')).toBe(true);
      expect(utils.isNumericToken('-5')).toBe(true);
      expect(utils.isNumericToken('3.14')).toBe(true);
      expect(utils.isNumericToken('-2.5')).toBe(true);
    });

    it('should accept zero integer part with fractional or exponent (per §4 v3.0.3)', () => {
      expect(utils.isNumericToken('0.5')).toBe(true);
      expect(utils.isNumericToken('0e1')).toBe(true);
      expect(utils.isNumericToken('-0.5')).toBe(true);
      expect(utils.isNumericToken('-0e1')).toBe(true);
    });

    it('should reject forbidden leading zeros in integer part (per §4 v3.0.3)', () => {
      expect(utils.isNumericToken('05')).toBe(false);
      expect(utils.isNumericToken('0001')).toBe(false);
      expect(utils.isNumericToken('-05')).toBe(false);
      expect(utils.isNumericToken('-0001')).toBe(false);
    });
  });

  // v3.3 additions
  describe('escapeString v3.3: \\uXXXX for U+0000–U+001F controls (§7.1)', () => {
    it('should escape NUL (U+0000) as \\u0000', () => {
      expect(utils.escapeString('\x00')).toBe('\\u0000');
    });

    it('should escape U+0001 as \\u0001', () => {
      expect(utils.escapeString('\x01')).toBe('\\u0001');
    });

    it('should escape U+001f as \\u001f', () => {
      expect(utils.escapeString('\x1f')).toBe('\\u001f');
    });

    it('should still use named escapes for \\n, \\r, \\t', () => {
      expect(utils.escapeString('\n')).toBe('\\n');
      expect(utils.escapeString('\r')).toBe('\\r');
      expect(utils.escapeString('\t')).toBe('\\t');
    });

    it('should not escape regular printable characters', () => {
      expect(utils.escapeString('hello world')).toBe('hello world');
    });
  });

  describe('unescapeString v3.3: \\uXXXX support (§7.1)', () => {
    it('should unescape \\u0041 to A', () => {
      expect(utils.unescapeString('\\u0041')).toBe('A');
    });

    it('should unescape \\u0000 to NUL', () => {
      expect(utils.unescapeString('\\u0000')).toBe('\x00');
    });

    it('should unescape \\u001f to U+001F', () => {
      expect(utils.unescapeString('\\u001f')).toBe('\x1f');
    });

    it('should be case-insensitive for hex digits', () => {
      expect(utils.unescapeString('\\u004F')).toBe('O');
      expect(utils.unescapeString('\\u004f')).toBe('O');
    });

    it('should reject lone surrogates', () => {
      expect(() => utils.unescapeString('\\ud800')).toThrow();
      expect(() => utils.unescapeString('\\udfff')).toThrow();
    });

    it('should reject \\u with fewer than 4 hex digits', () => {
      expect(() => utils.unescapeString('\\u041')).toThrow();
      expect(() => utils.unescapeString('\\u')).toThrow();
    });

    it('should reject unknown escape sequences', () => {
      expect(() => utils.unescapeString('\\x41')).toThrow();
      expect(() => utils.unescapeString('\\q')).toThrow();
    });
  });

  describe('canonicalizeNumber v3.3: exponent notation for out-of-range values (§2)', () => {
    it('should use fixed decimal for normal range', () => {
      expect(utils.canonicalizeNumber(1e3)).toBe('1000');
      expect(utils.canonicalizeNumber(1.5e2)).toBe('150');
      expect(utils.canonicalizeNumber(5e-1)).toBe('0.5');
      expect(utils.canonicalizeNumber(1e-6)).toBe('0.000001');
    });

    it('should use exponent notation for |n| < 1e-6', () => {
      const result = utils.canonicalizeNumber(1e-7);
      expect(result).toMatch(/^1e[-+]/);
    });

    it('should use exponent notation for |n| >= 1e21', () => {
      const result = utils.canonicalizeNumber(1e21);
      expect(result).toMatch(/^1e[+]/);
    });

    it('should use lowercase e with explicit sign in exponent', () => {
      const result = utils.canonicalizeNumber(1e-7);
      expect(result).toMatch(/e[-+]/);
      expect(result).not.toMatch(/E/);
    });
  });

  describe('needsQuoting v3.3: full U+0000–U+001F control character range (§7.2)', () => {
    it('should require quotes for NUL byte', () => {
      expect(utils.needsQuoting('\x00', ',', ',', 'object')).toBe(true);
    });

    it('should require quotes for U+0001', () => {
      expect(utils.needsQuoting('\x01', ',', ',', 'object')).toBe(true);
    });

    it('should require quotes for U+001f', () => {
      expect(utils.needsQuoting('\x1f', ',', ',', 'object')).toBe(true);
    });

    it('should require quotes for tab, newline, carriage return', () => {
      expect(utils.needsQuoting('\t', ',', ',', 'object')).toBe(true);
      expect(utils.needsQuoting('\n', ',', ',', 'object')).toBe(true);
      expect(utils.needsQuoting('\r', ',', ',', 'object')).toBe(true);
    });
  });
});
