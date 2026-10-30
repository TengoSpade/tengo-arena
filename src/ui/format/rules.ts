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
  /** False when the action already ends in a preposition ("Stay with"): no ON keyword before the target. */
  joinOn: boolean;
}

/** "Stay with" + target reads "stay with our tank", not "stay with ON our tank". */
export function actionTakesOn(action: string): boolean {
  return !/\s(with|to|near|beside|behind|at|by|from)$/i.test(` ${action.trim()}`);
}

type Params = Record<string, unknown>;

function lowerFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** A parameter value in words (mirrors core/tactics describe: bands, roles, statuses, categories, ability slots). */
function formatValue(name: string, v: unknown, klass: ClassDef | null, content: ContentDB): string {
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v !== 'string') return String(v);
  if (name === 'slot' && klass && (v === 'a1' || v === 'a2')) return content.abilities.get(klass.abilities[v])?.name ?? v;
  if (name === 'role') return lowerFirst(content.vocabulary.roles.find((r) => r.id === v)?.name ?? v);
  if (name === 'band') return lowerFirst(content.combat.bands.find((b) => b.id === v)?.name ?? v);
  if (name === 'status') return content.statuses.get(v)?.name ?? v;
  if (name === 'category') return lowerFirst(content.combat.statusCategories.find((c) => c.id === v)?.name ?? v);
  return v;
}

/** Spec defaults, so a slot the rule leaves unset still reads as its default (core describe does the same). */
function defaultsOf(params: readonly { name: string; default?: unknown }[] | undefined): Params {
  const out: Params = {};
  for (const p of params ?? []) if (p.default !== undefined) out[p.name] = p.default;
  return out;
}

/**
 * Fill a vocabulary label. `{a}` takes a parameter; `{a|b}` takes the first that is set
 * ("{status|category}"); `[...]` segments disappear unless all their slots are set.
 */
function fillLabel(label: string, params: Params, defaults: Params, klass: ClassDef | null, content: ContentDB): string {
  const valueFor = (slot: string, optional: boolean): string | null => {
    for (const name of slot.split('|')) {
      const v = params[name] ?? (optional ? undefined : defaults[name]);
      if (v !== undefined && v !== null) return formatValue(name, v, klass, content);
    }
    return null;
  };
  let out = label.replace(/\[([^\]]*)\]/g, (_, inner: string) => {
    let missing = false;
    const filled = inner.replace(/\{([^}]+)\}/g, (_m, slot: string) => {
      const v = valueFor(slot, true);
      if (v === null) missing = true;
      return v ?? '';
    });
    return missing ? '' : filled;
  });
  out = out.replace(/\{([^}]+)\}/g, (_m, slot: string) => valueFor(slot, false) ?? '');
  return out.replace(/\s{2,}/g, ' ').trim();
}

export function ruleParts(rule: RuleDef, klass: ClassDef | null, content: ContentDB): RuleParts {
  const v = content.vocabulary;
  const conditions = rule.if.map((c) => {
    const def = v.conditions.find((d) => d.id === c.cond);
    const text = def ? fillLabel(def.label, c as Params, defaultsOf(def.params), klass, content) : c.cond;
    return c.not ? `not (${lowerFirst(text)})` : lowerFirst(text);
  });
  const actionDef = v.actions.find((d) => d.id === rule.then.type);
  const action = lowerFirst(actionDef ? fillLabel(actionDef.label, rule.then as Params, defaultsOf(actionDef.params), klass, content) : rule.then.type);
  const selDef = v.selectors.find((d) => d.id === rule.on.sel);
  const target = selDef ? fillLabel(selDef.label, rule.on as Params, defaultsOf(selDef.params), klass, content) : rule.on.sel;
  const pred = (p: RuleDef['only']) => {
    if (!p) return null;
    const def = v.predicates.find((d) => d.id === p.pred);
    return def ? fillLabel(def.label, p as Params, defaultsOf(def.params), klass, content) : p.pred;
  };
  return { id: rule.id.toUpperCase(), conditions, action, target, only: pred(rule.only), prefer: pred(rule.prefer), cooldownS: rule.cooldownS, joinOn: actionTakesOn(action) };
}

/** Plain sentence for tooltips: "If my HP is below 60% then Brace on myself". */
export function ruleSentence(parts: RuleParts): string {
  let s = `If ${parts.conditions.join(' and ')} then ${parts.action}${parts.joinOn ? ' on' : ''} ${parts.target}`;
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
