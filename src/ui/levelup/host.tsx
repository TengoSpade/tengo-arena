/**
 * Level-up host (lazy; mounted by the frame when a week brought level-ups or a screen asks for one):
 * opens the level-up dialog per the club's pacing (progression.md "auto-pick and pacing"):
 * - detailed: after the match report, for every "Ask me" fighter who levelled;
 * - balanced: only for "Ask me" fighters who started a round of the match (the rest keep a badge);
 * - fast: never by itself (badges only).
 * A dialog asked for from a badge or a "Choose" button (levelUpRequest) opens at once.
 */
import { useEffect, useState } from 'preact/hooks';
import type { FighterId, GameState, WeekReport } from '../../core/model';
import { levelUpRequest } from '../app/intents';
import { useRoute } from '../app/router';
import { useStore, type AppStore } from '../store';
import { useEngine, type GameEngine } from '../store/engine';
import { LevelUpDialog } from './LevelUpDialog';

const handledWeeks = new Set<string>();

/** Fighters whose dialog opens by itself after this week's report (pacing). */
export function autoOpenFor(state: GameState, report: WeekReport, engine: GameEngine): FighterId[] {
  const clubId = state.playerClubId;
  const club = clubId ? state.clubs[clubId] : undefined;
  if (!club || !report.levelUps?.length || club.levelUpPacing === 'fast') return [];
  const result = report.playerFixtureId ? state.results[report.playerFixtureId] : undefined;
  const ids = [...new Set(report.levelUps.map((l) => l.fighterId))];
  return ids.filter((id) => {
    const f = state.fighters[id];
    if (!f || f.clubId !== club.id || f.pendingLevelUps.length === 0) return false;
    const mode = engine.effectiveLevelUpMode ? engine.effectiveLevelUpMode(state, f) : f.levelUpMode === 'inherit' ? club.levelUpDefault : f.levelUpMode;
    if (mode !== 'manual') return false;
    return club.levelUpPacing === 'detailed' || (result?.fighterStats[id]?.roundsPlayed ?? 0) > 0;
  });
}

export function LevelUpHost() {
  const store = useStore() as AppStore;
  const engine = useEngine();
  const { route } = useRoute();
  const state = store.game.value;
  const report = store.lastWeekReport.value;
  const [auto, setAuto] = useState<FighterId[]>([]);
  const [asked, setAsked] = useState<FighterId[]>([]);
  const request = levelUpRequest.value;

  useEffect(() => {
    if (!request) return;
    levelUpRequest.value = null;
    setAsked((q) => [request as FighterId, ...q.filter((x) => x !== request)]);
  }, [request]);

  useEffect(() => {
    if (!state || !report?.levelUps?.length) return;
    const key = `${report.season}:${report.weekIndex}:${report.playerFixtureId ?? ''}`;
    if (handledWeeks.has(key)) return;
    handledWeeks.add(key);
    const ids = autoOpenFor(state, report, engine);
    if (ids.length) setAuto((q) => [...q, ...ids.filter((x) => !q.includes(x))]);
  }, [report]);

  // Automatic dialogs wait until the report and the between-round screen are left.
  const waiting = route?.id === 'match-report' || route?.id === 'between-rounds' || !!state?.liveMatch;
  const current = asked[0] ?? (waiting ? undefined : auto[0]);
  if (!current) return null;
  const close = () => {
    setAsked((q) => q.filter((x) => x !== current));
    setAuto((q) => q.filter((x) => x !== current));
  };
  return <LevelUpDialog key={current} fighterId={current} onClose={close} />;
}
