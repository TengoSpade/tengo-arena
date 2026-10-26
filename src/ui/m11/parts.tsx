/**
 * M1.1 display parts (WP-D), over the design system's marks: the Freshness meter (`.condition`:
 * meter + number, the threshold marked), Tired / Spent tags, the level chip and XP bar, rank pips and
 * perk badges. Every number carries a tooltip with its source (04 §6.2).
 */
import type { ContentDB } from '../../core/content';
import type { FreshnessLabel, PerkId } from '../../core/model';
import { Meter, Pips, Progress, Tag, tipAttrs, type TipContent } from '../components';
import { formatInt } from '../format';
import { penaltyText, tierRoman, type FreshInfo, type LevelInfo } from './model';
import './m11.css';

const METER_STATE: Record<FreshnessLabel, 'good' | 'warn' | 'bad' | undefined> = { fresh: 'good', ready: undefined, tired: 'warn', spent: 'bad' };

export function freshTip(info: FreshInfo, content: ContentDB): TipContent {
  const penalty = penaltyText(info.value, content);
  return {
    kicker: 'Freshness',
    title: `${info.value} · ${info.labelText}`,
    rows: [
      { label: 'Drains a typical round', value: `−${info.drain.toFixed(1)}` },
      { label: 'Recovers a week of rest', value: `+${info.rest.toFixed(0)}` },
      { label: `Ready for (≥ ${info.threshold})`, value: info.readyRounds >= 99 ? 'many rounds' : `≈ ${info.readyRounds} round${info.readyRounds === 1 ? '' : 's'}` },
      { label: 'After a typical match', value: String(info.afterMatch) },
    ],
    body: penalty
      ? `Below ${info.threshold} he starts rounds with a penalty: ${penalty}. Injury chance ×${info.injuryMult.toFixed(2)}.`
      : `No penalty at ${info.threshold} or more. Rest needed to be Fresh (80): ${info.value >= 80 ? 'none' : `≈ ${Math.max(1, Math.ceil((80 - info.value) / Math.max(1, info.rest)))} week${Math.ceil((80 - info.value) / Math.max(1, info.rest)) === 1 ? '' : 's'}`}.`,
    meta: 'Drains per round played, recovers in weeks he starts no round; 100 again at season end.',
  };
}

/** Compact meter + value; `label` adds the word (Fresh, Ready, Tired, Spent). */
export function FreshMeter({ info, content, label, testId }: { info: FreshInfo; content: ContentDB; label?: boolean; testId?: string }) {
  return (
    <span class="fresh condition" data-label={info.label} tabIndex={0} aria-label={`Freshness ${info.value}, ${info.labelText}`} data-testid={testId} {...tipAttrs(freshTip(info, content))}>
      <Meter value={info.value / 100} mark={info.threshold / 100} state={METER_STATE[info.label]} thin />
      <span class="fresh__value">{info.value}</span>
      {label && <span class="fresh__label">{info.labelText}</span>}
    </span>
  );
}

/** "Tired 52" / "Spent 31" tag (reports, between-round screen); nothing when Fresh or Ready. */
export function FreshTag({ value, label, text }: { value: number; label: FreshnessLabel; text: string }) {
  if (label !== 'tired' && label !== 'spent') return null;
  return (
    <Tag kind={label === 'spent' ? 'bad' : 'warn'} tip={`Started the round at ${value}: ${label === 'spent' ? 'below 40' : '40–59'}, with the Freshness penalty`}>
      {text} {value}
    </Tag>
  );
}

export function levelTip(info: LevelInfo): TipContent {
  return {
    kicker: 'Level',
    title: `Level ${info.level}`,
    rows: [
      { label: 'XP into this level', value: `${formatInt(info.xpInto)} / ${formatInt(info.xpNeeded)}` },
      { label: 'Next level', value: info.eta === null ? '—' : `≈ ${info.eta} match${info.eta === 1 ? '' : 'es'}` },
      { label: 'Levels this season', value: String(info.levelsThisSeason) },
      { label: 'Waiting for a choice', value: String(info.pending) },
    ],
    meta: 'XP from rounds started, ⅓ of a slot on the bench. Each level offers 3 options.',
  };
}

/** "Lv 24", with the waiting level-ups as a badge. */
export function LevelChip({ info, testId }: { info: LevelInfo; testId?: string }) {
  return (
    <span class="lvl" tabIndex={0} {...tipAttrs(levelTip(info))} data-testid={testId}>
      <span class="lvl__n">Lv {info.level}</span>
      {info.pending > 0 && <PendingBadge n={info.pending} />}
    </span>
  );
}

export function PendingBadge({ n, tip }: { n: number; tip?: string }) {
  return (
    <span class="lvl-pending" {...tipAttrs(tip ?? `${n} level-up${n === 1 ? '' : 's'} waiting for a choice (up to 3; a 4th resolves the oldest automatically)`)} aria-label={`${n} level-ups waiting`}>
      ▲{n}
    </span>
  );
}

/** XP bar with the level and "next level in ≈ N matches". */
export function XpBar({ info, testId }: { info: LevelInfo; testId?: string }) {
  return (
    <div class="xpbar" data-testid={testId} {...tipAttrs(levelTip(info))}>
      <div class="xpbar__head">
        <span class="u-strong">Level {info.level}</span>
        <span class="u-xs u-muted u-num">
          {formatInt(info.xpInto)} / {formatInt(info.xpNeeded)} XP
        </span>
      </div>
      <Progress value={info.frac} tip={levelTip(info)} />
      <div class="u-xs u-muted">
        {info.eta === null ? 'No match XP expected' : `Next level in ≈ ${info.eta} match${info.eta === 1 ? '' : 'es'}`}
        {info.levelsThisSeason > 0 && ` · ${info.levelsThisSeason} this season`}
      </div>
    </div>
  );
}

export function RankPips({ rank, label, tip }: { rank: number; label: string; tip?: string }) {
  return <Pips value={rank} max={3} label={label} tip={tip} />;
}

export function PerkBadge({ content, perkId, muted }: { content: ContentDB; perkId: PerkId | string; muted?: boolean }) {
  const perk = content.perks.get(perkId);
  if (!perk) return null;
  return (
    <span class={`perk${muted ? ' perk--muted' : ''}`} data-tier={perk.tier} tabIndex={0} {...tipAttrs({ kicker: `Perk · tier ${tierRoman(perk.tier)}`, title: perk.name, body: perk.text })}>
      <span class="perk__tier">{tierRoman(perk.tier)}</span>
      {perk.name}
    </span>
  );
}
