/**
 * TOON Node - n8n node for TOON format conversion
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { ToonEncoder } from './ToonEncoder';
import { ToonDecoder } from './ToonDecoder';
import * as utils from './ToonUtils';
import type { EncoderOptions, DecoderOptions } from './types';

export class Toon implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TOON',
		name: 'toon',
		icon: 'file:toon.svg',
		group: ['transform'],
		version: 1,
		description: 'Convert between TOON and JSON formats with zero external dependencies',
		defaults: {
			name: 'TOON',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'JSON to TOON',
						value: 'jsonToToon',
						description: 'Convert JSON data to TOON format',
						action: 'Convert JSON to TOON',
					},
					{
						name: 'TOON to JSON',
						value: 'toonToJson',
						description: 'Parse TOON format to JSON',
						action: 'Convert TOON to JSON',
					},
				],
				default: 'jsonToToon',
			},

			// Encoding options (for jsonToToon)
			{
				displayName: 'Indent Size',
				name: 'indent',
				type: 'number',
				default: 2,
				description: 'Number of spaces per indentation level',
				displayOptions: {
					show: {
						operation: ['jsonToToon'],
					},
				},
			},
			{
				displayName: 'Delimiter',
				name: 'delimiter',
				type: 'options',
				options: [
					{ name: 'Comma (,)', value: 'comma' },
					{ name: 'Tab', value: 'tab' },
					{ name: 'Pipe (|)', value: 'pipe' },
				],
				default: 'comma',
				description: 'Delimiter for array values',
				displayOptions: {
					show: {
						operation: ['jsonToToon'],
					},
				},
			},
			{
				displayName: 'Key Folding',
				name: 'keyFolding',
				type: 'options',
				options: [
					{ name: 'Off', value: 'off' },
					{ name: 'Safe', value: 'safe' },
				],
				default: 'off',
				description: 'Collapse single-key object chains into dotted paths (e.g., "a.b.c")',
				displayOptions: {
					show: {
						operation: ['jsonToToon'],
					},
				},
			},
			{
				displayName: 'Flatten Depth',
				name: 'flattenDepth',
				type: 'number',
				default: 999,
				description: 'Maximum number of segments to fold (use 999 for unlimited)',
				displayOptions: {
					show: {
						operation: ['jsonToToon'],
						keyFolding: ['safe'],
					},
				},
			},

			// Decoding options (for toonToJson)
			{
				displayName: 'Expected Indent Size',
				name: 'indent',
				type: 'number',
				default: 2,
				description: 'Expected indentation size for validation',
				displayOptions: {
					show: {
						operation: ['toonToJson'],
					},
				},
			},
			{
				displayName: 'Strict Mode',
				name: 'strict',
				type: 'boolean',
				default: true,
				description: 'Whether to enforce array counts, indentation multiples, and validation rules',
				displayOptions: {
					show: {
						operation: ['toonToJson'],
					},
				},
			},
			{
				displayName: 'Expand Paths',
				name: 'expandPaths',
				type: 'options',
				options: [
					{ name: 'Off', value: 'off' },
					{ name: 'Safe', value: 'safe' },
				],
				default: 'off',
				description: 'Split dotted keys into nested objects (e.g., "a.b.c" → {a: {b: {c: ...}}})',
				displayOptions: {
					show: {
						operation: ['toonToJson'],
					},
				},
			},

			// Input/Output configuration
			{
				displayName: 'Input Mode',
				name: 'inputMode',
				type: 'options',
				options: [
					{ name: 'Field', value: 'field' },
					{ name: 'Entire JSON', value: 'json' },
				],
				default: 'field',
				description: 'Whether to use a specific field or the entire JSON object',
			},
			{
				displayName: 'Input Field',
				name: 'inputField',
				type: 'string',
				default: 'data',
				description: 'Field containing input data (string for TOON, object for JSON)',
				displayOptions: {
					show: {
						inputMode: ['field'],
					},
				},
			},
			{
				displayName: 'Output Field',
				name: 'outputField',
				type: 'string',
				default: 'data',
				description: 'Field name to store the converted output',
			},
		],
		usableAsTool: true,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const inputMode = this.getNodeParameter('inputMode', itemIndex) as string;
				const outputField = this.getNodeParameter('outputField', itemIndex) as string;

				let inputData: unknown;

				if (inputMode === 'json') {
					inputData = items[itemIndex].json;
				} else {
					const inputField = this.getNodeParameter('inputField', itemIndex) as string;
					inputData = items[itemIndex].json[inputField];
				}

				let result: unknown;

				switch (operation) {
					case 'jsonToToon':
						result = convertJsonToToon.call(this, inputData, itemIndex);
						break;
					case 'toonToJson':
						result = convertToonToJson.call(this, inputData as string, itemIndex);
						break;
					default:
						throw new NodeOperationError(
							this.getNode(),
							`Unknown operation: ${operation}`,
							{ itemIndex },
						);
				}

				returnData.push({
					json: {
						...(items[itemIndex].json as object),
						[outputField]: result,
					} as IDataObject,
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							itemIndex,
						},
						pairedItem: { item: itemIndex },
					});
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error as Error, {
						itemIndex,
					});
				}
			}
		}

		return [returnData];
	}

}

/**
 * Convert JSON to TOON
 */
function convertJsonToToon(this: IExecuteFunctions, data: unknown, itemIndex: number): string {
		const indent = this.getNodeParameter('indent', itemIndex) as number;
		const delimiterOption = this.getNodeParameter('delimiter', itemIndex) as
			| 'comma'
			| 'tab'
			| 'pipe';
		const keyFolding = this.getNodeParameter('keyFolding', itemIndex) as 'off' | 'safe';
		const flattenDepth = keyFolding === 'safe'
			? (this.getNodeParameter('flattenDepth', itemIndex) as number)
			: Infinity;

		const options: EncoderOptions = {
			indent,
			delimiter: utils.getDelimiterChar(delimiterOption),
			keyFolding,
			flattenDepth: flattenDepth === 999 ? Infinity : flattenDepth,
		};

		const encoder = new ToonEncoder(options);
		return encoder.encode(data);
	}

/**
 * Convert TOON to JSON
 */
function convertToonToJson(this: IExecuteFunctions, toonText: string, itemIndex: number): unknown {
		if (typeof toonText !== 'string') {
			throw new NodeOperationError(
				this.getNode(),
				'Input must be a string for TOON to JSON conversion',
				{ itemIndex },
			);
		}

		const indent = this.getNodeParameter('indent', itemIndex) as number;
		const strict = this.getNodeParameter('strict', itemIndex) as boolean;
		const expandPaths = this.getNodeParameter('expandPaths', itemIndex) as 'off' | 'safe';

		const options: DecoderOptions = {
			indent,
			strict,
			expandPaths,
		};

		const decoder = new ToonDecoder(options);
		return decoder.decode(toonText);
	}
