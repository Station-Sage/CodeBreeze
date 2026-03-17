import * as assert from 'assert';
import { isAgentLoopActive, stopAgentLoop, handleAgentLoopResponse } from '../../src/bridge/agentLoop';

suite('agentLoop', () => {
  test('isAgentLoopActive returns false initially', () => {
    assert.strictEqual(isAgentLoopActive(), false);
  });

  test('stopAgentLoop does not throw when not active', () => {
    assert.doesNotThrow(() => stopAgentLoop());
  });

  test('handleAgentLoopResponse does not throw when no resolver', () => {
    assert.doesNotThrow(() =>
      handleAgentLoopResponse([
        { language: 'ts', filePath: 'a.ts', content: 'x', isDiff: false },
      ])
    );
  });

  test('handleAgentLoopResponse ignores empty blocks', () => {
    assert.doesNotThrow(() => handleAgentLoopResponse([]));
  });
});
