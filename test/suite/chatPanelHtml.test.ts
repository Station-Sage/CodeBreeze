import * as assert from 'assert';
import { getNonce } from '../../src/ui/chatPanelHtml';

suite('chatPanelHtml', () => {
  // ── getNonce ──
  test('getNonce returns 32-character string', () => {
    const nonce = getNonce();
    assert.strictEqual(nonce.length, 32);
  });

  test('getNonce returns alphanumeric characters only', () => {
    const nonce = getNonce();
    assert.ok(/^[A-Za-z0-9]+$/.test(nonce), `Nonce contains non-alphanumeric: ${nonce}`);
  });

  test('getNonce returns different values each call', () => {
    const a = getNonce();
    const b = getNonce();
    // Technically could collide but 62^32 makes it astronomically unlikely
    assert.notStrictEqual(a, b);
  });

  test('getNonce returns string type', () => {
    assert.strictEqual(typeof getNonce(), 'string');
  });
});
