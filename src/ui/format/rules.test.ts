/**
 * Every preset rule of the shipped content (content/default) renders as words: no `{slot}`,
 * `{a|b}` or `[optional]` markup survives, in the profile/codex sentences and in the report's.
 */
import { describe, expect, it } from 'vitest';
import { loadContent, type ContentDB, type ContentFileName, type RawContentFiles } from '../../core/content';
import { ruleText } from '../screens/match-report/rule-sentence';
import { actionTakesOn, presetLines, ruleParts, ruleSentence } from './rules';

const rawFiles = import.meta.glob('../../../content/default/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

function loadDefault(): ContentDB {
  const raw: RawContentFiles = {};
  for (const [path, json] of Object.entries(rawFiles)) raw[path.split('/').pop()!.replace(/\.json$/, '') as ContentFileName] = json;
  const r = loadContent('default', raw);
  if (!r.ok) throw new Error(`content/default invalid: ${r.error.map((e) => e.message).join('; ')}`);
  return r.value;
}

const content = loadDefault();
const MARKUP = /[{}[\]|]/;

describe('rule sentences on the shipped content', () => {
  it('renders every rule of every preset without leftover slots', () => {
    const presets = content.presets.list;
    expect(presets.length).toBeGreaterThanOrEqual(105);
    const bad: string[] = [];
    for (const preset of presets) {
      const klass = content.classes.list.find((k) => k.presetIds.includes(preset.id)) ?? null;
      for (const rule of preset.rules) {
        const parts = ruleParts(rule, klass, content);
        const sentence = ruleSentence(parts);
        const report = klass ? ruleText(content, rule, klass.id) : '';
        for (const text of [sentence, report, ...parts.conditions, parts.action, parts.target, parts.only ?? '', parts.prefer ?? '']) {
          if (MARKUP.test(text) || /\s{2,}/.test(text)) bad.push(`${preset.id}/${rule.id}: ${text}`);
        }
      }
      for (const line of presetLines(preset, klass, content)) if (MARKUP.test(line)) bad.push(`${preset.id}: ${line}`);
    }
    expect(bad).toEqual([]);
  });

  it('names statuses and categories for {status|category} slots', () => {
    const rule = content.presets.list.flatMap((p) => p.rules).find((r) => r.if.some((c) => c.cond === 'ally_has_status'));
    if (!rule) return;
    const text = ruleParts(rule, null, content).conditions.join(' ');
    expect(text).not.toMatch(/status|category/);
  });

  it('drops ON after an action that ends in a preposition', () => {
    expect(actionTakesOn('Stay with')).toBe(false);
    expect(actionTakesOn('Use Suture')).toBe(true);
  });
});
