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
			expect(result).toBe('[3]: 1, 2, 3');
		});

		it('should encode inline array of strings', () => {
			const encoder = new ToonEncoder(defaultOptions);
			const input = ['a', 'b', 'c'];
			const result = encoder.encode(input);
			expect(result).toBe('[3]: a, b, c');
		});

		it('should encode inline array of mixed primitives', () => {
			const encoder = new ToonEncoder(defaultOptions);
			const input = [1, 'two', true, null];
			const result = encoder.encode(input);
			expect(result).toBe('[4]: 1, two, true, null');
		});

		it('should encode expanded array for long content', () => {
			const encoder = new ToonEncoder(defaultOptions);
			// Need strings long enough to exceed 80 char threshold
			const input = ['very-long-string-that-will-definitely-force-expansion-by-exceeding-eighty-characters', 'another-item'];
			const result = encoder.encode(input);
			expect(result).toContain('[2]:');
			expect(result).toContain('  very-long-string-that-will-definitely-force-expansion-by-exceeding-eighty-characters');
			expect(result).toContain('  another-item');
		});

		it('should encode array as object property (inline)', () => {
			const encoder = new ToonEncoder(defaultOptions);
			const input = { numbers: [1, 2, 3] };
			const result = encoder.encode(input);
			expect(result).toBe('numbers[3]: 1, 2, 3');
		});

		it('should encode array as object property (expanded)', () => {
			const encoder = new ToonEncoder(defaultOptions);
			// Need long enough string to exceed 80 char threshold
			const input = { items: ['very-long-item-name-that-will-force-expansion-by-exceeding-eighty-chars-total', 'another-item'] };
			const result = encoder.encode(input);
			expect(result).toContain('items[2]:');
			expect(result).toContain('  very-long-item-name-that-will-force-expansion-by-exceeding-eighty-chars-total');
			expect(result).toContain('  another-item');
		});

		it('should encode empty array', () => {
			const encoder = new ToonEncoder(defaultOptions);
			const result = encoder.encode([]);
			// Empty inline array has space after colon
			expect(result).toBe('[0]: ');
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
			expect(result).toContain('[2]{age, name}:');
			expect(result).toContain('  30, Alice');
			expect(result).toContain('  25, Bob');
		});

		it('should encode tabular array with different field order', () => {
			const encoder = new ToonEncoder(defaultOptions);
			const input = [
				{ x: 1, y: 2 },
				{ y: 4, x: 3 },
			];
			const result = encoder.encode(input);
			// Fields should be sorted alphabetically
			expect(result).toContain('[2]{x, y}:');
			expect(result).toContain('  1, 2');
			expect(result).toContain('  3, 4');
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
			expect(result).toContain('users[2]{active, name}:');
			expect(result).toContain('  true, Alice');
			expect(result).toContain('  false, Bob');
		});

		it('should handle tabular array with null values', () => {
			const encoder = new ToonEncoder(defaultOptions);
			const input = [
				{ a: 1, b: null },
				{ a: null, b: 2 },
			];
			const result = encoder.encode(input);
			expect(result).toContain('[2]{a, b}:');
			expect(result).toContain('  1, null');
			expect(result).toContain('  null, 2');
		});
	});

	describe('encode mixed arrays', () => {
		it('should encode array with mixed types (primitives and objects)', () => {
			const encoder = new ToonEncoder(defaultOptions);
			const input = [1, { name: 'Alice' }, 'text'];
			const result = encoder.encode(input);
			expect(result).toContain('[3]:');
			expect(result).toContain('  1');
			expect(result).toContain('  name: Alice');
			expect(result).toContain('  text');
		});

		it('should encode nested arrays', () => {
			const encoder = new ToonEncoder(defaultOptions);
			const input = [[1, 2], [3, 4]];
			const result = encoder.encode(input);
			expect(result).toContain('[2]:');
			expect(result).toContain('  [2]: 1, 2');
			expect(result).toContain('  [2]: 3, 4');
		});

		it('should encode array of non-uniform objects', () => {
			const encoder = new ToonEncoder(defaultOptions);
			const input = [
				{ name: 'Alice', age: 30 },
				{ name: 'Bob', city: 'NYC' },
			];
			const result = encoder.encode(input);
			// Non-uniform objects should use expanded form
			expect(result).toContain('[2]:');
			expect(result).toContain('  name: Alice');
			expect(result).toContain('  age: 30');
			expect(result).toContain('  name: Bob');
			expect(result).toContain('  city: NYC');
		});
	});

	describe('delimiter handling', () => {
		it('should use comma delimiter by default', () => {
			const encoder = new ToonEncoder({ ...defaultOptions, delimiter: ',' });
			const input = [1, 2, 3];
			const result = encoder.encode(input);
			expect(result).toBe('[3]: 1, 2, 3');
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
			expect(result).toBe('[2]: "a,b", c');
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
			expect(result).toBe('[3]: null, null, 1');
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
			expect(result).toContain('  tags[2]: admin, verified');
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
			expect(result).toContain('users[2]{age, name}:');
			expect(result).toContain('products[2]{id, price}:');
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
			expect(result).toContain('items[2]{id, value}:');
			expect(result).toContain('flags[3]: true, false, true');
		});
	});
});
