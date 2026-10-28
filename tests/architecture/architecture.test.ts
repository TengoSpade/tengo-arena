import { describe, expect, it } from 'vitest';
import { checkCoreLayout, checkFiles, checkSource, formatViolations, listSourceFiles, type Violation } from './rules';

// These three parse every source file with the TypeScript compiler: about a second alone, but several
// seconds when the whole suite shares a busy machine. The assertions are unchanged; only the allowance grows.
const WHOLE_CODEBASE_MS = 60_000;

function expectClean(violations: Violation[]): void {
  if (violations.length > 0) {
    throw new Error(`Architecture violations (${violations.length}):\n${formatViolations(violations)}`);
  }
}

describe('architecture: the real codebase', () => {
  it('src/core is pure, deterministic and respects module dependencies', () => {
    const files = listSourceFiles('src/core');
    expect(files.length).toBeGreaterThan(0);
    expectClean(checkFiles(files));
  }, WHOLE_CODEBASE_MS);

  it('every core module is registered and has README.md and index.ts', () => {
    expectClean(checkCoreLayout());
  }, WHOLE_CODEBASE_MS);

  it('src/ui, src/platform and src/render use core only through module index files', () => {
    expectClean(checkFiles([...listSourceFiles('src/ui'), ...listSourceFiles('src/platform'), ...listSourceFiles('src/render')]));
  }, WHOLE_CODEBASE_MS);
});

describe('architecture: the checker catches violations (guards against a vacuous pass)', () => {
  const rulesOf = (path: string, text: string) => checkSource(path, text).map((v) => v.rule);

  it('flags DOM, PixiJS, Preact and Node imports in core', () => {
    expect(rulesOf('src/core/sim/a.ts', `import { Application } from 'pixi.js';`)).toEqual(['core-package']);
    expect(rulesOf('src/core/sim/a.ts', `import { h } from 'preact';`)).toEqual(['core-package']);
    expect(rulesOf('src/core/sim/a.ts', `import fs from 'node:fs';`)).toEqual(['core-package']);
    expect(rulesOf('src/core/sim/a.ts', `const m = await import('pixi.js');`)).toEqual(['core-package']);
    expect(rulesOf('src/core/sim/a.ts', `export type X = import('pixi.js').Sprite;`)).toEqual(['core-package']);
    expect(rulesOf('src/core/content/a.ts', `import { z } from 'zod';`)).toEqual([]);
    expect(rulesOf('src/core/sim/a.test.ts', `import { it } from 'vitest';`)).toEqual([]);
    expect(rulesOf('src/core/sim/a.ts', `import { it } from 'vitest';`)).toEqual(['core-package']);
  });

  it('flags imports that escape core or break the module graph', () => {
    expect(rulesOf('src/core/sim/a.ts', `import { x } from '../../ui/store';`)).toEqual(['core-escape']);
    expect(rulesOf('src/core/sim/a.ts', `import { x } from '../game';`)).toEqual(['core-dependency']);
    expect(rulesOf('src/core/sim/a.ts', `import { x } from '../tactics/internal/eval';`)).toEqual(['deep-import']);
    expect(rulesOf('src/core/sim/a.ts', `import { x } from '../tactics';`)).toEqual([]);
    expect(rulesOf('src/core/sim/a.ts', `import { x } from '../tactics/index';`)).toEqual([]);
    expect(rulesOf('src/core/sim/a.ts', `import { x } from './engine/step';`)).toEqual([]);
    expect(rulesOf('src/core/newthing/a.ts', `import { x } from '../util';`)).toEqual(['core-unknown-module']);
  });

  it('flags randomness, clocks, platform globals and output in core', () => {
    expect(rulesOf('src/core/sim/a.ts', `const r = Math.random();`)).toEqual(['core-math-random']);
    expect(rulesOf('src/core/sim/a.ts', `const t = Date.now();`)).toEqual(['core-global']);
    expect(rulesOf('src/core/sim/a.ts', `const d = new Date();`)).toEqual(['core-global']);
    expect(rulesOf('src/core/sim/a.ts', `const t = performance.now();`)).toEqual(['core-global']);
    expect(rulesOf('src/core/sim/a.ts', `document.body.append('x');`)).toEqual(['core-global']);
    expect(rulesOf('src/core/sim/a.ts', `window.alert('x');`)).toEqual(['core-global']);
    expect(rulesOf('src/core/sim/a.ts', `setTimeout(() => 1, 5);`)).toEqual(['core-global']);
    expect(rulesOf('src/core/sim/a.ts', `console.log('x');`)).toEqual(['core-global']);
    expect(rulesOf('src/core/sim/a.ts', `const v = crypto.getRandomValues(new Uint32Array(1));`)).toEqual(['core-global']);
    expect(rulesOf('src/core/sim/a.ts', `const g = globalThis;`)).toEqual(['core-global']);
  });

  it('flags engine-dependent math and locale APIs in core', () => {
    expect(rulesOf('src/core/sim/a.ts', `const a = Math.atan2(1, 2);`)).toEqual(['core-math-nondeterministic']);
    expect(rulesOf('src/core/sim/a.ts', `const a = Math.pow(2, 3);`)).toEqual(['core-math-nondeterministic']);
    expect(rulesOf('src/core/sim/a.ts', `const a = 2 ** 3;`)).toEqual(['core-math-nondeterministic']);
    expect(rulesOf('src/core/sim/a.ts', `let a = 2; a **= 2;`)).toEqual(['core-math-nondeterministic']);
    expect(rulesOf('src/core/sim/a.ts', `const f = Math['random'];`)).toEqual(['core-math-dynamic']);
    expect(rulesOf('src/core/sim/a.ts', `const { random } = Math;`)).toEqual(['core-math-dynamic']);
    expect(rulesOf('src/core/sim/a.ts', `const s = ['b', 'a'].sort((x, y) => x.localeCompare(y));`)).toEqual(['core-locale']);
    expect(rulesOf('src/core/sim/a.ts', `const a = Math.sqrt(2) + Math.floor(1.5) + Math.imul(3, 4);`)).toEqual([]);
  });

  it('does not flag property names or declarations that share a banned name', () => {
    expect(rulesOf('src/core/sim/a.ts', `const o = { console: 1, Date: 2 }; const v = o.console + o.Date;`)).toEqual([]);
    expect(rulesOf('src/core/sim/a.ts', `interface X { process: number; window(): void }`)).toEqual([]);
  });

  it('keeps core/testkit out of production code', () => {
    expect(rulesOf('src/core/sim/a.ts', `import { fixtureContent } from '../testkit';`)).toEqual(['testkit-in-production']);
    expect(rulesOf('src/core/sim/a.test.ts', `import { fixtureContent } from '../testkit';`)).toEqual([]);
    expect(rulesOf('src/ui/screens/squad/index.tsx', `import { x } from '../../../core/testkit';`)).toEqual(['testkit-in-production']);
    expect(rulesOf('src/ui/screens/squad/squad.test.tsx', `import { x } from '../../../core/testkit';`)).toEqual([]);
    expect(rulesOf('src/ui/debug/fixture-world.ts', `const m = await import('../../core/testkit');`)).toEqual([]);
  });

  it('flags deep imports and forbidden directions outside core', () => {
    expect(rulesOf('src/ui/screens/squad/Squad.tsx', `import { x } from '../../../core/sim/engine';`)).toEqual(['deep-import']);
    expect(rulesOf('src/ui/screens/squad/Squad.tsx', `import { x } from '../../../core/sim';`)).toEqual([]);
    expect(rulesOf('src/render/arena/Stage.ts', `import { x } from '../../core/game';`)).toEqual(['render-dependency']);
    expect(rulesOf('src/render/arena/Stage.ts', `import { x } from '../../ui/store';`)).toEqual(['render-imports-ui']);
    expect(rulesOf('src/platform/storage.ts', `import { x } from '../ui/store';`)).toEqual(['platform-imports-ui']);
    expect(rulesOf('src/ui/app/App.tsx', `import { Application } from 'pixi.js';`)).toEqual(['pixi-outside-render']);
    expect(rulesOf('src/render/viewer/Stage.ts', `import { Application } from 'pixi.js';`)).toEqual([]);
  });

  it('M2: keeps the pure half of src/render free of PixiJS, the DOM, clocks and randomness', () => {
    expect(rulesOf('src/render/timeline/sample.ts', `import { Container } from 'pixi.js';`)).toEqual(['render-pure']);
    expect(rulesOf('src/render/timeline/sample.ts', `import type { Container } from 'pixi.js';`)).toEqual(['render-pure']);
    expect(rulesOf('src/render/timeline/sample.ts', `import { x } from '../viewer/scene';`)).toEqual(['render-pure']);
    expect(rulesOf('src/render/timeline/sample.ts', `const t = performance.now();`)).toEqual(['render-pure']);
    expect(rulesOf('src/render/cues/a.ts', `const w = window.innerWidth;`)).toEqual(['render-pure']);
    expect(rulesOf('src/render/cues/a.ts', `const r = Math.random();`)).toEqual(['render-pure']);
    expect(rulesOf('src/render/cues/a.ts', `const o = { document: 1 }; const v = o.document + Math.floor(1.5);`)).toEqual([]);
    expect(rulesOf('src/render/timeline/sample.ts', `import { x } from '../../core/model';`)).toEqual([]);
    expect(rulesOf('src/render/timeline/sample.test.ts', `const t = performance.now();`)).toEqual([]);
    expect(rulesOf('src/render/viewer/scene.ts', `import { Container } from 'pixi.js'; requestAnimationFrame(() => 1);`)).toEqual([]);
    expect(rulesOf('src/render/skins/placeholder/body.ts', `import { Graphics } from 'pixi.js';`)).toEqual([]);
  });

  it('M2: src/ui loads the PixiJS viewer only lazily, and render and platform stay apart', () => {
    const ui = 'src/ui/screens/arena/index.tsx';
    expect(rulesOf(ui, `import { sampleAt } from '../../../render';`)).toEqual([]);
    expect(rulesOf(ui, `import type { ArenaViewer } from '../../../render/viewer';`)).toEqual([]);
    expect(rulesOf(ui, `import { type ArenaViewer } from '../../../render/viewer';`)).toEqual([]);
    expect(rulesOf(ui, `const m = await import('../../../render/viewer');`)).toEqual([]);
    expect(rulesOf(ui, `import { createArenaViewer } from '../../../render/viewer';`)).toEqual(['ui-render-viewer-static']);
    expect(rulesOf(ui, `import '../../../render/viewer';`)).toEqual(['ui-render-viewer-static']);
    expect(rulesOf(ui, `export { createArenaViewer } from '../../../render/viewer';`)).toEqual(['ui-render-viewer-static']);
    expect(rulesOf(ui, `import { sampleAt } from '../../../render/timeline';`)).toEqual(['render-deep-import']);
    expect(rulesOf(ui, `const m = await import('../../../render/skins/placeholder');`)).toEqual(['render-deep-import']);
    expect(rulesOf('src/platform/save-store.ts', `import type { Speed } from '../render';`)).toEqual(['platform-imports-render']);
    expect(rulesOf('src/render/viewer/scene.ts', `import { x } from '../../platform/browser';`)).toEqual(['render-imports-platform']);
  });
});
