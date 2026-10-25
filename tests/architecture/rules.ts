/**
 * Architecture rules checker (authoritative; run by `npm test`).
 *
 * - src/core is pure TypeScript: no DOM/Node/PixiJS/Preact imports, no
 *   ambient platform globals (window, document, console, timers, Date, ...),
 *   no Math.random, no engine-dependent math (Math.sin/exp/pow/..., **), no
 *   locale-dependent string APIs.
 * - core modules may depend only on the modules listed in CORE_MODULE_DEPS,
 *   and only through their index.ts (no deep imports across modules).
 * - src/ui, src/platform and src/render import core modules through index.ts
 *   only; render and platform must not import ui.
 *
 * ESLint mirrors some of these rules for editor feedback; this file decides.
 * Changing the tables below is an architect-owned change (docs/design 05 §11).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Allowed dependencies between core modules (module -> modules it may import). */
export const CORE_MODULE_DEPS: Readonly<Record<string, readonly string[]>> = {
  util: [],
  rng: ['util'],
  model: ['util', 'rng'],
  content: ['util', 'model'],
  tactics: ['util', 'rng', 'model', 'content'],
  sim: ['util', 'rng', 'model', 'content', 'tactics'],
  fighters: ['util', 'rng', 'model', 'content'],
  league: ['util', 'rng', 'model', 'content'],
  economy: ['util', 'rng', 'model', 'content'],
  ai: ['util', 'rng', 'model', 'content', 'tactics', 'fighters', 'league', 'economy'],
  save: ['util', 'rng', 'model', 'content'],
  game: ['util', 'rng', 'model', 'content', 'tactics', 'sim', 'fighters', 'league', 'economy', 'ai'],
  harness: ['util', 'rng', 'model', 'content', 'tactics', 'sim', 'fighters', 'league', 'economy', 'ai', 'game', 'save'],
};

/** npm packages core code may import. */
export const CORE_ALLOWED_PACKAGES: readonly string[] = ['zod'];
/** Extra packages core TEST files may import. */
export const CORE_TEST_ALLOWED_PACKAGES: readonly string[] = ['vitest'];
/** Core modules src/render may import (read-only consumer of the event stream). */
export const RENDER_ALLOWED_CORE: readonly string[] = ['util', 'rng', 'model', 'content', 'sim'];

/** Identifiers that must not be referenced in core (platform globals, clocks, entropy, output). */
export const BANNED_GLOBALS: ReadonlySet<string> = new Set([
  'window',
  'document',
  'navigator',
  'location',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'alert',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'setImmediate',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'performance',
  'process',
  'require',
  'module',
  '__dirname',
  '__filename',
  'globalThis',
  'self',
  'global',
  'Buffer',
  'Date',
  'crypto',
  'console',
  'Intl',
]);

/** Math members whose results are not bit-identical across JS engines (or are random). */
export const BANNED_MATH: ReadonlySet<string> = new Set([
  'random',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'cbrt',
  'hypot',
]);

/** Locale-dependent methods (results vary by user locale). */
export const BANNED_METHODS: ReadonlySet<string> = new Set([
  'localeCompare',
  'toLocaleString',
  'toLocaleDateString',
  'toLocaleTimeString',
  'toLocaleUpperCase',
  'toLocaleLowerCase',
]);

export interface Violation {
  file: string;
  line: number;
  rule: string;
  message: string;
}

const SOURCE_EXT = /\.(ts|tsx|mts|cts)$/;
const TEST_FILE = /\.test\.(ts|tsx)$/;

export function listSourceFiles(dirRel: string): string[] {
  const abs = join(ROOT, dirRel);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (SOURCE_EXT.test(name) && !name.endsWith('.d.ts')) out.push(toRel(full));
    }
  };
  walk(abs);
  return out.sort();
}

function toRel(abs: string): string {
  return relative(ROOT, abs).split('\\').join('/');
}

type Area = { kind: 'core'; module: string | null } | { kind: 'ui' | 'platform' | 'render' | 'other' };

function areaOf(relPath: string): Area {
  const parts = relPath.split('/');
  if (parts[0] !== 'src') return { kind: 'other' };
  if (parts[1] === 'core') return { kind: 'core', module: parts.length > 3 ? (parts[2] ?? null) : null };
  if (parts[1] === 'ui' || parts[1] === 'platform' || parts[1] === 'render') return { kind: parts[1] };
  return { kind: 'other' };
}

/** For a relative import, where it lands: core module + whether it targets the module's index. */
function resolveTarget(fromRel: string, spec: string): { rel: string; coreModule: string | null; isIndex: boolean } {
  const targetRel = toRel(resolve(ROOT, dirname(fromRel), spec)).replace(SOURCE_EXT, '');
  const parts = targetRel.split('/');
  if (parts[0] === 'src' && parts[1] === 'core' && parts[2] !== undefined) {
    const rest = parts.slice(3);
    const isIndex = rest.length === 0 || (rest.length === 1 && rest[0] === 'index');
    return { rel: targetRel, coreModule: parts[2], isIndex };
  }
  return { rel: targetRel, coreModule: null, isIndex: false };
}

function packageName(spec: string): string {
  if (spec.startsWith('@')) return spec.split('/').slice(0, 2).join('/');
  return spec.split('/')[0] ?? spec;
}

function collectImports(sf: ts.SourceFile): { spec: string; node: ts.Node }[] {
  const found: { spec: string; node: ts.Node }[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) found.push({ spec: node.moduleSpecifier.text, node });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteralLike(arg)) found.push({ spec: arg.text, node });
    } else if (ts.isImportTypeNode(node)) {
      const arg = node.argument;
      if (ts.isLiteralTypeNode(arg) && ts.isStringLiteral(arg.literal)) found.push({ spec: arg.literal.text, node });
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const expr = node.moduleReference.expression;
      if (ts.isStringLiteral(expr)) found.push({ spec: expr.text, node });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function isDeclarationName(node: ts.Identifier): boolean {
  const p = node.parent;
  if (!p) return false;
  if ((ts.isPropertyAccessExpression(p) || ts.isQualifiedName(p)) && (p as ts.PropertyAccessExpression).name === node) {
    return true;
  }
  if (
    (ts.isPropertyAssignment(p) ||
      ts.isPropertySignature(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isMethodSignature(p) ||
      ts.isGetAccessorDeclaration(p) ||
      ts.isSetAccessorDeclaration(p) ||
      ts.isEnumMember(p)) &&
    p.name === node
  ) {
    return true;
  }
  if (ts.isLabeledStatement(p) && p.label === node) return true;
  if (ts.isBindingElement(p) && p.propertyName === node) return true;
  return false;
}

/** Check one file's text. Exported so the rules themselves can be unit-tested on synthetic sources. */
export function checkSource(relPath: string, text: string): Violation[] {
  const area = areaOf(relPath);
  const isTest = TEST_FILE.test(relPath);
  const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, relPath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const violations: Violation[] = [];
  const add = (node: ts.Node, rule: string, message: string): void => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    violations.push({ file: relPath, line: line + 1, rule, message });
  };

  // ---- imports ---------------------------------------------------------
  for (const { spec, node } of collectImports(sf)) {
    const relative = spec.startsWith('.') || spec.startsWith('/');
    if (area.kind === 'core') {
      if (!relative) {
        const pkg = packageName(spec);
        const allowed = CORE_ALLOWED_PACKAGES.includes(pkg) || (isTest && CORE_TEST_ALLOWED_PACKAGES.includes(pkg));
        if (!allowed) add(node, 'core-package', `core may not import "${spec}" (allowed: ${CORE_ALLOWED_PACKAGES.join(', ')})`);
        continue;
      }
      const target = resolveTarget(relPath, spec);
      if (target.coreModule === null) {
        add(node, 'core-escape', `core may not import outside src/core ("${spec}" -> ${target.rel})`);
        continue;
      }
      const self = area.module;
      if (self === null) {
        add(node, 'core-layout', 'files directly in src/core are not allowed; put code in a module folder');
        continue;
      }
      if (target.coreModule === self) continue;
      const deps = CORE_MODULE_DEPS[self];
      if (!deps) {
        add(node, 'core-unknown-module', `module "${self}" is not registered in CORE_MODULE_DEPS`);
        continue;
      }
      if (!deps.includes(target.coreModule)) {
        add(node, 'core-dependency', `core/${self} may not depend on core/${target.coreModule} (allowed: ${deps.join(', ') || 'none'})`);
      } else if (!target.isIndex) {
        add(node, 'deep-import', `import core/${target.coreModule} through its index.ts, not "${spec}"`);
      }
    } else if (area.kind === 'ui' || area.kind === 'platform' || area.kind === 'render') {
      if (!relative) {
        if (area.kind === 'render' || area.kind === 'platform' || area.kind === 'ui') {
          // Packages are governed by package.json review; PixiJS only in render.
          if (packageName(spec) === 'pixi.js' && area.kind !== 'render') {
            add(node, 'pixi-outside-render', `only src/render may import pixi.js (M2 viewer)`);
          }
        }
        continue;
      }
      const target = resolveTarget(relPath, spec);
      if (target.coreModule !== null) {
        if (!target.isIndex) add(node, 'deep-import', `import core/${target.coreModule} through its index.ts, not "${spec}"`);
        if (area.kind === 'render' && !RENDER_ALLOWED_CORE.includes(target.coreModule)) {
          add(node, 'render-dependency', `src/render may only read core/{${RENDER_ALLOWED_CORE.join(',')}}, not core/${target.coreModule}`);
        }
      } else if ((area.kind === 'render' || area.kind === 'platform') && target.rel.startsWith('src/ui/')) {
        add(node, `${area.kind}-imports-ui`, `src/${area.kind} must not import src/ui ("${spec}")`);
      }
    }
  }

  if (area.kind !== 'core') return violations;

  // ---- globals, Math, locale APIs, ** -----------------------------------
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && BANNED_GLOBALS.has(node.text) && !isDeclarationName(node)) {
      add(node, 'core-global', `"${node.text}" is not available in core (pure, deterministic, platform-free)`);
    }
    if (ts.isPropertyAccessExpression(node)) {
      const name = node.name.text;
      if (ts.isIdentifier(node.expression) && node.expression.text === 'Math' && BANNED_MATH.has(name)) {
        add(
          node,
          name === 'random' ? 'core-math-random' : 'core-math-nondeterministic',
          name === 'random'
            ? 'Math.random is banned in core: use core/rng'
            : `Math.${name} is engine-dependent; use core/util/math or add a deterministic helper there`,
        );
      }
      if (BANNED_METHODS.has(name)) add(node, 'core-locale', `.${name}() is locale-dependent; use compareStrings / explicit formatting in ui`);
    }
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Math') {
      add(node, 'core-math-dynamic', 'dynamic Math[...] access is not allowed in core');
    }
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.initializer) && node.initializer.text === 'Math' && ts.isObjectBindingPattern(node.name)) {
      add(node, 'core-math-dynamic', 'destructuring Math is not allowed in core');
    }
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskToken ||
        node.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken)
    ) {
      add(node, 'core-math-nondeterministic', 'the ** operator is engine-dependent; use sq()/powi() from core/util');
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return violations;
}

export function checkFiles(relPaths: readonly string[]): Violation[] {
  return relPaths.flatMap((rel) => checkSource(rel, readFileSync(join(ROOT, rel), 'utf8')));
}

/** Every core module folder must be registered and have README.md + index.ts (ownership clarity). */
export function checkCoreLayout(): Violation[] {
  const coreDir = join(ROOT, 'src', 'core');
  const out: Violation[] = [];
  for (const name of readdirSync(coreDir)) {
    const full = join(coreDir, name);
    if (!statSync(full).isDirectory()) {
      if (name !== 'README.md') out.push({ file: `src/core/${name}`, line: 1, rule: 'core-layout', message: 'only module folders (and README.md) belong in src/core' });
      continue;
    }
    if (!CORE_MODULE_DEPS[name]) {
      out.push({ file: `src/core/${name}`, line: 1, rule: 'core-unknown-module', message: `module "${name}" is not registered in CORE_MODULE_DEPS` });
    }
    for (const required of ['README.md', 'index.ts']) {
      if (!existsSync(join(full, required))) {
        out.push({ file: `src/core/${name}/${required}`, line: 1, rule: 'core-layout', message: `missing ${required}` });
      }
    }
  }
  return out;
}

export function formatViolations(violations: readonly Violation[]): string {
  return violations.map((v) => `${v.file}:${v.line}  [${v.rule}] ${v.message}`).join('\n');
}
