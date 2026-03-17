import * as assert from 'assert';
import {
  BrowserToVSCodeMessage,
  VSCodeToBrowserMessage,
  BridgeCodeBlock,
  DEFAULT_AGENT_LOOP_MAX_ITERATIONS,
} from '../../src/bridge/bridgeProtocol';

suite('bridgeProtocol', () => {
  test('DEFAULT_AGENT_LOOP_MAX_ITERATIONS is 5', () => {
    assert.strictEqual(DEFAULT_AGENT_LOOP_MAX_ITERATIONS, 5);
  });

  test('BridgeCodeBlock shape', () => {
    const block: BridgeCodeBlock = {
      content: 'console.log("hello")',
      language: 'typescript',
      filePath: 'src/app.ts',
    };
    assert.strictEqual(block.content, 'console.log("hello")');
    assert.strictEqual(block.language, 'typescript');
    assert.strictEqual(block.filePath, 'src/app.ts');
  });

  test('BridgeCodeBlock minimal (content only)', () => {
    const block: BridgeCodeBlock = { content: 'x = 1' };
    assert.strictEqual(block.content, 'x = 1');
    assert.strictEqual(block.language, undefined);
    assert.strictEqual(block.filePath, undefined);
  });

  test('BrowserToVSCodeMessage ping type', () => {
    const msg: BrowserToVSCodeMessage = { type: 'ping' };
    assert.strictEqual(msg.type, 'ping');
  });

  test('BrowserToVSCodeMessage codeBlocks type', () => {
    const msg: BrowserToVSCodeMessage = {
      type: 'codeBlocks',
      blocks: [{ content: 'a' }],
      source: 'genspark',
    };
    assert.strictEqual(msg.type, 'codeBlocks');
    assert.strictEqual(msg.blocks!.length, 1);
    assert.strictEqual(msg.source, 'genspark');
  });

  test('BrowserToVSCodeMessage ai_response type', () => {
    const msg: BrowserToVSCodeMessage = {
      type: 'ai_response',
      payload: 'some code',
      source: 'chatgpt',
    };
    assert.strictEqual(msg.type, 'ai_response');
    assert.strictEqual(msg.payload, 'some code');
  });

  test('VSCodeToBrowserMessage pong type', () => {
    const msg: VSCodeToBrowserMessage = { type: 'pong' };
    assert.strictEqual(msg.type, 'pong');
  });

  test('VSCodeToBrowserMessage send_to_ai type', () => {
    const msg: VSCodeToBrowserMessage = {
      type: 'send_to_ai',
      payload: 'fix this error',
    };
    assert.strictEqual(msg.type, 'send_to_ai');
    assert.strictEqual(msg.payload, 'fix this error');
  });

  test('VSCodeToBrowserMessage agent_loop_status type', () => {
    const msg: VSCodeToBrowserMessage = {
      type: 'agent_loop_status',
      iteration: 3,
      maxIterations: 5,
      status: 'running',
    };
    assert.strictEqual(msg.iteration, 3);
    assert.strictEqual(msg.maxIterations, 5);
  });
});
