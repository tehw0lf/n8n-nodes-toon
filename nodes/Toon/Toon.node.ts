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
      {
        displayName: 'Include Token Metrics',
        name: 'includeTokenMetrics',
        type: 'boolean',
        default: false,
        description: 'Whether to include token count comparison metrics in the output',
        displayOptions: {
          show: {
            operation: ['jsonToToon'],
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
        displayName: 'Input Data',
        name: 'inputData',
        type: 'string',
        default: '={{ $json }}',
        description: 'Drag and drop data from the left, use a field name (e.g., "data"), dot notation (e.g., "users[0].name"), or the entire input with {{ $JSON }}. Auto-detects the input type.',
        placeholder: 'Drag data here or enter field name',
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
        const outputField = this.getNodeParameter('outputField', itemIndex) as string;

        // Get inputData parameter - n8n will auto-evaluate expressions
        const inputDataParam = this.getNodeParameter('inputData', itemIndex);

        let inputData: unknown;

        // Auto-detect mode based on what n8n returned:
        // 1. If it's not a string, n8n evaluated an expression (e.g., {{ $json }}) -> use directly
        // 2. If it's a string, it's either a field path or literal data for decoding
        if (typeof inputDataParam !== 'string') {
          // n8n evaluated an expression - use the result directly
          inputData = inputDataParam;
        } else {
          // It's a string - could be a field path like "data" or "users[0].name"
          // Try to navigate the field path in the input JSON
          const fieldPath = inputDataParam.split('.');
          inputData = fieldPath.reduce((obj: IDataObject | unknown, key: string) => {
            if (obj === null || obj === undefined) {
              return undefined;
            }
            // Handle array indices like "users[0]"
            const arrayMatch = key.match(/^(.+?)\[(\d+)\]$/);
            if (arrayMatch) {
              const [, arrayName, indexStr] = arrayMatch;
              const index = parseInt(indexStr, 10);
              const objAsRecord = obj as Record<string, unknown>;
              const arrayValue = objAsRecord[arrayName] as unknown[];
              return arrayValue?.[index];
            }
            return (obj as IDataObject)[key];
          }, items[itemIndex].json as IDataObject);

          // If field path navigation returned undefined and operation is toonToJson,
          // treat the string as literal TOON data to decode
          if (inputData === undefined && operation === 'toonToJson') {
            inputData = inputDataParam;
          }
        }

        let result: unknown;
        let tokenMetrics: IDataObject | undefined;

        switch (operation) {
          case 'jsonToToon': {
            const conversionResult = convertJsonToToon.call(this, inputData, itemIndex);
            result = conversionResult.toon;
            tokenMetrics = conversionResult.tokenMetrics;
            break;
          }
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

        const outputJson = {
          ...(items[itemIndex].json as object),
          [outputField]: result,
        } as IDataObject;

        // Add token metrics if available
        if (tokenMetrics) {
          outputJson.tokenMetrics = tokenMetrics;
        }

        returnData.push({
          json: outputJson,
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
function convertJsonToToon(
  this: IExecuteFunctions,
  data: unknown,
  itemIndex: number,
): { toon: string; tokenMetrics?: IDataObject } {
  const indent = this.getNodeParameter('indent', itemIndex) as number;
  const delimiterOption = this.getNodeParameter('delimiter', itemIndex) as
    | 'comma'
    | 'tab'
    | 'pipe';
  const keyFolding = this.getNodeParameter('keyFolding', itemIndex) as 'off' | 'safe';
  const flattenDepth =
    keyFolding === 'safe' ? (this.getNodeParameter('flattenDepth', itemIndex) as number) : Infinity;
  const includeTokenMetrics = this.getNodeParameter('includeTokenMetrics', itemIndex) as boolean;

  const options: EncoderOptions = {
    indent,
    delimiter: utils.getDelimiterChar(delimiterOption),
    keyFolding,
    flattenDepth: flattenDepth === 999 ? Infinity : flattenDepth,
  };

  const encoder = new ToonEncoder(options);
  const toonOutput = encoder.encode(data);

  // Calculate token metrics if requested
  let tokenMetrics: IDataObject | undefined;
  if (includeTokenMetrics) {
    const jsonString = JSON.stringify(data);
    const jsonTokens = estimateTokenCount(jsonString);
    const toonTokens = estimateTokenCount(toonOutput);
    const saved = jsonTokens - toonTokens;
    const reduction = jsonTokens > 0 ? saved / jsonTokens : 0;

    tokenMetrics = {
      json: jsonTokens,
      toon: toonTokens,
      saved,
      reduction: Math.round(reduction * 10000) / 10000, // Round to 4 decimal places
    };
  }

  return { toon: toonOutput, tokenMetrics };
}

/**
 * Estimate token count using a simple heuristic
 * Approximates OpenAI's tokenization: ~4 characters per token on average
 */
function estimateTokenCount(text: string): number {
  // Simple estimation: count characters and divide by 4
  // This is a rough approximation of tokenization
  return Math.ceil(text.length / 4);
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
