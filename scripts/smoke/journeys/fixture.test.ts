import { describe, expect, it } from 'vitest';
import { screenshotPlan } from './fixture';

describe('screenshot plan (A11: 1280x720 and 1920x1080, both themes, reduced motion, four deficiencies)', () => {
  const plan = screenshotPlan(240);

  it('covers both sizes in both themes', () => {
    for (const size of ['1280x720', '1920x1080']) for (const theme of ['dark', 'light']) expect(plan.some((s) => s.name.startsWith(`${size}-${theme}`) && !s.reducedMotion && s.vision === 'none')).toBe(true);
  });

  it('has reduced motion at both sizes and the four deficiencies at 1920', () => {
    expect(plan.filter((s) => s.reducedMotion).map((s) => s.width)).toEqual([1280, 1920]);
    expect(plan.filter((s) => s.vision !== 'none').map((s) => s.vision).sort()).toEqual(['achromatopsia', 'deuteranopia', 'protanopia', 'tritanopia']);
    expect(plan.filter((s) => s.vision !== 'none').every((s) => s.width === 1920 && s.theme === 'dark')).toBe(true);
  });

  it('has the spawn frame and unique names, dark first so the theme only switches once', () => {
    expect(plan.some((s) => s.tick === 10)).toBe(true);
    const themes = plan.map((s) => s.theme);
    expect(themes.findIndex((th) => th === 'light')).toBeGreaterThan(themes.lastIndexOf('dark') - 1);
    expect(themes.filter((th, i) => i > 0 && th !== themes[i - 1]).length).toBe(1);
    expect(new Set(plan.map((s) => s.name)).size).toBe(plan.length);
    expect(plan).toHaveLength(11);
  });
});
