import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { Toon } from '../Toon.node';

const BAD_TOON = 'users[2]{id}:\n  1';

function makeContext(
  items: INodeExecutionData[],
  continueOnFail: boolean,
): IExecuteFunctions {
  const params: Record<string, unknown> = {
    operation: 'toonToJson',
    outputField: 'result',
    inputData: 'data',
    options: {},
  };
  return {
    getInputData: () => items,
    getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
      name in params ? params[name] : fallback,
    continueOnFail: () => continueOnFail,
    getNode: () => ({ name: 'TOON', type: 'toon', typeVersion: 1, position: [0, 0], parameters: {} }),
  } as unknown as IExecuteFunctions;
}

describe('Toon.execute with Continue On Fail', () => {
  it('keeps the input fields on the error item', async () => {
    const items = [{ json: { id: 42, data: BAD_TOON } }];
    const [out] = await new Toon().execute.call(makeContext(items, true));
    expect(out).toHaveLength(1);
    expect(out[0].json).toMatchObject({ id: 42, data: BAD_TOON, itemIndex: 0 });
    expect(typeof out[0].json.error).toBe('string');
    expect(out[0].json.error).toContain('Count mismatch');
    expect(out[0].pairedItem).toEqual({ item: 0 });
  });

  it('overwrites input fields named error and itemIndex', async () => {
    const items = [
      { json: { ok: 1, data: '{}' } },
      { json: { keep: 'me', error: 'old', itemIndex: 99, data: BAD_TOON } },
    ];
    const [out] = await new Toon().execute.call(makeContext(items, true));
    expect(out[1].json.keep).toBe('me');
    expect(out[1].json.itemIndex).toBe(1);
    expect(out[1].json.error).not.toBe('old');
    expect(out[1].json.error).toContain('Count mismatch');
  });

  it('keeps successful items unchanged and gives the failing one its own fields', async () => {
    const items = [
      { json: { id: 1, data: 'a: 1' } },
      { json: { id: 2, data: BAD_TOON } },
      { json: { id: 3, data: 'b: 2' } },
    ];
    const [out] = await new Toon().execute.call(makeContext(items, true));
    expect(out).toHaveLength(3);
    expect(out[0].json).toEqual({ id: 1, data: 'a: 1', result: { a: 1 } });
    expect(out[1].json.id).toBe(2);
    expect(out[1].json.itemIndex).toBe(1);
    expect(out[1].json).not.toHaveProperty('result');
    expect(out[2].json).toEqual({ id: 3, data: 'b: 2', result: { b: 2 } });
  });

  it('still throws a NodeOperationError without Continue On Fail', async () => {
    const items = [{ json: { id: 42, data: BAD_TOON } }];
    await expect(new Toon().execute.call(makeContext(items, false))).rejects.toBeInstanceOf(
      NodeOperationError,
    );
  });
});
