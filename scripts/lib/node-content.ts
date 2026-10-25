/**
 * Node-side content loader for the headless CLIs: reads content/<theme>/*.json
 * into RawContentFiles. Validation is core/content's job (phase B); this only
 * does IO and JSON parsing, reporting the file name on syntax errors.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_FILE_NAMES, type RawContentFiles } from '../../src/core/content';

export const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export interface NodeContentResult {
  themeId: string;
  dir: string;
  raw: RawContentFiles;
  missing: string[];
  errors: string[];
}

export function loadRawContentFromDisk(themeId = 'default'): NodeContentResult {
  const dir = join(REPO_ROOT, 'content', themeId);
  const raw: RawContentFiles = {};
  const missing: string[] = [];
  const errors: string[] = [];
  for (const name of CONTENT_FILE_NAMES) {
    const file = join(dir, `${name}.json`);
    if (!existsSync(file)) {
      missing.push(`${name}.json`);
      continue;
    }
    try {
      raw[name] = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    } catch (e) {
      errors.push(`${name}.json: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { themeId, dir, raw, missing, errors };
}
