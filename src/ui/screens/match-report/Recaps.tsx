/**
 * Per-fighter rule recaps (03 sys-match-report "per-fighter recap cards with
 * rule-fire bars labelled by the preset's rules; never-fired warnings";
 * P-22). One card per fighter: every rule of the preset as a sentence, a bar
 * of its fires against the fighter's busiest rule, and the stance last.
 */
import { useState } from 'preact/hooks';
import type { ContentDB } from '../../../core/content';
import type { FighterId, GameState } from '../../../core/model';
import { href } from '../league/lib/store';
import { Portrait, Segmented } from '../league/lib/ui';
import type { FighterInfo, Perspective } from './analysis';
import { RuleSentence, StanceSentence, presetOf } from './rule-sentence';
import { t } from './text';

function RecapCard({ state, content, info, focus }: { state: GameState; content: ContentDB; info: FighterInfo; focus: boolean }) {
  const f = state.fighters[info.id];
  const recap = info.recap;
  const preset = presetOf(content, info.tactics);
  const klass = content.classes.get(info.classId);
  const max = Math.max(1, ...(recap?.rules.map((r) => r.fires) ?? [1]));
  const total = recap?.rules.reduce((a, r) => a + r.fires, 0) ?? 0;
  return (
    <article class={focus ? 'well recap-card is-focus' : 'well recap-card'} data-testid="recap-card" aria-label={f?.name.full}>
      <header class="recap-card__head">
        <Portrait content={content} fighter={f ?? null} size="sm" />
        <div class="entity__stack">
          <a class="entity__name" href={href(`fighter/${encodeURIComponent(info.id)}`)}>
            {f?.name.full ?? info.id}
          </a>
          <span class="entity__sub">
            {klass?.name ?? info.classId} · {preset ? t('recaps.preset', { preset: preset.name }) : t('recaps.custom')}
          </span>
        </div>
        {recap && (
          <span class="recap-card__meta u-xs u-faint">
            {t('recaps.meta', { rounds: recap.stats.roundsPlayed, downs: recap.stats.downsInflicted, downed: recap.stats.downsSuffered })}
          </span>
        )}
      </header>
      {!recap || recap.rules.length === 0 ? (
        <p class="u-xs u-faint">{t('recaps.noRules')}</p>
      ) : (
        <ol class="rule-list recap-rules">
          {recap.rules.map((r) => {
            const rule = !r.isStance ? preset?.rules[r.index] : undefined;
            const share = total > 0 ? Math.round((r.fires / total) * 100) : 0;
            return (
              <li key={r.index} class={r.neverFired ? 'recap-rule is-never' : 'recap-rule'} data-testid={r.neverFired ? 'never-fired' : undefined}>
                <div class="recap-rule__text">
                  {rule ? (
                    <RuleSentence content={content} rule={rule} classId={info.classId} index={r.index} />
                  ) : r.isStance ? (
                    <StanceSentence content={content} stance={preset?.stance ?? 'aggressive'} />
                  ) : (
                    <span class="rule">
                      <span class="rule__id">R{r.index + 1}</span>
                    </span>
                  )}
                  {r.neverFired && (
                    <span class="tag tag--warn recap-rule__warn" data-tip={t('recaps.neverTip')}>
                      <span class="icon" data-icon="warning" aria-hidden="true" />
                      {t('recaps.never')}
                    </span>
                  )}
                </div>
                <div class="recap-rule__bar" data-tip={t('trace.perRule', { fires: r.fires, share: `${share}%` })}>
                  <div class="meter meter--thin" data-state={r.neverFired ? 'warn' : undefined} style={{ '--v': r.fires / max }}>
                    <div class="meter__fill" />
                  </div>
                  <span class="rule-list__fires">{t('recaps.fires', { n: r.fires })}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}

export function Recaps({
  state,
  content,
  infos,
  persp,
  focusId,
}: {
  state: GameState;
  content: ContentDB;
  infos: FighterInfo[];
  persp: Perspective;
  focusId: FighterId | null;
}) {
  const [side, setSide] = useState<'us' | 'them'>('us');
  const shown = infos.filter((f) => (side === 'us' ? f.us : !f.us));
  const never = infos.filter((f) => f.us && f.recap?.rules.some((r) => r.neverFired)).length;
  const usName = state.clubs[persp.usClubId]?.shortName ?? t('recaps.ours');
  const themName = state.clubs[persp.themClubId]?.shortName ?? t('recaps.theirs');
  return (
    <section class="panel" aria-labelledby="h-recaps" data-testid="panel-recaps">
      <header class="panel__header">
        <h2 class="panel__title" id="h-recaps">
          <span class="icon" data-icon="tactics" aria-hidden="true" />
          {t('recaps.title')}
        </h2>
        <span class="panel__subtitle">{t('recaps.subtitle')}</span>
        <div class="panel__actions">
          {never > 0 && (
            <span class="tag tag--warn" data-tip={t('recaps.neverTip')}>
              <span class="icon" data-icon="warning" aria-hidden="true" />
              {never}
            </span>
          )}
          <Segmented
            label={t('recaps.side')}
            value={side}
            options={[
              { value: 'us', label: persp.involved ? t('recaps.ours') : usName },
              { value: 'them', label: persp.involved ? t('recaps.theirs') : themName },
            ]}
            onChange={setSide}
          />
        </div>
      </header>
      <div class="panel__body recap-grid">
        {shown.map((f) => (
          <RecapCard key={f.id} state={state} content={content} info={f} focus={focusId === f.id} />
        ))}
      </div>
    </section>
  );
}
