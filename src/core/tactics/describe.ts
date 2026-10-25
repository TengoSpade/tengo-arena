/**
 * Rule sentences for the UI (01 §7 grammar: IF ... THEN ... ON ... [ONLY | PREFER]
 * [COOLDOWN]). Every word except the grammar keywords comes from content:
 * vocabulary labels with {param} slots, band, role, status and ability names.
 * Optional label segments in [brackets] appear only when their parameters are set.
 */
import type { ContentDB, RuleDef } from '../content';
import type { ClassId } from '../model';

type Bag = Readonly<Record<string, unknown>>;

function lowerFirst(s: string): string {
  return s.length === 0 ? s : s[0]!.toLowerCase() + s.slice(1);
}

function formatValue(name: string, value: unknown, content: ContentDB, classId: ClassId): string {
  if (name === 'band' && typeof value === 'string') {
    const b = content.combat.bands.find((x) => x.id === value);
    return b ? lowerFirst(b.name) : value;
  }
  if (name === 'role' && typeof value === 'string') {
    const r = content.vocabulary.roles.find((x) => x.id === value);
    return r ? lowerFirst(r.name) : value;
  }
  if (name === 'status' && typeof value === 'string') return content.statuses.get(value)?.name ?? value;
  if (name === 'category' && typeof value === 'string') {
    return lowerFirst(content.combat.statusCategories.find((x) => x.id === value)?.name ?? value);
  }
  if (name === 'slot' && (value === 'a1' || value === 'a2')) {
    const k = content.classes.get(classId);
    return k ? (content.abilities.get(k.abilities[value])?.name ?? value) : value;
  }
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

/** Fill `{a}` and `{a|b}` slots; drop `[...]` segments whose slots are unset. */
export function fillLabel(label: string, bag: Bag, defaults: Bag, content: ContentDB, classId: ClassId): string {
  const valueFor = (slot: string, optionalSegment: boolean): string | null => {
    for (const name of slot.split('|')) {
      const v = bag[name] ?? (optionalSegment ? undefined : defaults[name]);
      if (v !== undefined) return formatValue(name, v, content, classId);
    }
    return null;
  };
  const withOptional = label.replace(/\s*\[([^\]]*)\]/g, (whole, inner: string) => {
    let missing = false;
    const filled = inner.replace(/\{([^}]+)\}/g, (_m, slot: string) => {
      const v = valueFor(slot, true);
      if (v === null) missing = true;
      return v ?? '';
    });
    if (missing) return '';
    return whole.startsWith(' ') || /\s/.test(whole[0] ?? '') ? ` ${filled}` : filled;
  });
  return withOptional.replace(/\{([^}]+)\}/g, (_m, slot: string) => valueFor(slot, false) ?? '?');
}

function defaultsOf(params: readonly { name: string }[] | undefined): Bag {
  const out: Record<string, unknown> = {};
  for (const p of params ?? []) if ('default' in p && p.default !== undefined) out[p.name] = p.default;
  return out;
}

export function describeRuleText(rule: RuleDef, classId: ClassId, content: ContentDB): string {
  const v = content.vocabulary;
  const conds = rule.if.map((c) => {
    const spec = v.conditions.find((x) => x.id === c.cond);
    const text = lowerFirst(fillLabel(spec?.label ?? c.cond, c as Bag, defaultsOf(spec?.params), content, classId));
    return c.not ? `NOT ${text}` : text;
  });
  const act = v.actions.find((x) => x.id === rule.then.type);
  const action = lowerFirst(fillLabel(act?.label ?? rule.then.type, rule.then as Bag, defaultsOf(act?.params), content, classId));
  const sel = v.selectors.find((x) => x.id === rule.on.sel);
  const target = fillLabel(sel?.label ?? rule.on.sel, rule.on as Bag, defaultsOf(sel?.params), content, classId);
  let text = `IF ${conds.join(' AND ')} THEN ${action} ON ${target}`;
  const pred = (p: RuleDef['only']): string => {
    if (!p) return '';
    const spec = v.predicates.find((x) => x.id === p.pred);
    return fillLabel(spec?.label ?? p.pred, p as Bag, defaultsOf(spec?.params), content, classId);
  };
  if (rule.only) text += ` ONLY ${pred(rule.only)}`;
  if (rule.prefer) text += ` PREFER ${pred(rule.prefer)}`;
  if (rule.cooldownS > 0) text += ` COOLDOWN ${rule.cooldownS} s`;
  return text;
}
