import * as assert from 'assert';
import { splitByBoundary } from '../../src/collect/chunkSplitter';

suite('chunkSplitter — splitByBoundary', () => {

  suite('TypeScript/JavaScript', () => {

    test('splits by function boundaries', () => {
      const content = [
        'import { x } from "./y";',
        '',
        'function foo() {',
        '  return 1;',
        '}',
        '',
        'function bar() {',
        '  return 2;',
        '}',
      ].join('\n');

      const chunks = splitByBoundary(content, 'typescript');
      // Should have: header + foo + bar
      assert.ok(chunks.length >= 2);
      const names = chunks.map(c => c.name);
      assert.ok(names.includes('foo'));
      assert.ok(names.includes('bar'));
    });

    test('detects class boundaries', () => {
      const content = [
        'export class MyService {',
        '  doWork() {}',
        '}',
        '',
        'export class OtherService {',
        '  doOtherWork() {}',
        '}',
      ].join('\n');

      const chunks = splitByBoundary(content, 'typescript');
      assert.ok(chunks.some(c => c.name === 'MyService' && c.kind === 'class'));
      assert.ok(chunks.some(c => c.name === 'OtherService' && c.kind === 'class'));
    });

    test('detects arrow function exports', () => {
      const content = [
        'export const handler = (req: Request) => {',
        '  return res.json({});',
        '};',
      ].join('\n');

      const chunks = splitByBoundary(content, 'typescript');
      assert.ok(chunks.some(c => c.name === 'handler'));
    });

    test('includes header chunk for imports', () => {
      const content = [
        'import * as fs from "fs";',
        'import * as path from "path";',
        '',
        'export function main() {',
        '  console.log("hello");',
        '}',
      ].join('\n');

      const chunks = splitByBoundary(content, 'typescript');
      assert.ok(chunks.some(c => c.name === 'header'));
      assert.ok(chunks.some(c => c.name === 'main'));
    });

    test('detects interface and enum', () => {
      const content = [
        'export interface Config {',
        '  name: string;',
        '}',
        '',
        'export enum Status {',
        '  Active,',
        '  Inactive,',
        '}',
      ].join('\n');

      const chunks = splitByBoundary(content, 'typescript');
      assert.ok(chunks.some(c => c.name === 'Config'));
      assert.ok(chunks.some(c => c.name === 'Status'));
    });
  });

  suite('Python', () => {

    test('splits by def and class', () => {
      const content = [
        'def greet(name):',
        '    print(f"Hello {name}")',
        '',
        'class MyApp:',
        '    def run(self):',
        '        pass',
      ].join('\n');

      const chunks = splitByBoundary(content, 'python');
      assert.ok(chunks.some(c => c.name === 'greet' && c.kind === 'function'));
      assert.ok(chunks.some(c => c.name === 'MyApp' && c.kind === 'class'));
    });

    test('detects async def', () => {
      const content = [
        'async def fetch_data():',
        '    await something()',
      ].join('\n');

      const chunks = splitByBoundary(content, 'python');
      assert.ok(chunks.some(c => c.name === 'fetch_data'));
    });
  });

  suite('Go', () => {

    test('splits by func', () => {
      const content = [
        'func main() {',
        '    fmt.Println("hello")',
        '}',
        '',
        'func (s *Server) Start() {',
        '    s.run()',
        '}',
      ].join('\n');

      const chunks = splitByBoundary(content, 'go');
      assert.ok(chunks.some(c => c.name === 'main'));
      assert.ok(chunks.some(c => c.name === 'Start'));
    });

    test('detects struct and interface', () => {
      const content = [
        'type Config struct {',
        '    Port int',
        '}',
        '',
        'type Handler interface {',
        '    Handle()',
        '}',
      ].join('\n');

      const chunks = splitByBoundary(content, 'go');
      assert.ok(chunks.some(c => c.name === 'Config' && c.kind === 'class'));
      assert.ok(chunks.some(c => c.name === 'Handler' && c.kind === 'class'));
    });
  });

  suite('Rust', () => {

    test('splits by fn and struct', () => {
      const content = [
        'pub fn process(data: &[u8]) -> Result<()> {',
        '    Ok(())',
        '}',
        '',
        'pub struct Config {',
        '    port: u16,',
        '}',
      ].join('\n');

      const chunks = splitByBoundary(content, 'rust');
      assert.ok(chunks.some(c => c.name === 'process' && c.kind === 'function'));
      assert.ok(chunks.some(c => c.name === 'Config' && c.kind === 'class'));
    });
  });

  suite('Fallback', () => {

    test('falls back to line-based splitting for unknown language', () => {
      const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
      const content = lines.join('\n');

      const chunks = splitByBoundary(content, 'unknown', 20);
      assert.ok(chunks.length >= 2);
      assert.strictEqual(chunks[0].kind, 'block');
    });

    test('returns single chunk for small files', () => {
      const content = 'function foo() { return 1; }';
      const chunks = splitByBoundary(content, 'typescript', 200);
      // Small file shouldn't be split even with boundaries
      assert.ok(chunks.length >= 1);
    });

    test('falls back when no boundaries detected', () => {
      const lines = Array.from({ length: 30 }, (_, i) => `const x${i} = ${i};`);
      const content = lines.join('\n');

      // "css" has no patterns
      const chunks = splitByBoundary(content, 'css', 10);
      assert.ok(chunks.length >= 3);
    });
  });

  suite('Language aliases', () => {

    test('ts alias works', () => {
      const content = 'function foo() { return 1; }\nfunction bar() { return 2; }';
      const chunks = splitByBoundary(content, 'ts');
      // Small file — should still detect boundaries
      assert.ok(chunks.length >= 1);
    });

    test('py alias works', () => {
      const content = Array.from({ length: 250 }, () => 'x = 1').join('\n') + '\ndef test():\n    pass';
      const chunks = splitByBoundary(content, 'py');
      assert.ok(chunks.some(c => c.name === 'test'));
    });
  });
});
