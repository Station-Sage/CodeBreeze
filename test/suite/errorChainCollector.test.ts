import * as assert from 'assert';
import { extractImports, resolveImportPath, traceImportChain } from '../../src/collect/errorChainCollector';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('errorChainCollector', () => {

  suite('extractImports', () => {

    test('ES import: named import from relative path', () => {
      const content = `import { foo } from './utils';`;
      const imports = extractImports(content);
      assert.ok(imports.includes('./utils'));
    });

    test('ES import: default import', () => {
      const content = `import Config from '../config';`;
      const imports = extractImports(content);
      assert.ok(imports.includes('../config'));
    });

    test('ES import: side-effect import', () => {
      const content = `import './polyfill';`;
      const imports = extractImports(content);
      assert.ok(imports.includes('./polyfill'));
    });

    test('CommonJS require', () => {
      const content = `const fs = require('fs');\nconst utils = require('./utils');`;
      const imports = extractImports(content);
      assert.ok(imports.includes('fs'));
      assert.ok(imports.includes('./utils'));
    });

    test('Python import', () => {
      const content = `from os.path import join\nimport sys`;
      const imports = extractImports(content);
      assert.ok(imports.includes('os.path'));
      assert.ok(imports.includes('sys'));
    });

    test('C/C++ include', () => {
      const content = `#include "header.h"\n#include <stdio.h>`;
      const imports = extractImports(content);
      assert.ok(imports.includes('header.h'));
    });

    test('deduplicates imports', () => {
      const content = `import { a } from './utils';\nimport { b } from './utils';`;
      const imports = extractImports(content);
      const utilsCount = imports.filter(i => i === './utils').length;
      assert.strictEqual(utilsCount, 1);
    });

    test('returns empty for no imports', () => {
      const content = `const x = 42;\nconsole.log(x);`;
      const imports = extractImports(content);
      assert.strictEqual(imports.length, 0);
    });
  });

  suite('resolveImportPath', () => {

    test('returns null for non-relative paths (packages)', () => {
      const result = resolveImportPath('lodash', '/src/app.ts', '/workspace');
      assert.strictEqual(result, null);
    });

    test('resolves relative path with extension', () => {
      // This test uses actual filesystem — create a temp file
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-test-'));
      const fromFile = path.join(tmpDir, 'src', 'app.ts');
      const targetFile = path.join(tmpDir, 'src', 'utils.ts');
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(targetFile, 'export const x = 1;');

      const result = resolveImportPath('./utils', fromFile, tmpDir);
      assert.strictEqual(result, targetFile);

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true });
    });

    test('resolves index file in directory', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-test-'));
      const fromFile = path.join(tmpDir, 'app.ts');
      const utilsDir = path.join(tmpDir, 'utils');
      const indexFile = path.join(utilsDir, 'index.ts');
      fs.mkdirSync(utilsDir, { recursive: true });
      fs.writeFileSync(indexFile, 'export const x = 1;');

      const result = resolveImportPath('./utils', fromFile, tmpDir);
      assert.strictEqual(result, indexFile);

      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  suite('traceImportChain', () => {

    test('traces single-depth imports', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-test-'));
      const mainFile = path.join(tmpDir, 'main.ts');
      const utilFile = path.join(tmpDir, 'util.ts');

      fs.writeFileSync(mainFile, `import { helper } from './util';`);
      fs.writeFileSync(utilFile, `export function helper() {}`);

      const chain = traceImportChain(mainFile, tmpDir, 1);
      assert.ok(chain.includes(utilFile));

      fs.rmSync(tmpDir, { recursive: true });
    });

    test('handles circular imports without infinite loop', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-test-'));
      const fileA = path.join(tmpDir, 'a.ts');
      const fileB = path.join(tmpDir, 'b.ts');

      fs.writeFileSync(fileA, `import { b } from './b';`);
      fs.writeFileSync(fileB, `import { a } from './a';`);

      // Should not hang
      const chain = traceImportChain(fileA, tmpDir, 5);
      assert.ok(chain.includes(fileB));
      // Should not include fileA again (visited set)
      assert.ok(!chain.includes(fileA));

      fs.rmSync(tmpDir, { recursive: true });
    });

    test('respects depth limit', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-test-'));
      const fileA = path.join(tmpDir, 'a.ts');
      const fileB = path.join(tmpDir, 'b.ts');
      const fileC = path.join(tmpDir, 'c.ts');

      fs.writeFileSync(fileA, `import { b } from './b';`);
      fs.writeFileSync(fileB, `import { c } from './c';`);
      fs.writeFileSync(fileC, `export const c = 1;`);

      // Depth 0 — only direct imports (b found, but b's imports not followed)
      const chain0 = traceImportChain(fileA, tmpDir, 0);
      assert.ok(chain0.includes(fileB));
      assert.ok(!chain0.includes(fileC));

      // Depth 1 — includes b and c (b's imports are followed)
      const chain1 = traceImportChain(fileA, tmpDir, 1);
      assert.ok(chain1.includes(fileB));
      assert.ok(chain1.includes(fileC));

      fs.rmSync(tmpDir, { recursive: true });
    });
  });
});
