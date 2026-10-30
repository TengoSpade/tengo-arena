import { describe, expect, it } from 'vitest';
import type { GameState } from '../../core/model';
import { createDevEngine } from '../debug/dev-engine';
import { buildDevWorld } from '../debug/dev-world';
import { fixtureContent } from '../../core/testkit';
import { pacingStops, DEFAULT_SETTINGS } from '../store/settings';
import { continueModel, type ContinueInput } from './continue';

const content = fixtureContent();
const engine = createDevEngine();
const firstClub = content.clubs.list[0]!.id;

function input(state: GameState | null, over: Partial<ContinueInput> = {}): ContinueInput {
  return {
    state,
    content,
    engine,
    blockers: state ? engine.getBlockers(state, content) : [],
    routeId: 'home',
    busy: false,
    stops: pacingStops(DEFAULT_SETTINGS),
    ...over,
  };
}

describe('Continue state machine (04 §6.1)', () => {
  const mw = buildDevWorld(content, { playerClubId: firstClub, weekIndex: 11 });

  it('opens the lineup first, then plays the match from the Squad screen', () => {
    const home = continueModel(input(mw));
    expect(home.main).toBe('Continue');
    expect(home.sub).toMatch(/^Lineup (at|vs) /);
    expect(home.action).toEqual({ kind: 'navigate', to: '#/squad' });
    const squad = continueModel(input(mw, { routeId: 'squad' }));
    expect(squad.main).toBe('Play match');
    expect(squad.sub).toMatch(/locks lineup$/);
    expect(squad.action).toEqual({ kind: 'advance', playsMatch: true });
  });

  it('plays straight from Home under the Streamlined preset (no lineup stop)', () => {
    const m = continueModel(input(mw, { stops: pacingStops({ ...DEFAULT_SETTINGS, pacing: 'streamlined' }) }));
    expect(m.main).toBe('Play match');
  });

  it('goes back to the hub from a report', () => {
    const m = continueModel(input(mw, { routeId: 'match-report' }));
    expect(m.sub).toMatch(/^To /);
    expect(m.action).toEqual({ kind: 'navigate', to: '#/home' });
  });

  it('turns neutral and jumps to the blocker', () => {
    const m = continueModel(input(mw, { blockers: [{ code: 'lineup.incomplete' }] }));
    expect(m.state).toBe('blocked');
    expect(m.main).toBe('Decide first');
    expect(m.sub).toBe('Lineup needs 5 fit fighters');
    expect(m.action).toEqual({ kind: 'navigate', to: '#/squad' });
  });

  it('advances preseason weeks and asks to kick off at P4', () => {
    const p1 = buildDevWorld(content, { playerClubId: firstClub, weekIndex: 1 });
    const m1 = continueModel(input(p1));
    expect(m1.sub).toBe('To P2');
    expect(m1.action).toEqual({ kind: 'advance', playsMatch: false });
    const p4 = buildDevWorld(content, { playerClubId: firstClub, weekIndex: 4 });
    const m4 = continueModel(input(p4));
    expect(m4.main).toBe('Kick off season');
    expect(m4.action).toEqual({ kind: 'confirm-advance', variant: 'kick-off' });
  });

  it('offers the season review at season end and is busy while processing', () => {
    const end = { ...mw, calendar: { ...mw.calendar, phase: 'season-end' as const, weekId: null, weekIndex: 24 } };
    const m = continueModel(input(end, { blockers: [] }));
    expect(m.main).toBe('Season review');
    expect(m.action).toEqual({ kind: 'season-end' });
    expect(continueModel(input(mw, { busy: true })).state).toBe('busy');
  });

  it('sends a career without a club to the club select', () => {
    const noClub = buildDevWorld(content, { playerClubId: null });
    const m = continueModel(input(noClub));
    expect(m.state).toBe('blocked');
    expect(m.action).toEqual({ kind: 'navigate', to: '#/club-select' });
  });
});
