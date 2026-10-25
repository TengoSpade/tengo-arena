/**
 * Reversible club actions with Undo (D-M class 1): lineup rows, captain and
 * vice-captain, presets, training emphasis. Each one dispatches a command
 * and registers the inverse command as the toast's Undo (Ctrl Z), so Undo
 * goes through the same validated command path (04 behaviour contracts).
 * The UI only composes the command; core validates it.
 */
import type { ContentDB } from '../../core/content';
import type { Club, Command, FighterId, GameState, LineupEntry, StartingRow, TacticsAssignment, TacticsPresetId, TrainingEmphasis } from '../../core/model';
import { showToast } from '../components/Toast';
import { format } from '../text';
import type { GameStore } from './contract';

export interface ActionText {
  front: string;
  back: string;
  reserve: string;
  replace: string;
  captain: string;
  vice: string;
  captainSub: string;
  preset: string;
  emphasis: string;
}

export type LineupTarget = StartingRow | 'reserve';

function lineupCommand(club: Club, fighters: LineupEntry[]): Command {
  const keep = club.lineup.matchCaptainId && fighters.some((e) => e.fighterId === club.lineup.matchCaptainId) ? club.lineup.matchCaptainId : null;
  return { type: 'lineup.set', clubId: club.id, fighters, matchCaptainId: keep };
}

/** Run a command; on success show a toast whose Undo dispatches `inverse`. */
export function runUndoable(store: GameStore, command: Command, inverse: Command, title: string, sub?: string): boolean {
  const res = store.dispatch(command);
  if (!res.ok) return false;
  showToast({ title, sub, kind: 'accent', undo: () => void store.dispatch(inverse) });
  return true;
}

export function clubActions(store: GameStore, state: GameState, content: ContentDB, club: Club, text: ActionText) {
  const nameOf = (id: FighterId) => state.fighters[id]?.name.full ?? id;
  const before = lineupCommand(club, club.lineup.fighters.map((e) => ({ ...e })));

  /** Move a fighter to a row or the reserves. When the lineup is full, the fighter replaces `swapWith` or the last fighter of that row. */
  const moveTo = (id: FighterId, target: LineupTarget, swapWith?: FighterId | null): boolean => {
    const entries = club.lineup.fighters.map((e) => ({ ...e }));
    const i = entries.findIndex((e) => e.fighterId === id);
    let title: string;
    if (target === 'reserve') {
      if (i < 0) return false;
      entries.splice(i, 1);
      title = format(text.reserve, { name: nameOf(id) });
    } else if (swapWith && swapWith !== id && entries.some((e) => e.fighterId === swapWith)) {
      const j = entries.findIndex((e) => e.fighterId === swapWith);
      const other = entries[j]!;
      if (i >= 0) {
        const mine = entries[i]!;
        entries[i] = { fighterId: other.fighterId, row: mine.row };
        entries[j] = { fighterId: id, row: other.row };
      } else entries[j] = { fighterId: id, row: other.row };
      title = format(text.replace, { name: nameOf(id), other: nameOf(other.fighterId) });
    } else if (i >= 0) {
      if (entries[i]!.row === target) return false;
      entries[i] = { fighterId: id, row: target };
      title = format(target === 'front' ? text.front : text.back, { name: nameOf(id) });
    } else if (entries.length < 5) {
      entries.push({ fighterId: id, row: target });
      title = format(target === 'front' ? text.front : text.back, { name: nameOf(id) });
    } else {
      let j = -1;
      for (let k = entries.length - 1; k >= 0; k--) if (entries[k]!.row === target) {
        j = k;
        break;
      }
      if (j < 0) j = entries.length - 1;
      const other = entries[j]!.fighterId;
      entries[j] = { fighterId: id, row: target };
      title = format(text.replace, { name: nameOf(id), other: nameOf(other) });
    }
    return runUndoable(store, lineupCommand(club, entries), before, title);
  };

  const captaincy = (captainId: FighterId | null, viceCaptainId: FighterId | null): Command => ({ type: 'captaincy.set', clubId: club.id, captainId, viceCaptainId });
  const prevCaptaincy = captaincy(club.captainId, club.viceCaptainId);

  const setCaptain = (id: FighterId): boolean => {
    if (club.captainId === id) return false;
    const vice = club.viceCaptainId === id ? club.captainId : club.viceCaptainId;
    return runUndoable(store, captaincy(id, vice), prevCaptaincy, format(text.captain, { name: nameOf(id) }), text.captainSub);
  };

  const setVice = (id: FighterId): boolean => {
    if (club.viceCaptainId === id) return false;
    const captain = club.captainId === id ? club.viceCaptainId : club.captainId;
    return runUndoable(store, captaincy(captain, id), prevCaptaincy, format(text.vice, { name: nameOf(id) }), text.captainSub);
  };

  const presetOf = (id: FighterId): TacticsAssignment | undefined => club.lineup.tactics[id];

  const setPreset = (id: FighterId, presetId: string): boolean => {
    const f = state.fighters[id];
    if (!f) return false;
    const current = presetOf(id);
    if (current?.kind === 'preset' && current.presetId === presetId) return false;
    const klass = content.classes.require(f.classId);
    const fallback: TacticsAssignment = { kind: 'preset', presetId: klass.defaultPresetId as TacticsPresetId };
    const preset = content.presets.get(presetId);
    return runUndoable(
      store,
      { type: 'tactics.assign', clubId: club.id, fighterId: id, tactics: { kind: 'preset', presetId: presetId as TacticsPresetId } },
      { type: 'tactics.assign', clubId: club.id, fighterId: id, tactics: current ?? fallback },
      format(text.preset, { name: f.name.full, preset: preset?.name ?? presetId }),
    );
  };

  const cyclePreset = (id: FighterId): boolean => {
    const f = state.fighters[id];
    if (!f) return false;
    const ids = content.classes.require(f.classId).presetIds;
    const cur = presetOf(id);
    const i = cur?.kind === 'preset' ? ids.indexOf(cur.presetId) : -1;
    const next = ids[(i + 1) % ids.length];
    return next ? setPreset(id, next) : false;
  };

  const setEmphasis = (id: FighterId, emphasis: TrainingEmphasis): boolean => {
    const f = state.fighters[id];
    if (!f || f.trainingEmphasis === emphasis) return false;
    const label = content.development.training.options.find((o) => o.id === emphasis)?.label ?? emphasis;
    return runUndoable(
      store,
      { type: 'training.set', clubId: club.id, fighterId: id, emphasis },
      { type: 'training.set', clubId: club.id, fighterId: id, emphasis: f.trainingEmphasis },
      format(text.emphasis, { name: f.name.full, emphasis: label }),
    );
  };

  const cycleEmphasis = (id: FighterId): boolean => {
    const f = state.fighters[id];
    if (!f) return false;
    const opts = content.development.training.options.map((o) => o.id as TrainingEmphasis);
    const next = opts[(opts.indexOf(f.trainingEmphasis) + 1) % opts.length];
    return next ? setEmphasis(id, next) : false;
  };

  const setLineup = (fighters: LineupEntry[], title: string): boolean => runUndoable(store, lineupCommand(club, fighters), before, title);

  return { moveTo, setCaptain, setVice, setPreset, cyclePreset, setEmphasis, cycleEmphasis, setLineup, presetOf };
}
