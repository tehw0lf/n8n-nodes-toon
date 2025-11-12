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
});
