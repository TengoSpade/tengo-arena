import { describe, expect, it } from 'vitest';
import { checkOvertime, clockSeconds, type OvertimeUi } from './overtime';

const palette = { warn: 'rgb(232, 168, 56)', text: 'rgb(236, 230, 214)' };
const good: OvertimeUi = { overtimeAttr: 'true', clockText: '0:46', clockColor: 'rgb(232, 168, 56)', tagText: 'Overtime', tagVisible: true, marks: 1, feedSaysSo: true };

describe('reading the clock', () => {
  it('m:ss to seconds', () => {
    expect(clockSeconds('0:46')).toBe(46);
    expect(clockSeconds('1:05')).toBe(65);
    expect(clockSeconds(' 0:45 ')).toBe(45);
    expect(clockSeconds('')).toBeNull();
    expect(clockSeconds(null)).toBeNull();
  });
});

describe('overtime on screen', () => {
  it('passes with the amber clock, the tag, the scrubber mark and the feed line', () => {
    const c = checkOvertime(good, palette, 'round at 46.0 s');
    expect(c.status).toBe('pass');
    expect(c.id).toBe('arena.overtime');
    expect(c.actual).toMatch(/clock 0:46/);
  });

  it('fails each missing piece and says which', () => {
    const cases: [Partial<OvertimeUi>, RegExp][] = [
      [{ overtimeAttr: null }, /no data-overtime/],
      [{ clockText: '0:33' }, /not 0:45 or later/],
      [{ clockColor: 'rgb(236, 230, 214)' }, /not the amber token/],
      [{ tagVisible: false }, /tag is not visible/],
      [{ tagText: 'Fight' }, /tag is not visible/],
      [{ marks: 0 }, /no overtime mark/],
      [{ feedSaysSo: false }, /Overtime begins/],
    ];
    for (const [change, why] of cases) {
      const c = checkOvertime({ ...good, ...change }, palette, 't');
      expect(c.status, JSON.stringify(change)).toBe('fail');
      expect(c.actual, JSON.stringify(change)).toMatch(why);
    }
  });

  it('an amber that is also the text colour would not tell overtime from play', () => {
    const c = checkOvertime(good, { warn: 'rgb(232, 168, 56)', text: 'rgb(232, 168, 56)' }, 't');
    expect(c.status).toBe('fail');
    expect(c.actual).toMatch(/plain text colour/);
  });

  it('works from hex tokens too', () => {
    expect(checkOvertime(good, { warn: '#e8a838', text: '#ece6d6' }, 't').status).toBe('pass');
  });
});
