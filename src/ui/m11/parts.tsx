/**
 * M1.1 display parts (WP-D), over the design system's marks: the Freshness meter (`.condition`:
 * meter + number, the threshold marked), Tired / Spent tags, the level chip and XP bar, rank pips and
 * perk badges. Every number carries a tooltip with its source (04 §6.2).
 */
import type { ContentDB } from '../../core/content';
import type { FreshnessLabel, PerkId } from '../../core/model';
import { Meter, Pips, Progress, Rating, Tag, tipAttrs, type Tip, type TipContent } from '../components';
import { formatInt } from '../format';
import { labelFor, penaltyFrom, penaltyText, tierRoman, type FreshInfo, type LevelInfo, type RatingNow } from './model';
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
      { label: `Not Tired for (≥ ${info.threshold})`, value: info.readyRounds >= 99 ? 'many rounds' : `≈ ${info.readyRounds} round${info.readyRounds === 1 ? '' : 's'}` },
      { label: 'After a typical match', value: String(info.afterMatch) },
    ],
    body: penalty
      ? `Below ${info.penaltyFrom} he starts rounds with a penalty: ${penalty}. Injury chance ×${info.injuryMult.toFixed(2)}.`
      : `No penalty at ${info.penaltyFrom} or more.`,
    meta: 'Drains per round played, recovers in weeks he starts no round; 100 again at season end.',
  };
}

/** Compact meter + value; `label` adds the word (Fresh, Ready, Tired, Spent); `compact` shortens the bar (side columns, lists). */
export function FreshMeter({ info, content, label, testId, compact }: { info: FreshInfo; content: ContentDB; label?: boolean; testId?: string; compact?: boolean }) {
  return (
    <span class={`fresh condition${compact ? ' fresh--compact' : ''}`} data-label={info.label} tabIndex={0} aria-label={`Freshness ${info.value}, ${info.labelText}`} data-testid={testId} {...tipAttrs(freshTip(info, content))}>
      <Meter value={info.value / 100} mark={info.penaltyFrom / 100} state={METER_STATE[info.label]} thin />
      <span class="fresh__value">{info.value}</span>
      {label && <span class="fresh__label">{info.labelText}</span>}
    </span>
  );
}

/** What the Freshness penalty does to a rating, in words: the tooltip of "45 → 41". */
export function ratingNowTip(now: RatingNow, content: ContentDB): TipContent {
  const penalty = penaltyText(now.freshness, content);
  const threshold = penaltyFrom(content);
  return {
    kicker: 'Rating · Freshness penalty',
    title: now.drop > 0 ? `${now.rating} → ${now.effective}` : `${now.rating}`,
    body:
      now.drop > 0
        ? `At Freshness ${now.freshness} (${now.labelText}) he fights as a ${now.effective}, not a ${now.rating}: ${penalty ?? 'a penalty to his speed and Power'}.`
        : `Rested (${threshold} or more): no Freshness penalty, he fights at his full rating.`,
    rows: [
      { label: 'Rating (rested)', value: String(now.rating) },
      { label: `Freshness · ${now.labelText}`, value: String(now.freshness) },
      ...now.parts.map((p) => ({ label: p.label, value: `−${Math.abs(p.points).toFixed(1)}` })),
      { label: 'Effective rating now', value: String(now.effective), total: true },
    ],
    meta: `Below ${threshold} Freshness the penalty steps up (Winded, Tired, Spent); rest or a fresher fighter brings the rating back.`,
  };
}

/**
 * Rating with what it is worth at his Freshness now: "45" when rested, "45 → 41" when the Freshness penalty
 * bites (the base figure dimmed, the effective one in the pill, tinted by Tired / Spent). Same rating pill as ever.
 */
export function RatingEff({ now, content, tip, testId }: { now: RatingNow; content: ContentDB; tip?: Tip; testId?: string }) {
  if (now.drop <= 0) return <Rating value={now.rating} tip={tip} />;
  return (
    <span class="rating-eff" data-label={now.label} tabIndex={0} aria-label={`Rating ${now.rating}, ${now.effective} at Freshness ${now.freshness}`} data-testid={testId} {...tipAttrs(ratingNowTip(now, content))}>
      <span class="rating-eff__base">{now.rating}</span>
      <span class="rating-eff__arrow" aria-hidden="true">→</span>
      <Rating value={now.effective} />
    </span>
  );
}

/** "Winded 62" / "Tired 41" / "Spent 19" tag (reports, between-round screen); nothing when Fresh (no penalty). */
export function FreshTag({ value, label, text }: { value: number; label: FreshnessLabel; text: string }) {
  if (label === 'fresh') return null;
  return (
    <Tag kind={label === 'spent' ? 'bad' : 'warn'} tip={`Started the round at ${value}: ${label === 'spent' ? 'below 25' : label === 'tired' ? '25–49' : '50–74'}, with the Freshness penalty`}>
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

/**
 * Freshness across one match: a compact meter at the value he ended on, the part he spent shaded, and
 * "100 → 62" beside it (the end value takes the Tired / Spent colour). `after` null: only where he started.
 */
export function FreshChange({ before, after, content, testId }: { before: number; after: number | null; content: ContentDB; testId?: string }) {
  const end = after ?? before;
  const label = labelFor(end, content);
  const threshold = penaltyFrom(content);
  const drop = after === null ? 0 : before - after;
  const tip: TipContent = {
    kicker: 'Freshness · this match',
    title: after === null ? `Started at ${before}` : `${before} → ${after}`,
    rows: [
      { label: 'At his first round start', value: String(before) },
      ...(after === null ? [] : [{ label: 'After the match', value: `${after} (${label.text})` }, { label: 'Spent', value: drop > 0 ? `−${drop}` : '0' }]),
    ],
    meta: after === null ? 'The value he has now is no longer the one this match left.' : 'Each round started drains Freshness; it recovers in weeks he starts no round.',
  };
  return (
    <span class="fresh-change" data-label={label.id} tabIndex={0} aria-label={after === null ? `Freshness ${before} at the start` : `Freshness ${before} to ${after}`} data-testid={testId} {...tipAttrs(tip)}>
      <span class="meter meter--thin fresh-change__meter" data-state={METER_STATE[label.id]} style={{ '--v': Math.max(0, Math.min(1, end / 100)), '--from': Math.max(0, Math.min(1, before / 100)) } as Record<string, string | number>}>
        <span class="fresh-change__spent" />
        <span class="meter__fill" />
        <span class="meter__mark" style={{ '--at': threshold / 100 } as Record<string, string | number>} />
      </span>
      <span class="fresh-change__nums">
        <span class="fresh-change__before">{before}</span>
        {after !== null && (
          <>
            <span class="fresh-change__arrow" aria-hidden="true">→</span>
            <span class="fresh-change__after">{after}</span>
          </>
        )}
      </span>
    </span>
  );
}
