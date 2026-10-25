/**
 * A preset rule as a sentence (04 §1 signature motif: "IF … THEN … ON …"
 * with small-caps keywords), built from the content vocabulary labels of
 * tactics-presets.json. Presentation only: it renders the rule the fighter
 * carried, it never evaluates it.
 */
import { Fragment } from 'preact';
import type { ContentDB, RuleDef } from '../../../core/content';
import type { TacticsAssignment } from '../../../core/model';
import { t } from './text';

type Params = Record<string, string | number | boolean | undefined>;

function bandName(content: ContentDB, id: unknown): string {
  return content.combat.bands.find((b) => b.id === id)?.name.toLowerCase() ?? String(id);
}

function roleName(content: ContentDB, id: unknown): string {
  return content.vocabulary.roles.find((r) => r.id === id)?.name ?? String(id);
}

function paramValue(content: ContentDB, name: string, params: Params, classId: string): string | null {
  const v = params[name];
  if (v === undefined) return null;
  switch (name) {
    case 'band':
      return bandName(content, v);
    case 'role':
      return roleName(content, v);
    case 'slot': {
      try {
        return content.classAbility(classId, v as 'a1' | 'a2').name;
      } catch {
        return String(v);
      }
    }
    case 'status':
      return content.statuses.get(String(v))?.name ?? String(v);
    case 'category':
      return content.combat.statusCategories.find((c) => c.id === v)?.name.toLowerCase() ?? String(v);
    case 'includeSelf':
      return v ? t('rule.includingSelf') : '';
    default:
      return String(v);
  }
}

/** Fill a vocabulary label: "{pct}" placeholders, "[optional {band}]" parts, "{status|category}". */
export function fillLabel(content: ContentDB, label: string, params: Params, classId: string): string {
  const withOptional = label.replace(/\[([^\]]*)\]/g, (_, inner: string) => {
    const names = [...inner.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!);
    const present = names.every((n) => n.split('|').some((x) => params[x] !== undefined));
    return present ? inner : '';
  });
  return withOptional
    .replace(/\{([^}]+)\}/g, (_, name: string) => {
      for (const alt of name.split('|')) {
        const v = paramValue(content, alt, params, classId);
        if (v !== null) return v;
      }
      return name;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function paramsOf(part: Record<string, unknown>, drop: string): Params {
  const out: Params = {};
  for (const [k, v] of Object.entries(part)) if (k !== drop && k !== 'not') out[k] = v as Params[string];
  return out;
}

export interface RuleParts {
  conditions: { text: string; not: boolean; always: boolean }[];
  action: string;
  selector: string;
  only: string | null;
  prefer: string | null;
  cooldownS: number;
}

export function ruleParts(content: ContentDB, rule: RuleDef, classId: string): RuleParts {
  const v = content.vocabulary;
  const conditions = rule.if.map((c) => {
    const def = v.conditions.find((x) => x.id === c.cond);
    return {
      text: def ? fillLabel(content, def.label, paramsOf(c, 'cond'), classId) : c.cond,
      not: Boolean(c.not),
      always: c.cond === 'always',
    };
  });
  const act = v.actions.find((x) => x.id === rule.then.type);
  const sel = v.selectors.find((x) => x.id === rule.on.sel);
  const pred = (p: { pred: string } | null) => {
    if (!p) return null;
    const def = v.predicates.find((x) => x.id === p.pred);
    return def ? fillLabel(content, def.label, paramsOf(p, 'pred'), classId) : p.pred;
  };
  return {
    conditions,
    action: act ? fillLabel(content, act.label, paramsOf(rule.then, 'type'), classId) : rule.then.type,
    selector: sel ? fillLabel(content, sel.label, paramsOf(rule.on, 'sel'), classId) : rule.on.sel,
    only: pred(rule.only),
    prefer: pred(rule.prefer),
    cooldownS: rule.cooldownS,
  };
}

/** Plain-text sentence ("If an ally is below 40% HP then Suture on the lowest-HP ally"). */
export function ruleText(content: ContentDB, rule: RuleDef, classId: string): string {
  const p = ruleParts(content, rule, classId);
  const conds = p.conditions.filter((c) => !c.always);
  const head = conds.length === 0 ? t('rule.always') : `${t('rule.if')} ${conds.map((c) => (c.not ? `${t('rule.not')} ${c.text}` : c.text)).join(` ${t('rule.and')} `)} ${t('rule.then')}`;
  let s = `${head} ${p.action} ${t('rule.on')} ${p.selector}`;
  if (p.only) s += ` ${t('rule.only')} ${p.only}`;
  if (p.prefer) s += ` ${t('rule.prefer')} ${p.prefer}`;
  if (p.cooldownS > 0) s += ` (${t('rule.cooldown', { s: p.cooldownS })})`;
  return s;
}

export function RuleSentence({ content, rule, classId, index }: { content: ContentDB; rule: RuleDef; classId: string; index: number }) {
  const p = ruleParts(content, rule, classId);
  const conds = p.conditions.filter((c) => !c.always);
  return (
    <span class="rule">
      <span class="rule__id rule__id--preset">R{index + 1}</span>{' '}
      {conds.length === 0 ? (
        <span class="rule__kw">{t('rule.always')}</span>
      ) : (
        <>
          <span class="rule__kw">{t('rule.if')}</span>{' '}
          {conds.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <>
                  {' '}
                  <span class="rule__kw">{t('rule.and')}</span>{' '}
                </>
              )}
              {c.not && (
                <>
                  <span class="rule__kw">{t('rule.not')}</span>{' '}
                </>
              )}
              <span class="rule__v">{c.text}</span>
            </Fragment>
          ))}{' '}
          <span class="rule__kw">{t('rule.then')}</span>
        </>
      )}{' '}
      <span class="rule__v">{p.action}</span> <span class="rule__kw">{t('rule.on')}</span> <span class="rule__v">{p.selector}</span>
      {p.only && (
        <>
          {' '}
          <span class="rule__kw">{t('rule.only')}</span> <span class="rule__v">{p.only}</span>
        </>
      )}
      {p.prefer && (
        <>
          {' '}
          <span class="rule__kw">{t('rule.prefer')}</span> <span class="rule__v">{p.prefer}</span>
        </>
      )}
      {p.cooldownS > 0 && (
        <>
          {' '}
          <span class="rule__kw">{t('rule.cooldownKw')}</span> <span class="rule__v">{t('rule.seconds', { s: p.cooldownS })}</span>
        </>
      )}
    </span>
  );
}

export function StanceSentence({ content, stance }: { content: ContentDB; stance: string }) {
  const def = content.vocabulary.stances.find((s) => s.id === stance);
  return (
    <span class="rule" data-tip={def?.description}>
      <span class="rule__id">St</span> <span class="rule__kw">{t('rule.stance')}</span> <span class="rule__v">{def?.name ?? stance}</span>
    </span>
  );
}

/** The preset a fighter carried in this match (M1: presets only). */
export function presetOf(content: ContentDB, tactics: TacticsAssignment | undefined) {
  if (!tactics || tactics.kind !== 'preset') return null;
  return content.presets.get(tactics.presetId) ?? null;
}
