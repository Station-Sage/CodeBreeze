import * as assert from 'assert';
import { parseErrorOutput } from '../../src/collect/errorParser';

suite('errorParser — parseErrorOutput', () => {

  // ── TypeScript ──
  test('TypeScript: parses (line,col) format', () => {
    const output = 'src/app.ts(42,5): error TS2345: Argument of type "string" is not assignable';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].filePath, 'src/app.ts');
    assert.strictEqual(errors[0].line, 42);
    assert.strictEqual(errors[0].severity, 'error');
    assert.ok(errors[0].message.includes('TS2345'));
  });

  test('TypeScript: parses warning', () => {
    const output = 'src/config.ts(10,1): warning TS6133: unused variable';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].severity, 'warning');
  });

  test('TypeScript: multiple errors', () => {
    const output = [
      'src/a.ts(1,1): error TS2304: Cannot find name "foo"',
      'src/b.ts(5,3): error TS2551: Property "bar" does not exist',
    ].join('\n');
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 2);
    assert.strictEqual(errors[0].filePath, 'src/a.ts');
    assert.strictEqual(errors[1].filePath, 'src/b.ts');
  });

  // ── ESLint / Generic colon format ──
  test('ESLint: parses colon format', () => {
    const output = 'src/index.ts:15:10: error: Unexpected console statement';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].filePath, 'src/index.ts');
    assert.strictEqual(errors[0].line, 15);
    assert.strictEqual(errors[0].severity, 'error');
  });

  test('Generic: parses warning', () => {
    const output = 'lib/utils.js:3:1: warning: Missing semicolon';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].severity, 'warning');
  });

  // ── GCC / Clang (C/C++) ──
  test('GCC: parses .c file error', () => {
    const output = 'src/main.c:42:5: error: undeclared identifier "x"';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].filePath, 'src/main.c');
    assert.strictEqual(errors[0].line, 42);
  });

  test('GCC: parses .cpp file warning', () => {
    const output = 'lib/helper.cpp:10:3: warning: unused variable "y"';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].severity, 'warning');
    assert.strictEqual(errors[0].filePath, 'lib/helper.cpp');
  });

  test('Clang: parses fatal error', () => {
    const output = 'src/app.h:1:10: fatal error: file not found';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].severity, 'error');
  });

  // ── Java / Kotlin ──
  test('Java: parses error format', () => {
    const output = 'src/Main.java:25: error: cannot find symbol';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].filePath, 'src/Main.java');
    assert.strictEqual(errors[0].line, 25);
    assert.strictEqual(errors[0].severity, 'error');
  });

  test('Kotlin: parses .kt file', () => {
    const output = 'src/App.kt:12: error: unresolved reference: foo';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].filePath, 'src/App.kt');
  });

  test('Kotlin: parses .kts file', () => {
    const output = 'build.gradle.kts:8: warning: deprecated API usage';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].filePath, 'build.gradle.kts');
    assert.strictEqual(errors[0].severity, 'warning');
  });

  // ── Python traceback ──
  test('Python: parses File "..." line format', () => {
    const output = '  File "src/app.py", line 42, in <module>';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].filePath, 'src/app.py');
    assert.strictEqual(errors[0].line, 42);
    assert.strictEqual(errors[0].severity, 'error');
  });

  test('Python: parses multiple traceback entries', () => {
    const output = [
      'Traceback (most recent call last):',
      '  File "src/main.py", line 10, in <module>',
      '  File "src/utils.py", line 25, in helper',
    ].join('\n');
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 2);
    assert.strictEqual(errors[0].filePath, 'src/main.py');
    assert.strictEqual(errors[1].filePath, 'src/utils.py');
  });

  // ── Rust / Go ──
  test('Rust: parses --> pointer format', () => {
    const output = '  --> src/main.rs:42:5';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].filePath, 'src/main.rs');
    assert.strictEqual(errors[0].line, 42);
  });

  // ── Gradle / Maven ──
  test('Gradle: parses e: format', () => {
    const output = 'e: src/App.kt:42:5 Unresolved reference: foo';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].filePath, 'src/App.kt');
    assert.strictEqual(errors[0].line, 42);
    assert.ok(errors[0].message.includes('Unresolved reference'));
  });

  test('Gradle: parses e: file:// format', () => {
    const output = 'e: file:///home/user/project/src/Main.kt:10:3 Type mismatch';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].line, 10);
    assert.ok(errors[0].message.includes('Type mismatch'));
  });

  // ── Swift ──
  test('Swift: parses error format', () => {
    const output = 'Sources/App.swift:42:5: error: use of unresolved identifier';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].filePath, 'Sources/App.swift');
    assert.strictEqual(errors[0].line, 42);
    assert.strictEqual(errors[0].severity, 'error');
  });

  test('Swift: parses warning format', () => {
    const output = 'Sources/Utils.swift:8:1: warning: result is unused';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].severity, 'warning');
  });

  // ── Deduplication ──
  test('deduplicates same file:line:message', () => {
    const output = [
      'src/app.ts(10,1): error TS2304: Cannot find name "x"',
      'src/app.ts(10,1): error TS2304: Cannot find name "x"',
    ].join('\n');
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 1);
  });

  test('keeps different errors on same file', () => {
    const output = [
      'src/app.ts(10,1): error TS2304: Cannot find name "x"',
      'src/app.ts(20,1): error TS2551: Property "y" does not exist',
    ].join('\n');
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 2);
  });

  // ── Edge cases ──
  test('returns empty for no errors', () => {
    const output = 'Build succeeded.\nDone in 2.3s.';
    const errors = parseErrorOutput(output);
    assert.strictEqual(errors.length, 0);
  });

  test('returns empty for empty string', () => {
    const errors = parseErrorOutput('');
    assert.strictEqual(errors.length, 0);
  });

  test('first matching pattern wins (no mixing)', () => {
    const output = [
      'src/a.ts(1,1): error TS2304: err1',
      'src/b.ts:5:3: error: err2',
    ].join('\n');
    const errors = parseErrorOutput(output);
    // Only TS format matches (first pattern wins)
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].filePath, 'src/a.ts');
  });
});
