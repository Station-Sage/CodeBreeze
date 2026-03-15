import * as assert from 'assert';

// Unit-test the symbol extractor (no VS Code API dependency)
// We replicate the extractSymbols logic here for pure unit testing.

const INCLUDE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.kt', '.java', '.go', '.rs'];

function extractSymbols(content: string, ext: string): string[] {
  const symbols: string[] = [];
  const lines = content.split('\n');
  const patterns: RegExp[] = [];

  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    patterns.push(
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*[(<]/,
      /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
      /^(?:export\s+)?interface\s+(\w+)/,
      /^(?:export\s+)?type\s+(\w+)\s*=/,
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[\w<>[\]|&]+)?\s*=\s*(?:async\s+)?\(/,
    );
  } else if (ext === '.py') {
    patterns.push(/^(?:    )?def\s+(\w+)\s*\(/, /^class\s+(\w+)/);
  } else if (ext === '.kt') {
    patterns.push(
      /^(?:    )?(?:suspend\s+)?fun\s+(\w+)\s*[(<]/,
      /^(?:data\s+|sealed\s+|abstract\s+)?class\s+(\w+)/,
      /^interface\s+(\w+)/,
    );
  } else if (ext === '.go') {
    patterns.push(/^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/, /^type\s+(\w+)\s+struct/);
  }

  for (const line of lines) {
    for (const pat of patterns) {
      const m = line.match(pat);
      if (m && m[1] && !m[1].startsWith('_')) {
        symbols.push(m[1]);
        break;
      }
    }
  }
  return [...new Set(symbols)];
}

suite('ProjectMapCollector Tests', () => {
  test('extract TypeScript functions and classes', () => {
    const src = [
      'export function myFunc(x: number): void {}',
      'export class MyClass {}',
      'export interface MyInterface { id: number }',
      'export type MyType = string | number;',
      'const myArrow = async (x: number) => x + 1;',
    ].join('\n');

    const syms = extractSymbols(src, '.ts');
    assert.ok(syms.includes('myFunc'), 'should find myFunc');
    assert.ok(syms.includes('MyClass'), 'should find MyClass');
    assert.ok(syms.includes('MyInterface'), 'should find MyInterface');
    assert.ok(syms.includes('MyType'), 'should find MyType');
  });

  test('extract Python functions and classes', () => {
    const src = [
      'class MyModel:',
      '    def __init__(self):',
      '    def compute(self):',
      'def standalone_fn():',
    ].join('\n');

    const syms = extractSymbols(src, '.py');
    assert.ok(syms.includes('MyModel'), 'should find class');
    assert.ok(syms.includes('compute'), 'should find method');
    assert.ok(syms.includes('standalone_fn'), 'should find function');
  });

  test('extract Kotlin functions and classes', () => {
    const src = [
      'data class User(val name: String)',
      'fun greet(user: User): String {',
      'suspend fun fetchData(): Result<String> {',
      'interface Repository {',
    ].join('\n');

    const syms = extractSymbols(src, '.kt');
    assert.ok(syms.includes('User'), 'should find data class');
    assert.ok(syms.includes('greet'), 'should find fun');
    assert.ok(syms.includes('fetchData'), 'should find suspend fun');
    assert.ok(syms.includes('Repository'), 'should find interface');
  });

  test('extract Go functions and structs', () => {
    const src = [
      'func NewServer(port int) *Server {',
      'func (s *Server) Start() error {',
      'type Config struct {',
    ].join('\n');

    const syms = extractSymbols(src, '.go');
    assert.ok(syms.includes('NewServer'), 'should find func');
    assert.ok(syms.includes('Start'), 'should find method');
    assert.ok(syms.includes('Config'), 'should find struct');
  });

  test('deduplicate symbols', () => {
    const src = [
      'function foo() {}',
      'function foo() {}',
    ].join('\n');
    const syms = extractSymbols(src, '.js');
    assert.strictEqual(syms.filter((s) => s === 'foo').length, 1, 'dedup');
  });

  test('skip underscore-prefixed symbols', () => {
    const src = 'function _internal() {}\nfunction publicFn() {}';
    const syms = extractSymbols(src, '.ts');
    assert.ok(!syms.includes('_internal'), 'should skip _internal');
    assert.ok(syms.includes('publicFn'), 'should include publicFn');
  });

  test('unsupported extension returns empty', () => {
    const src = 'some content\nmore content';
    const syms = extractSymbols(src, '.xyz');
    assert.strictEqual(syms.length, 0, 'no patterns for unknown ext');
  });
});
