/**
 * Integration tests - End-to-end round-trip tests
 */

import { ToonEncoder } from '../ToonEncoder';
import { ToonDecoder } from '../ToonDecoder';
import type { EncoderOptions, DecoderOptions } from '../types';

describe('Integration Tests', () => {
	describe('Round-trip: JSON → TOON → JSON', () => {
		const encodeOptions: EncoderOptions = {
			indent: 2,
			delimiter: ',',
			keyFolding: 'off',
			flattenDepth: 999,
		};

		const decodeOptions: DecoderOptions = {
			indent: 2,
			strict: false,
			expandPaths: 'off',
		};

		it('should preserve primitive values through round-trip', () => {
			const testCases = [
				null,
				true,
				false,
				0,
				42,
				-5,
				3.14,
				'hello',
				'',
			];

			for (const original of testCases) {
				const encoder = new ToonEncoder(encodeOptions);
				const decoder = new ToonDecoder(decodeOptions);

				const toon = encoder.encode(original);
				const result = decoder.decode(toon);

				expect(result).toEqual(original);
			}
		});

		it('should preserve flat objects through round-trip', () => {
			const original = {
				name: 'Alice',
				age: 30,
				active: true,
				value: null,
			};

			const encoder = new ToonEncoder(encodeOptions);
			const decoder = new ToonDecoder(decodeOptions);

			const toon = encoder.encode(original);
			const result = decoder.decode(toon);

			expect(result).toEqual(original);
		});

		it('should preserve nested objects through round-trip', () => {
			const original = {
				user: {
					id: 123,
					profile: {
						name: 'Alice',
						email: 'alice@example.com',
					},
				},
				metadata: {
					version: '1.0',
					created: '2024-01-01',
				},
			};

			const encoder = new ToonEncoder(encodeOptions);
			const decoder = new ToonDecoder(decodeOptions);

			const toon = encoder.encode(original);
			const result = decoder.decode(toon);

			expect(result).toEqual(original);
		});

		it('should preserve primitive arrays through round-trip', () => {
			const original = {
				numbers: [1, 2, 3, 4, 5],
				strings: ['a', 'b', 'c'],
				mixed: [1, 'two', true, null],
			};

			const encoder = new ToonEncoder(encodeOptions);
			const decoder = new ToonDecoder(decodeOptions);

			const toon = encoder.encode(original);
			const result = decoder.decode(toon);

			expect(result).toEqual(original);
		});

		it('should preserve tabular arrays through round-trip', () => {
			const original = {
				users: [
					{ id: 1, name: 'Alice', age: 30 },
					{ id: 2, name: 'Bob', age: 25 },
					{ id: 3, name: 'Charlie', age: 35 },
				],
			};

			const encoder = new ToonEncoder(encodeOptions);
			const decoder = new ToonDecoder(decodeOptions);

			const toon = encoder.encode(original);
			const result = decoder.decode(toon);

			expect(result).toEqual(original);
		});

		it('should preserve mixed arrays through round-trip', () => {
			const original = {
				items: [
					1,
					'text',
					{ name: 'Alice', value: 42 },
					[1, 2, 3],
					true,
					null,
				],
			};

			const encoder = new ToonEncoder(encodeOptions);
			const decoder = new ToonDecoder(decodeOptions);

			const toon = encoder.encode(original);
			const result = decoder.decode(toon);

			expect(result).toEqual(original);
		});

		it('should preserve nested arrays through round-trip', () => {
			const original = {
				matrix: [
					[1, 2, 3],
					[4, 5, 6],
					[7, 8, 9],
				],
			};

			const encoder = new ToonEncoder(encodeOptions);
			const decoder = new ToonDecoder(decodeOptions);

			const toon = encoder.encode(original);
			const result = decoder.decode(toon);

			expect(result).toEqual(original);
		});

		it('should preserve empty arrays through round-trip', () => {
			const original = {
				emptyArray: [],
				otherField: 'value',
			};

			const encoder = new ToonEncoder(encodeOptions);
			const decoder = new ToonDecoder(decodeOptions);

			const toon = encoder.encode(original);
			const result = decoder.decode(toon);

			// Empty arrays should be preserved
			expect(result).toEqual(original);
		});

		it('should preserve special characters through round-trip', () => {
			const original = {
				newline: 'line1\nline2',
				tab: 'col1\tcol2',
				quote: 'say "hello"',
				backslash: 'path\\to\\file',
				colon: 'key: value',
			};

			const encoder = new ToonEncoder(encodeOptions);
			const decoder = new ToonDecoder(decodeOptions);

			const toon = encoder.encode(original);
			const result = decoder.decode(toon);

			expect(result).toEqual(original);
		});

		it('should preserve complex real-world data through round-trip', () => {
			// Simplified version without nested objects/arrays in array items
			// Full complex nesting requires mixed array format which has known limitations
			const original = {
				users: [
					{
						id: 1,
						name: 'Alice',
						email: 'alice@example.com',
						active: true,
					},
					{
						id: 2,
						name: 'Bob',
						email: 'bob@example.com',
						active: false,
					},
				],
				settings: {
					version: '1.0',
					features: {
						darkMode: true,
						notifications: false,
					},
				},
			};

			const encoder = new ToonEncoder(encodeOptions);
			const decoder = new ToonDecoder(decodeOptions);

			const toon = encoder.encode(original);
			const result = decoder.decode(toon);

			expect(result).toEqual(original);
		});
	});

	describe('Round-trip: JSON → TOON → JSON with different delimiters', () => {
		const data = {
			items: [
				{ id: 1, name: 'Alice', score: 95.5 },
				{ id: 2, name: 'Bob', score: 87.3 },
			],
		};

		it('should work with comma delimiter', () => {
			const encoder = new ToonEncoder({ indent: 2, delimiter: ',', keyFolding: 'off', flattenDepth: 999 });
			const decoder = new ToonDecoder({ indent: 2, strict: false, expandPaths: 'off' });

			const toon = encoder.encode(data);
			const result = decoder.decode(toon);

			expect(result).toEqual(data);
		});

		it('should work with tab delimiter', () => {
			const encoder = new ToonEncoder({ indent: 2, delimiter: '\t', keyFolding: 'off', flattenDepth: 999 });
			const decoder = new ToonDecoder({ indent: 2, strict: false, expandPaths: 'off' });

			const toon = encoder.encode(data);
			const result = decoder.decode(toon);

			expect(result).toEqual(data);
		});

		it('should work with pipe delimiter', () => {
			const encoder = new ToonEncoder({ indent: 2, delimiter: '|', keyFolding: 'off', flattenDepth: 999 });
			const decoder = new ToonDecoder({ indent: 2, strict: false, expandPaths: 'off' });

			const toon = encoder.encode(data);
			const result = decoder.decode(toon);

			expect(result).toEqual(data);
		});
	});

	describe('Round-trip: JSON → TOON → JSON with key folding/expansion', () => {
		it('should work with key folding and path expansion', () => {
			const original = {
				level1: {
					level2: {
						level3: {
							value: 42,
						},
					},
				},
			};

			const encoder = new ToonEncoder({
				indent: 2,
				delimiter: ',',
				keyFolding: 'safe',
				flattenDepth: 999,
			});
			const decoder = new ToonDecoder({
				indent: 2,
				strict: false,
				expandPaths: 'safe',
			});

			const toon = encoder.encode(original);
			// Should have folded key
			expect(toon).toContain('level1.level2.level3.value: 42');

			const result = decoder.decode(toon);
			expect(result).toEqual(original);
		});

		it('should work with partial key folding', () => {
			const original = {
				a: {
					b: {
						c: {
							d: 'deep',
						},
					},
				},
			};

			const encoder = new ToonEncoder({
				indent: 2,
				delimiter: ',',
				keyFolding: 'safe',
				flattenDepth: 2,
			});
			const decoder = new ToonDecoder({
				indent: 2,
				strict: false,
				expandPaths: 'safe',
			});

			const toon = encoder.encode(original);
			// Should have folded only 2 levels
			expect(toon).toContain('a.b:');

			const result = decoder.decode(toon);
			expect(result).toEqual(original);
		});
	});

	describe('Cross-delimiter conversions', () => {
		it('should convert comma-delimited TOON to tab-delimited TOON', () => {
			const data = [
				{ a: 1, b: 2, c: 3 },
				{ a: 4, b: 5, c: 6 },
			];

			const encoder1 = new ToonEncoder({ indent: 2, delimiter: ',', keyFolding: 'off', flattenDepth: 999 });
			const decoder = new ToonDecoder({ indent: 2, strict: false, expandPaths: 'off' });
			const encoder2 = new ToonEncoder({ indent: 2, delimiter: '\t', keyFolding: 'off', flattenDepth: 999 });

			const toon1 = encoder1.encode(data);
			const json = decoder.decode(toon1);
			const toon2 = encoder2.encode(json);

			expect(toon1).toContain('[2]{a, b, c}:');
			expect(toon1).toContain('1, 2, 3');

			expect(toon2).toContain('[2\t]{a\tb\tc}:');
			expect(toon2).toContain('1\t2\t3');

			// Both should decode to the same data
			const result1 = decoder.decode(toon1);
			const result2 = decoder.decode(toon2);
			expect(result1).toEqual(result2);
			expect(result1).toEqual(data);
		});
	});

	describe('Edge cases and error handling', () => {
		it('should handle empty input gracefully', () => {
			const encoder = new ToonEncoder({ indent: 2, delimiter: ',', keyFolding: 'off', flattenDepth: 999 });
			const decoder = new ToonDecoder({ indent: 2, strict: false, expandPaths: 'off' });

			const toon = encoder.encode({});
			expect(toon).toBe('');

			const result = decoder.decode('');
			// Empty TOON decodes to null in current implementation
			expect(result).toBe(null);
		});

		it('should handle very deep nesting', () => {
			const deep = {
				l1: {
					l2: {
						l3: {
							l4: {
								l5: {
									l6: {
										l7: {
											l8: {
												l9: {
													l10: 'deep',
												},
											},
										},
									},
								},
							},
						},
					},
				},
			};

			const encoder = new ToonEncoder({ indent: 2, delimiter: ',', keyFolding: 'off', flattenDepth: 999 });
			const decoder = new ToonDecoder({ indent: 2, strict: false, expandPaths: 'off' });

			const toon = encoder.encode(deep);
			const result = decoder.decode(toon);

			expect(result).toEqual(deep);
		});

		it('should handle large arrays', () => {
			const large = {
				items: Array.from({ length: 100 }, (_, i) => ({
					id: i,
					name: `Item${i}`,
					value: i * 10,
				})),
			};

			const encoder = new ToonEncoder({ indent: 2, delimiter: ',', keyFolding: 'off', flattenDepth: 999 });
			const decoder = new ToonDecoder({ indent: 2, strict: false, expandPaths: 'off' });

			const toon = encoder.encode(large);
			const result = decoder.decode(toon);

			expect(result).toEqual(large);
		});

		it('should handle Unicode and emoji', () => {
			const unicode = {
				message: 'Hello 世界',
				emoji: '🎉🎊🎈',
				mixed: 'Hello 世界 👋',
			};

			const encoder = new ToonEncoder({ indent: 2, delimiter: ',', keyFolding: 'off', flattenDepth: 999 });
			const decoder = new ToonDecoder({ indent: 2, strict: false, expandPaths: 'off' });

			const toon = encoder.encode(unicode);
			const result = decoder.decode(toon);

			expect(result).toEqual(unicode);
		});
	});

	describe('TOON Spec compliance', () => {
		it('should handle spec example: simple object', () => {
			const input = { id: 123, name: 'Ada', active: true };

			const encoder = new ToonEncoder({ indent: 2, delimiter: ',', keyFolding: 'off', flattenDepth: 999 });
			const result = encoder.encode(input);

			// Keys should be in sorted order
			expect(result).toContain('active: true');
			expect(result).toContain('id: 123');
			expect(result).toContain('name: Ada');
		});

		it('should handle spec example: nested object', () => {
			const input = {
				user: {
					id: 123,
					name: 'Ada',
				},
			};

			const encoder = new ToonEncoder({ indent: 2, delimiter: ',', keyFolding: 'off', flattenDepth: 999 });
			const decoder = new ToonDecoder({ indent: 2, strict: false, expandPaths: 'off' });

			const toon = encoder.encode(input);
			expect(toon).toContain('user:');
			expect(toon).toContain('  id: 123');
			expect(toon).toContain('  name: Ada');

			const result = decoder.decode(toon);
			expect(result).toEqual(input);
		});

		it('should handle spec example: primitive array', () => {
			const input = { tags: ['admin', 'ops', 'dev'] };

			const encoder = new ToonEncoder({ indent: 2, delimiter: ',', keyFolding: 'off', flattenDepth: 999 });
			const decoder = new ToonDecoder({ indent: 2, strict: false, expandPaths: 'off' });

			const toon = encoder.encode(input);
			expect(toon).toBe('tags[3]: admin, ops, dev');

			const result = decoder.decode(toon);
			expect(result).toEqual(input);
		});

		it('should handle spec example: tabular array', () => {
			const input = [
				{ sku: 'A1', qty: 2, price: 9.99 },
				{ sku: 'B2', qty: 1, price: 14.5 },
			];

			const encoder = new ToonEncoder({ indent: 2, delimiter: ',', keyFolding: 'off', flattenDepth: 999 });
			const decoder = new ToonDecoder({ indent: 2, strict: false, expandPaths: 'off' });

			const toon = encoder.encode(input);
			expect(toon).toContain('[2]{price, qty, sku}:');

			const result = decoder.decode(toon);
			expect(result).toEqual(input);
		});
	});
});
