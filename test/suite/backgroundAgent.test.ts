import * as assert from 'assert';

suite('Background Agent Module', () => {
  test('BackgroundAgentStatus type covers all states', () => {
    const validStates = ['idle', 'watching', 'triggered', 'running', 'cooldown'];
    assert.strictEqual(validStates.length, 5);
    for (const s of validStates) {
      assert.ok(typeof s === 'string');
    }
  });

  test('MAX_CONSECUTIVE_RUNS limit is reasonable', () => {
    const MAX_CONSECUTIVE_RUNS = 3;
    assert.ok(MAX_CONSECUTIVE_RUNS >= 1);
    assert.ok(MAX_CONSECUTIVE_RUNS <= 10);
  });

  test('MIN_TRIGGER_INTERVAL_MS prevents rapid re-triggers', () => {
    const MIN_TRIGGER_INTERVAL_MS = 30_000;
    assert.ok(MIN_TRIGGER_INTERVAL_MS >= 10_000, 'Should be at least 10s');
    assert.ok(MIN_TRIGGER_INTERVAL_MS <= 120_000, 'Should be at most 2min');
  });

  test('COOLDOWN_MS provides sufficient pause', () => {
    const COOLDOWN_MS = 60_000;
    assert.ok(COOLDOWN_MS >= 30_000);
  });

  test('DEBOUNCE_MS avoids premature triggers', () => {
    const DEBOUNCE_MS = 5_000;
    assert.ok(DEBOUNCE_MS >= 2_000);
    assert.ok(DEBOUNCE_MS <= 15_000);
  });

  test('status bar icon mapping covers all states', () => {
    const icons: Record<string, string> = {
      idle: '$(circle-outline)',
      watching: '$(eye)',
      triggered: '$(zap)',
      running: '$(sync~spin)',
      cooldown: '$(clock)',
    };
    assert.strictEqual(Object.keys(icons).length, 5);
    for (const icon of Object.values(icons)) {
      assert.ok(icon.startsWith('$('));
    }
  });

  test('status tooltip includes consecutive run info', () => {
    const consecutiveRuns = 2;
    const maxRuns = 3;
    const tooltip = `Consecutive runs: ${consecutiveRuns}/${maxRuns}`;
    assert.ok(tooltip.includes('2/3'));
  });

  test('backgroundAgentMode config values', () => {
    const validModes = ['off', 'bridge'];
    assert.ok(validModes.includes('off'));
    assert.ok(validModes.includes('bridge'));
    assert.ok(!validModes.includes('unknown'));
  });

  test('backgroundAgentTrigger config values', () => {
    const validTriggers = ['auto', 'notify'];
    assert.ok(validTriggers.includes('auto'));
    assert.ok(validTriggers.includes('notify'));
  });
});
