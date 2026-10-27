/**
 * Profile: level, XP bar and Freshness, and the M1.1 skills (progression.md fighter card;
 * combat-skills.md player information): ability ranks with pips and the next rank's change, perks
 * held, and the perks he could be offered now (with what still blocks the others).
 */
import { useState } from 'preact/hooks';
import type { ContentDB } from '../../../core/content';
import type { Fighter, GameState, LevelUpModeSetting, PerkId, RankableSlot } from '../../../core/model';
import { levelUpRequest } from '../../app/intents';
import { Panel, tipAttrs } from '../../components';
import { formatInt } from '../../format';
import { ModeSelect } from '../../levelup/LevelUpDialog';
import { abilityName, effectiveStats, freshInfo, levelInfo, perkCheck, rankSummary, slotAbility } from '../../m11/model';
import { FreshMeter, PerkBadge, RankPips, XpBar, freshTip, levelTip } from '../../m11/parts';
import type { GameEngine } from '../../store/engine';

const SLOTS: { slot: RankableSlot; label: string }[] = [
  { slot: 'a1', label: 'First ability' },
  { slot: 'a2', label: 'Second ability' },
  { slot: 'passive', label: 'Passive' },
];

export function LevelPanel(props: { f: Fighter; state: GameState; content: ContentDB; engine: GameEngine; own: boolean; onMode: (m: LevelUpModeSetting) => void }) {
  const { f, state, content, engine, own, onMode } = props;
  const info = levelInfo(engine, state, content, f);
  const fresh = freshInfo(engine, state, content, f);
  const ready = fresh.readyRounds >= 99 ? 'many rounds' : `${fresh.readyRounds} round${fresh.readyRounds === 1 ? '' : 's'}`;
  return (
    <Panel title="Level" icon="level-up" subtitle={`Level ${info.level}${info.levelsThisSeason ? ` · +${info.levelsThisSeason} this season` : ''}`} subtitleTip={levelTip(info)} bodyClass="l-stack l-stack--sm" testId="level-panel">
      <XpBar info={info} testId="profile-xp" />
      <div class="u-xs u-muted" {...tipAttrs('Round XP from rounds he started; bench XP is a third of a lineup slot for matches he sat out.')}>
        Season XP {formatInt(f.season.xp)} · rounds {formatInt(f.season.roundXp ?? 0)} · bench {formatInt(f.season.benchXp ?? 0)}
      </div>
      {own && info.pending > 0 && (
        <button class="btn btn--primary btn--sm" type="button" onClick={() => (levelUpRequest.value = f.id)} data-testid="profile-levelup">
          Choose level-up ({info.pending} waiting)
        </button>
      )}
      {own && <ModeSelect value={f.levelUpMode} onChange={onMode} testId="profile-levelup-mode" />}
      <div class="l-row" data-testid="profile-freshness">
        <span class="u-sm u-muted">Freshness</span>
        <span class="l-push">
          <FreshMeter info={fresh} content={content} label />
        </span>
      </div>
      <div class="u-xs u-muted" {...tipAttrs(freshTip(fresh, content))}>
        Drains {fresh.drain.toFixed(1)} a round · recovers +{fresh.rest.toFixed(0)} a week of rest · ready for ≈ {ready}
      </div>
    </Panel>
  );
}

export function SkillsPanel({ f, state, content, engine }: { f: Fighter; state: GameState; content: ContentDB; engine: GameEngine }) {
  const [showAll, setShowAll] = useState(false);
  const stats = effectiveStats(engine, state, content, f);
  const archetypes = (content.classes.get(f.classId)?.archetypes ?? []) as readonly string[];
  const pool = content.perks.list.filter((p) => p.archetype === 'general' || archetypes.includes(p.archetype));
  const checks = pool.filter((p) => !f.perkIds.includes(p.id as PerkId)).map((p) => ({ p, c: perkCheck(content, f, stats, p.id) }));
  const eligible = checks.filter((x) => x.c.eligible);
  const blocked = checks.filter((x) => !x.c.eligible);
  const cap = content.perkRules.perkCap;
  return (
    <Panel title="Skills" icon="star" subtitle={`${f.perkIds.length} of ${cap} perks · ranks rise on skill levels`} bodyClass="l-stack l-stack--sm" testId="skills-panel">
      <div class="panel-section__title">Ability ranks</div>
      <ul class="skill-ranks" role="list">
        {SLOTS.map(({ slot, label }) => {
          const id = slotAbility(content, f, slot);
          if (!id) return null;
          const rank = f.abilityRanks?.[slot] ?? 1;
          const next = rank < 3 ? rankSummary(content, id, rank + 1) : null;
          return (
            <li key={slot} class="skill-rank" data-testid={`rank-${slot}`}>
              <span class="skill-rank__name" {...tipAttrs(label)}>
                {abilityName(content, id, rank)}
              </span>
              <RankPips rank={rank} label={`Rank ${rank} of 3`} tip={`${label}: rank ${rank} of 3`} />
              <span class="u-xs u-muted skill-rank__next" {...tipAttrs(`Rank ${rank} of 3. A skill level can offer the next rank; control durations never grow.`)}>{next ? `Next: ${next}` : 'Top rank'}</span>
            </li>
          );
        })}
      </ul>
      <div class="panel-section__title">Perks</div>
      {f.perkIds.length === 0 ? (
        <span class="u-xs u-faint">No perks yet. Every 3rd level offers a skill: a perk or an ability rank.</span>
      ) : (
        <div class="l-cluster l-cluster--xs" data-testid="perks-held">
          {f.perkIds.map((id) => (
            <PerkBadge key={id} content={content} perkId={id} />
          ))}
        </div>
      )}
      <div class="l-row u-xs">
        <span class="u-muted" {...tipAttrs('Perks his class can be offered now (tier gates, the cap, exclusions and stat minimums checked).')}>
          {eligible.length} perk{eligible.length === 1 ? '' : 's'} he can be offered now
        </span>
        <button class="btn btn--sm btn--ghost l-push" type="button" aria-expanded={showAll ? 'true' : 'false'} onClick={() => setShowAll((x) => !x)} data-testid="perks-eligible-toggle">
          {showAll ? 'Hide' : 'Show'}
        </button>
      </div>
      {showAll && (
        <div class="l-stack l-stack--xs" data-testid="perks-eligible">
          <div class="l-cluster l-cluster--xs">
            {eligible.map(({ p }) => (
              <PerkBadge key={p.id} content={content} perkId={p.id} muted />
            ))}
          </div>
          {blocked.length > 0 && (
            <div class="u-xs u-faint" {...tipAttrs(blocked.map(({ p, c }) => `${p.name}: ${c.reasons.join('; ')}`).join(' · '))}>
              {blocked.length} more not yet: {blocked.slice(0, 4).map(({ p, c }) => `${p.name} (${c.reasons[0]})`).join(', ')}
              {blocked.length > 4 ? '…' : ''}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
