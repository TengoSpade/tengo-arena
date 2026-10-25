/**
 * Fighter display helpers: role ids and names, trait badges and tooltips,
 * attribute / rating / potential / preset tooltips, contract and injury
 * text. Labels come from content (T5); numbers come from core views
 * (FighterView) — nothing here computes a game rule.
 */
import type { ClassDef, ContentDB, PresetDef, StatDef, TierDef } from '../../core/content';
import type { FighterView } from '../../core/game';
import type { Contract, Fighter, Injury, StatId } from '../../core/model';
import type { TipContent } from '../components/Tooltip';
import { traitPolarity, type TraitPolarity } from '../components/marks';
import { formatInt, formatMoney, formatPercentBp, potentialStars, starsLabel } from './index';
import { presetLines } from './rules';

export function rolesOf(klass: ClassDef): string[] {
  return [...klass.archetypes];
}

export function roleNames(klass: ClassDef, content: ContentDB): string[] {
  return klass.archetypes.map((a) => content.combat.archetypes.find((x) => x.id === a)?.name ?? a);
}

export function raceName(fighter: Fighter, content: ContentDB): string {
  return content.races.get(fighter.raceId)?.name ?? fighter.raceId;
}

export interface TraitInfo {
  id: string;
  name: string;
  polarity: TraitPolarity;
  effect: string;
  tip: TipContent;
}

export function traitInfo(traitId: string, content: ContentDB, source?: string): TraitInfo {
  const tr = content.traits.get(traitId);
  if (!tr) return { id: traitId, name: traitId, polarity: 'pos', effect: '', tip: { title: traitId } };
  const category = content.files.traits.categories.find((c) => c.id === tr.category)?.name ?? tr.category;
  const polarity = traitPolarity(tr);
  const opposites = tr.opposites.map((o) => content.traits.get(o)?.name ?? o);
  const polarityWord = tr.polarity === 'negative' ? 'Negative' : 'Positive';
  return {
    id: tr.id,
    name: tr.name,
    polarity,
    effect: tr.effectText,
    tip: {
      kicker: [category, polarityWord, tr.rarity !== 'common' ? tr.rarity : null].filter(Boolean).join(' · '),
      title: tr.name,
      body: tr.effectText,
      flavor: tr.flavor ? `“${tr.flavor}”` : undefined,
      meta: [opposites.length ? `Opposite: ${opposites.join(', ')}` : null, source ? `Source: ${source}` : null].filter(Boolean).join(' · ') || undefined,
    },
  };
}

export function fighterTraits(fighter: Fighter, content: ContentDB): TraitInfo[] {
  return fighter.traits.map((tr) => traitInfo(tr.id, content, tr.source));
}

export function statTip(stat: StatDef, value: number, cap?: number | null): string {
  return `${stat.name} ${value}: ${stat.description}${cap ? ` Ceiling ${cap}.` : ''}`;
}

/** Rating tooltip: what it is, the class weights (top four) and the tier's usual range. */
export function ratingTip(view: FighterView, klass: ClassDef, content: ContentDB, tier?: TierDef | null): TipContent {
  const weights = Object.entries(klass.ratingWeights)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1]);
  const top = weights.slice(0, 4);
  const rest = weights.slice(4).reduce((s, [, w]) => s + w, 0);
  const statName = (id: string) => content.stats.get(id)?.name ?? id;
  return {
    kicker: `Rating · ${klass.name}`,
    title: `${view.rating} of 100`,
    body: `Current ability as a ${klass.name}: the class weights its attributes.${tier ? ` ${tier.name} fighters are usually ${tier.ratingBand.min}–${tier.ratingBand.max}.` : ''}`,
    rows: [
      ...top.map(([id, w], i) => ({ label: `${statName(id)} ${view.stats[id as StatId] ?? '—'}`, value: `${Math.round(w * 100)}%${i === 0 ? ' weight' : ''}` })),
      ...(rest > 0 ? [{ label: `${weights.length - 4} others`, value: `${Math.round(rest * 100)}%` }] : []),
    ],
    meta: 'Weights from classes.json',
  };
}

export function potentialTip(potential: number): string {
  const stars = potentialStars(potential);
  return `Potential ${potential} of 100: the highest rating this fighter can reach. Mostly fixed. Shown as ${starsLabel(stars)} (potential ÷ 20, in half stars).`;
}

export function presetTip(preset: PresetDef, klass: ClassDef | null, content: ContentDB): TipContent {
  return {
    kicker: `Preset${klass ? ` · ${klass.name}` : ''}`,
    title: preset.name,
    body: preset.summary,
    lines: presetLines(preset, klass, content),
    meta: 'Checked top-down; the first valid rule acts. Rule editing arrives in M3.',
  };
}

export function presetsOf(klass: ClassDef, content: ContentDB): PresetDef[] {
  return klass.presetIds.map((id) => content.presets.get(id)).filter((p): p is PresetDef => !!p);
}

/** "S5 · 2 more" / "Ends S3". */
export function contractEnds(contract: Contract | null, season: number): { text: string; final: boolean; seasonsLeft: number } {
  if (!contract) return { text: '—', final: false, seasonsLeft: 0 };
  const left = contract.endSeason - season;
  return { text: `S${contract.endSeason}`, final: left <= 0, seasonsLeft: Math.max(0, left) };
}

export function injuryLabel(injury: Injury, content: ContentDB): string {
  return content.development.injury.severityLadder.find((s) => s.id === injury.severity)?.label ?? injury.severity;
}

export function injuryTip(injury: Injury, content: ContentDB): string {
  const label = injuryLabel(injury, content);
  const where = injury.round ? `, round ${injury.round}` : '';
  return `${label}${where}. Out for ${injury.weeksOut} more ${injury.weeksOut === 1 ? 'week' : 'weeks'}.`;
}

export function trendInfo(trendId: string, content: ContentDB): { label: string; dir: number } {
  const levels = content.development.trend.levels;
  const i = levels.findIndex((l) => l.id === trendId);
  const level = levels[i];
  if (!level) return { label: trendId, dir: 0 };
  return { label: level.label, dir: level.minDelta > 0 ? 1 : level.minDelta < 0 ? -1 : 0 };
}

export function trainingOptions(content: ContentDB): { id: 'balanced' | 'body' | 'mind'; label: string }[] {
  return content.development.training.options.map((o) => ({ id: o.id as 'balanced' | 'body' | 'mind', label: o.label }));
}

export function captaincyGradeLabel(gradeId: string, content: ContentDB): string {
  return content.development.captaincy.grades.find((g) => g.id === gradeId)?.label ?? gradeId;
}

export function statusLabel(statusId: string, content: ContentDB): { label: string; text: string } {
  const s = content.development.statuses.find((x) => x.id === statusId);
  return { label: s?.label ?? statusId, text: s?.text ?? '' };
}

/** Injury-risk copy. `notable` is false for the normal case, so callers can keep the quiet default to an icon. */
export function injuryRiskText(view: FighterView, content: ContentDB): { word: string; tip: string; atRisk: boolean; notable: boolean } {
  const statuses = view.fighter.statuses.map((s) => s.id);
  const atRisk = statuses.includes('at_risk');
  const tender = statuses.includes('still_tender');
  const word = atRisk ? statusLabel('at_risk', content).label : tender ? statusLabel('still_tender', content).label : 'Normal';
  return {
    word,
    atRisk,
    notable: atRisk || tender,
    tip: `Injury risk: ${word}. Injury chance ${formatPercentBp(view.injuryChanceBp, 2)} per round started.${atRisk ? ` ${statusLabel('at_risk', content).text}` : ''}${tender ? ` ${statusLabel('still_tender', content).text}` : ''}`,
  };
}

export function wageTip(f: Fighter, view: FighterView | null): string {
  if (!f.contract) return 'No contract';
  const market = view ? ` Market wage ${formatMoney(view.marketWage, { perWeek: true })}.` : '';
  return `${formatMoney(f.contract.wagePerWeek, { perWeek: true })} until the end of S${f.contract.endSeason}.${market}`;
}

export { formatInt };
