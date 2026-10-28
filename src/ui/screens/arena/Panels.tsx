/**
 * The right dock (mockups/arena.html `.arena-dock`; 05-technical-m2 §A18): the pause inspector above the key-moment
 * feed. Both are DOM over the canvas (tech-018) and take only what the session hands them, which for a live round is
 * bounded by the live head. The feed reuses the report's `.timeline`: chronological, aria-live polite, the newest line
 * highlighted, opened scrolled to the newest; a replay shows the whole round with later moments dimmed.
 */
import { useEffect, useRef } from 'preact/hooks';
import type { ContentDB } from '../../../core/content';
import { Icon, Portrait, RoleGlyph, tipAttrs } from '../../components';
import { StanceSentence, RuleSentence } from '../match-report/rule-sentence';
import type { FeedItem } from './feed';
import type { InspectorModel, RuleRef, WhyLine } from './inspect';
import { t } from './text';

export function ArenaFeed({
  items,
  kind,
  playheadTick,
  onJump,
}: {
  items: readonly FeedItem[];
  kind: 'live' | 'replay';
  playheadTick: number;
  onJump: (tick: number) => void;
}) {
  const body = useRef<HTMLDivElement>(null);
  const newest = items[items.length - 1]?.key;
  // Opened scrolled to the newest line.
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [newest]);
  const nowKey = [...items].reverse().find((m) => m.tick <= playheadTick)?.key;
  return (
    <section class="panel afeed" aria-labelledby="h-feed" data-testid="arena-feed">
      <header class="panel__header">
        <h2 class="panel__title" id="h-feed">
          <Icon name="scroll" />
          {t('feedTitle')}
        </h2>
        <span class="panel__subtitle">{kind === 'live' ? t('feedLive') : t('feedWhole')}</span>
      </header>
      <div class="panel__body" ref={body}>
        {items.length === 0 ? (
          <p class="u-sm u-muted" data-testid="feed-empty">
            {t('feedEmpty')}
          </p>
        ) : (
          <ol class="timeline" aria-live="polite" aria-label={t('feedTitle')} data-testid="feed-list">
            {items.map((m) => (
              <li
                key={m.key}
                class={`timeline__item${m.key === nowKey ? ' is-now' : ''}${kind === 'replay' && m.tick > playheadTick ? ' is-future' : ''}`}
                data-side={m.mark ?? undefined}
                data-event={m.event}
                data-kind={m.kind}
                data-ours={m.ours === null ? undefined : String(m.ours)}
                data-testid="feed-item"
                tabIndex={0}
                onClick={() => onJump(m.tick)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    onJump(m.tick);
                  }
                }}
                {...tipAttrs(t(kind === 'live' ? 'feedGo' : 'feedGoReplay', { time: m.time }))}
              >
                <span class="timeline__time">{m.time}</span>
                <span class="timeline__marker">
                  <span class="timeline__dot" />
                </span>
                <div>
                  <div class="timeline__title">{m.title}</div>
                  {m.detail && <div class="timeline__text">{m.detail}</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function RuleView({ content, r }: { content: ContentDB; r: RuleRef }) {
  if (r.rule) return <RuleSentence content={content} rule={r.rule} classId={r.classId} index={r.index} />;
  if (r.stanceName !== null) return <StanceSentence content={content} stance={r.stanceName} />;
  return (
    <span class="rule">
      <span class="rule__id rule__id--preset">{r.label}</span>
    </span>
  );
}

function WhyList({ content, lines }: { content: ContentDB; lines: readonly WhyLine[] }) {
  return (
    <ol class="awhy" aria-label={t('inspectWhyAria')} data-testid="inspector-why">
      {lines.map((l, i) => (
        <li key={i} class="awhy__item" data-fired={l.fired ? 'true' : 'false'} data-reached={l.reached ? 'true' : 'false'} data-testid="trace-line">
          <span class="awhy__mark" aria-hidden="true">
            {l.fired ? <Icon name="check" size="sm" /> : l.reached ? '–' : '·'}
          </span>
          <span>
            <RuleView content={content} r={l.ref} />
          </span>
          <span class="awhy__why">
            {l.fired ? (
              <b>{t('inspectFired')}</b>
            ) : l.why ? (
              <>
                <b>{l.why.lead}</b> {l.why.text}
              </>
            ) : (
              t('inspectNotReached')
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

export type ProbeState = 'idle' | 'loading' | 'failed' | 'ready';

export function ArenaInspector({
  content,
  model,
  paused,
  probe,
  hasSelection,
  onClose,
  roleName,
}: {
  content: ContentDB;
  model: InspectorModel | null;
  paused: boolean;
  probe: ProbeState;
  hasSelection: boolean;
  onClose: () => void;
  roleName: (role: string) => string;
}) {
  return (
    <section class="panel ainspect" aria-labelledby="h-inspect" data-testid="arena-inspector">
      <header class="ainspect__head">
        {model && <Portrait role={model.unit.roles[0] ?? 'melee'} race={model.unit.raceId} size="sm" />}
        <div class="ainspect__who">
          <h2 class="ainspect__name" id="h-inspect" data-testid="inspector-name">
            {model ? model.unit.name : t('inspectTitle')}
          </h2>
          {model && (
            <span class="u-xs u-muted">
              <span class="class-tag">
                {model.unit.roles.map((r) => (
                  <RoleGlyph key={r} role={r} label={roleName(r)} />
                ))}
                {model.unit.className}
              </span>
              {model.isCaptain ? ` · ${t('inspectCaptain')}` : ''}
            </span>
          )}
        </div>
        <button class="icon-btn l-push" type="button" onClick={onClose} aria-label={t('inspectClose')} data-testid="inspector-close" {...tipAttrs(t('inspectCloseTip'))}>
          <Icon name="close" />
        </button>
      </header>
      {!hasSelection || !model ? (
        <div class="ainspect__section">
          <p class="u-sm u-muted" data-testid="inspector-none">
            {t('inspectNone')}
          </p>
        </div>
      ) : !paused ? (
        <div class="ainspect__section" data-testid="inspector-pause-first">
          <p class="u-strong">{t('inspectPauseFirst')}</p>
          <p class="u-sm u-muted">{t('inspectPauseFirstText')}</p>
        </div>
      ) : (
        <>
          <div class="ainspect__section" data-testid="inspector-decision">
            <div class="ainspect__h">
              <span>{t('inspectDecision')}</span>
              {model.decision && <span class="u-faint u-num">{model.decision.since}</span>}
            </div>
            {model.decision ? (
              <>
                <p data-testid="inspector-rule">
                  <RuleView content={content} r={model.decision.ref} />
                  {model.decision.target ? <span class="u-muted"> → {model.decision.target}</span> : null}
                </p>
                <p class="u-xs u-muted u-mt-2">{model.decision.react}</p>
              </>
            ) : (
              <p class="u-sm u-muted">{t('inspectDecisionNone')}</p>
            )}
          </div>

          {model.decision && model.decision.why.length > 0 && (
            <div class="ainspect__section">
              <div class="ainspect__h">
                <span>{t('inspectWhy')}</span>
                <span class="u-faint">{t('inspectWhyFirst')}</span>
              </div>
              <WhyList content={content} lines={model.decision.why} />
              <NowLine probe={probe} model={model} />
            </div>
          )}
          {!(model.decision && model.decision.why.length > 0) && (
            <div class="ainspect__section">
              <NowLine probe={probe} model={model} />
            </div>
          )}

          <div class="ainspect__section" data-testid="inspector-now">
            <div class="ainspect__h">
              <span>{t('inspectState')}</span>
            </div>
            {model.vitals && (
              <div class="ainspect__bars">
                <div class="ainspect__bar">
                  <span>{t('inspectHp')}</span>
                  <span class="abar">
                    <i class="abar__hp" style={{ '--hp': model.vitals.maxHp ? model.vitals.hp / model.vitals.maxHp : 0 } as Record<string, number>} />
                  </span>
                  <span class="u-num u-strong" data-testid="inspector-vitals">
                    {model.vitals.hp} / {model.vitals.maxHp}
                  </span>
                </div>
                {model.vitals.shield !== null && (
                  <div class="ainspect__bar">
                    <span>{t('inspectShield')}</span>
                    <span class="abar">
                      <i class="abar__shield" style={{ '--sh': model.vitals.maxHp ? model.vitals.shield / model.vitals.maxHp : 0 } as Record<string, number>} />
                    </span>
                    <span class="u-num u-strong">{model.vitals.shield}</span>
                  </div>
                )}
                {model.vitals.focus !== null && (
                  <div class="ainspect__bar">
                    <span>{t('inspectFocus')}</span>
                    <span class="abar abar--focus">
                      <i class="abar__hp" style={{ '--fo': Math.min(1, model.vitals.focus / 100) } as Record<string, number>} />
                    </span>
                    <span class="u-num u-strong">{model.vitals.focus} / 100</span>
                  </div>
                )}
              </div>
            )}
            {probe === 'loading' && <p class="u-sm u-muted">{t('inspectNowLoading')}</p>}
            {probe === 'ready' && model.now && (
              <dl class="kv">
                <div class="is-long">
                  <dt>{t('inspectCooldowns')}</dt>
                  <dd>
                    {model.now.cooldowns.map((c, i) => (
                      <span key={c.name} data-testid="inspector-cooldown">
                        {i > 0 ? ' · ' : ''}
                        {c.name} {c.text}
                      </span>
                    ))}
                  </dd>
                </div>
                <div class="is-long">
                  <dt>{t('inspectStatuses')}</dt>
                  <dd>
                    {model.now.statuses.length === 0 ? (
                      <span class="u-muted">{t('inspectNoStatuses')}</span>
                    ) : (
                      model.now.statuses.map((s) => (
                        <span key={s.name} class="l-cluster l-cluster--xs" style={{ justifyContent: 'flex-start' }} data-testid="inspector-status">
                          <span class="u-sm">
                            {s.name} {s.text}
                          </span>
                          {s.pip && <i class="apip" data-pip={s.pip} aria-hidden="true" style={{ width: '1.1rem', height: '1.1rem', display: 'inline-grid', verticalAlign: 'middle' }} />}
                        </span>
                      ))
                    )}
                  </dd>
                </div>
                {model.fires && (
                  <>
                    <div class="is-long" data-testid="inspector-fires">
                      <dt>{t('inspectFiredThisRound')}</dt>
                      <dd>
                        {model.fires
                          .filter((f) => f.count > 0)
                          .map((f) => `${f.ref.label} ×${f.count}`)
                          .join(' · ') || t('inspectFiresNever')}
                      </dd>
                    </div>
                    <div class="is-long">
                      <dt>{t('inspectNotFiredYet')}</dt>
                      <dd class="u-warn">
                        {model.fires
                          .filter((f) => f.count === 0 && f.ref.rule)
                          .map((f) => f.ref.label)
                          .join(' · ') || '—'}
                      </dd>
                    </div>
                  </>
                )}
                {model.freshness && (
                  <div>
                    <dt>{t('inspectFreshnessLine')}</dt>
                    <dd>{model.freshnessPenalty ? `${model.freshness} · ${model.freshnessPenalty}` : `${model.freshness} · ${t('inspectNoPenalty')}`}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** "Deciding now (0:27.0): R4 again, same target." with what he would do, or why he cannot decide. */
function NowLine({ probe, model }: { probe: ProbeState; model: InspectorModel }) {
  if (probe === 'loading') return <p class="u-xs u-muted u-mt-2">{t('inspectNowLoading')}</p>;
  if (probe !== 'ready' || !model.now) return <p class="u-xs u-muted u-mt-2">{t('inspectNowFailed')}</p>;
  const ev = model.now.evaluation;
  return (
    <>
      <p class="u-xs u-muted u-mt-2" data-testid={ev ? 'inspector-now-rule' : 'inspector-blocked'}>
        <Icon name="info" size="sm" /> <b class="u-strong">{t('inspectDecidingNow', { time: model.now.at })}</b>{' '}
        {ev ? (ev.same ? t('inspectSameRule', { label: ev.ref.label }) : t('inspectOtherRule', { label: ev.ref.label })) : t('inspectNowNone', { why: model.now.blocked ?? '' })}
        {ev?.target ? ` → ${ev.target}` : ''}
      </p>
      {model.now.pending && <p class="u-sm">{model.now.pending}</p>}
    </>
  );
}
