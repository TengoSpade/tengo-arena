/**
 * Rule sentences for display (04 §1 signature motif: `IF … THEN … ON …`
 * with small-caps keywords). Labels and parameter slots come from the
 * content vocabulary (tactics-presets.json); slots name the class's
 * abilities. Presentation only: evaluation is core/tactics.
 */
import type { ClassDef, ContentDB, PresetDef, RuleDef } from '../../core/content';

export interface RuleParts {
  id: string;
  /** One phrase per condition (NOT already applied). */
  conditions: string[];
  action: string;
  target: string;
  only: string | null;
  prefer: string | null;
  cooldownS: number;
}

type Params = Record<string, unknown>;

function fillLabel(label: string, params: Params, klass: ClassDef | null, content: ContentDB): string {
  // Optional parts in brackets ("An ally [{role}] is targeted") disappear when their parameter is absent.
  let out = label.replace(/\[([^\]]*)\]/g, (_, inner: string) => {
    const names = [...inner.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
    return names.every((n) => params[n] !== undefined && params[n] !== null) ? inner : '';
  });
  out = out.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    if (v === undefined || v === null) return '';
    if (name === 'slot' && klass && (v === 'a1' || v === 'a2')) return content.abilities.get(klass.abilities[v])?.name ?? String(v);
    if (name === 'role') return content.vocabulary.roles.find((r) => r.id === v)?.name.toLowerCase() ?? String(v);
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    return String(v);
  });
  return out.replace(/\s{2,}/g, ' ').trim();
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

export function ruleParts(rule: RuleDef, klass: ClassDef | null, content: ContentDB): RuleParts {
  const v = content.vocabulary;
  const conditions = rule.if.map((c) => {
    const def = v.conditions.find((d) => d.id === c.cond);
    const text = def ? fillLabel(def.label, c as Params, klass, content) : c.cond;
    return c.not ? `not (${lowerFirst(text)})` : lowerFirst(text);
  });
  const actionDef = v.actions.find((d) => d.id === rule.then.type);
  const action = actionDef ? fillLabel(actionDef.label, rule.then as Params, klass, content) : rule.then.type;
  const selDef = v.selectors.find((d) => d.id === rule.on.sel);
  const target = selDef ? fillLabel(selDef.label, rule.on as Params, klass, content) : rule.on.sel;
  const pred = (p: RuleDef['only']) => {
    if (!p) return null;
    const def = v.predicates.find((d) => d.id === p.pred);
    return def ? fillLabel(def.label, p as Params, klass, content) : p.pred;
  };
  return { id: rule.id.toUpperCase(), conditions, action, target, only: pred(rule.only), prefer: pred(rule.prefer), cooldownS: rule.cooldownS };
}

/** Plain sentence for tooltips: "If my HP is below 60% then Brace on myself". */
export function ruleSentence(parts: RuleParts): string {
  let s = `If ${parts.conditions.join(' and ')} then ${parts.action} on ${parts.target}`;
  if (parts.only) s += `, only ${parts.only}`;
  if (parts.prefer) s += `, prefer ${parts.prefer}`;
  return s;
}

export function stanceName(stance: string, content: ContentDB): string {
  return content.vocabulary.stances.find((s) => s.id === stance)?.name ?? stance;
}

export function stanceDescription(stance: string, content: ContentDB): string {
  return content.vocabulary.stances.find((s) => s.id === stance)?.description ?? '';
}

/** Preset rules as sentences, then the stance line. */
export function presetLines(preset: PresetDef, klass: ClassDef | null, content: ContentDB): string[] {
  const lines = preset.rules.map((r) => {
    const p = ruleParts(r, klass, content);
    return `${p.id} ${ruleSentence(p)}`;
  });
  lines.push(`St ${stanceName(preset.stance, content)} stance: ${lowerFirst(stanceDescription(preset.stance, content))}`);
  return lines;
}
