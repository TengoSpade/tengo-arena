/** "What decided it" (04 ui-report §3): a one-sentence summary, then 3-5 rule traces. */
import type { ContentDB } from '../../../core/content';
import type { FighterId, GameState, MatchReport } from '../../../core/model';
import { Portrait } from '../league/lib/ui';
import { selectTraces, summary, type FighterInfo, type Perspective, type Trace } from './analysis';
import { RuleSentence, StanceSentence, presetOf } from './rule-sentence';
import { t } from './text';

const VERDICT_CLASS: Record<Trace['verdict'], string> = { helped: 'u-good', hurt: 'u-bad', 'hurt-us': 'u-bad', idle: 'u-warn' };
const VERDICT_ATTR: Record<Trace['verdict'], string> = { helped: 'helped', hurt: 'hurt', 'hurt-us': 'hurt', idle: 'idle' };

export function Traces({
  state,
  content,
  report,
  infos,
  persp,
  focusId,
}: {
  state: GameState;
  content: ContentDB;
  report: MatchReport;
  infos: FighterInfo[];
  persp: Perspective;
  focusId: FighterId | null;
}) {
  const sum = summary(report, persp, infos, state);
  const traces = selectTraces(report, infos, persp, state, content);
  return (
    <section class="panel" aria-labelledby="h-why" data-testid="panel-why">
      <header class="panel__header">
        <h2 class="panel__title" id="h-why">
          <span class="icon" data-icon="target" aria-hidden="true" />
          {t('why.title')}
        </h2>
        <span class="panel__subtitle">{t('why.subtitle')}</span>
      </header>
      <div class="callout report-why" data-testid="why-summary">
        <span class="icon" data-icon="info" aria-hidden="true" />
        <div>
          <div class="callout__title">{sum.title}</div>
          {sum.text && <div class="callout__text">{sum.text}</div>}
        </div>
      </div>
      {traces.length === 0 ? (
        <p class="report-empty-line u-sm u-muted">{t('trace.none')}</p>
      ) : (
        <div class="trace">
          {traces.map((tr) => {
            const info = infos.find((f) => f.id === tr.fighterId);
            const fighter = state.fighters[tr.fighterId];
            const preset = presetOf(content, info?.tactics);
            const rule = !tr.isStance ? preset?.rules[tr.ruleIndex] : undefined;
            const verdictText =
              tr.verdict === 'hurt-us' ? t('verdict.hurtUs') : tr.verdict === 'idle' ? t('verdict.idle') : tr.verdict === 'helped' ? t('verdict.helped') : t('verdict.hurt');
            return (
              <div
                key={`${tr.fighterId}-${tr.ruleIndex}`}
                class={focusId === tr.fighterId ? 'trace__item is-focus' : 'trace__item'}
                data-verdict={VERDICT_ATTR[tr.verdict]}
                data-testid="trace"
              >
                <Portrait content={content} fighter={fighter ?? null} size="sm" />
                <div>
                  <div class="trace__who">
                    {fighter?.name.full ?? tr.fighterId}
                    {!info?.us && persp.involved ? ` (${state.clubs[persp.themClubId]?.shortName ?? ''})` : ''} · {preset?.name ?? t('recaps.custom')} ·{' '}
                    <span class={VERDICT_CLASS[tr.verdict]}>{verdictText}</span>
                  </div>
                  {rule && info ? (
                    <RuleSentence content={content} rule={rule} classId={info.classId} index={tr.ruleIndex} />
                  ) : (
                    <StanceSentence content={content} stance={preset?.stance ?? 'aggressive'} />
                  )}
                </div>
                <span class="trace__count">{tr.fires}×</span>
                <span class="trace__note">{tr.note}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
