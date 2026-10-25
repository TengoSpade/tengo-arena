import { describe, expect, it } from 'vitest';
import { fixtureContent } from '../testkit';
import { InvariantError } from '../util';
import { lastRegularWeekIndex, matchweekWeek, nextCalendar, seasonLength, seasonStartCalendar, weekDef } from './index';

const content = fixtureContent();

describe('calendar (sys-calendar)', () => {
  it('reads week definitions by season week index', () => {
    expect(weekDef(content, 1)).toMatchObject({ id: 'P1', phase: 'preseason' });
    expect(weekDef(content, 9)).toMatchObject({ id: 'MW5', matchweek: 5, fixtureKind: 'cross_wing' });
    expect(weekDef(content, 23)).toMatchObject({ id: 'TW3', round: 'final' });
    expect(() => weekDef(content, 0)).toThrow(InvariantError);
    expect(() => weekDef(content, 24)).toThrow(InvariantError);
  });

  it('starts every season at P1 in the preseason', () => {
    expect(seasonStartCalendar(1, content)).toEqual({ season: 1, weekIndex: 1, weekId: 'P1', phase: 'preseason' });
    expect(seasonStartCalendar(7, content)).toEqual({ season: 7, weekIndex: 1, weekId: 'P1', phase: 'preseason' });
    expect(() => seasonStartCalendar(0, content)).toThrow(InvariantError);
  });

  it('walks preseason -> regular -> tournament -> season-end, one week per step', () => {
    let calendar = seasonStartCalendar(3, content);
    const seen = [calendar];
    while (calendar.phase !== 'season-end') {
      calendar = nextCalendar(calendar, content);
      seen.push(calendar);
    }
    expect(seen).toHaveLength(seasonLength(content) + 1);
    expect(seen.map((c) => c.weekIndex)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    // Phase boundaries of the default calendar: P4 -> MW1, MW16 -> TW1, TW3 -> season end.
    expect(seen[3]).toEqual({ season: 3, weekIndex: 4, weekId: 'P4', phase: 'preseason' });
    expect(seen[4]).toEqual({ season: 3, weekIndex: 5, weekId: 'MW1', phase: 'regular' });
    expect(seen[19]).toEqual({ season: 3, weekIndex: 20, weekId: 'MW16', phase: 'regular' });
    expect(seen[20]).toEqual({ season: 3, weekIndex: 21, weekId: 'TW1', phase: 'tournament' });
    expect(seen[23]).toEqual({ season: 3, weekIndex: 24, weekId: null, phase: 'season-end' });
    // Phases never go backwards.
    const order = ['preseason', 'regular', 'tournament', 'season-end'];
    const ranks = seen.map((c) => order.indexOf(c.phase));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('refuses to advance the season-end step or an out-of-range week', () => {
    expect(() => nextCalendar({ season: 1, weekIndex: 24, weekId: null, phase: 'season-end' }, content)).toThrow(InvariantError);
    expect(() => nextCalendar({ season: 1, weekIndex: 30, weekId: null, phase: 'tournament' }, content)).toThrow(InvariantError);
  });

  it('maps matchweeks to calendar weeks and knows where the regular season ends', () => {
    expect(matchweekWeek(content, 1).index).toBe(5);
    expect(matchweekWeek(content, 16).index).toBe(20);
    expect(() => matchweekWeek(content, 17)).toThrow(InvariantError);
    expect(lastRegularWeekIndex(content)).toBe(20);
  });
});
