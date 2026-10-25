import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent } from '../../../core/testkit';
import { Providers } from '../league/testing/providers';
import { makeSampleWorld } from '../league/testing/worlds';
import type { SampleStage } from '../league/testing/sample-season';
import FixturesScreen from './index';

afterEach(cleanup);

const kit = { buildFixtureWorld, fixtureContent };

function renderAt(stage: SampleStage) {
  const world = makeSampleWorld(kit, stage);
  render(
    <Providers store={world.store}>
      <FixturesScreen params={{}} />
    </Providers>,
  );
  return world;
}

describe('Fixtures screen', () => {
  it('shows an empty state without a career', () => {
    render(<FixturesScreen params={{}} />);
    expect(screen.getByTestId('screen-fixtures').textContent).toContain('No career loaded');
  });

  it('lists our 16 fixtures with results, report links and the next fixture highlighted', () => {
    renderAt('mid');
    const table = screen.getByTestId('fixtures-season');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(16);
    const played = rows.filter((r) => within(r).queryByRole('link', { name: /Open the report/ }));
    expect(played).toHaveLength(7);
    expect(within(played[0]!).getByRole('link', { name: /Open the report/ }).getAttribute('href')).toMatch(/^#\/match\/lg%3A2%3A/);
    const next = rows.filter((r) => r.classList.contains('is-us'));
    expect(next).toHaveLength(1);
    expect(next[0]!.textContent).toContain('This week');
    expect(rows[10]!.textContent).toContain('Not played');
  });

  it('shows league points as +n or a plain 0, with the points rule as a tip', () => {
    renderAt('mid');
    const table = screen.getByTestId('fixtures-season');
    const cells = [...table.querySelectorAll('td')].filter((td) => td.querySelector('[data-tip^="Rounds "]'));
    expect(cells.length).toBe(7);
    for (const td of cells) expect(td.textContent).toMatch(/^(\+[123]|0)$/);
    expect(cells[0]!.querySelector('[data-tip]')!.getAttribute('data-tip')).toContain('Points by rounds: 2–0 3');
  });

  it('includes our Reckoning fixtures in the season list', () => {
    const world = renderAt('tournament');
    const me = world.state.playerClubId!;
    const inReckoning = Object.values(world.state.fixtures).some((f) => f.season === 2 && f.stage !== 'league' && (f.homeClubId === me || f.awayClubId === me));
    const rows = within(screen.getByTestId('fixtures-season')).getAllByRole('row').slice(1);
    expect(rows.length).toBe(inReckoning ? 17 : 16);
  });

  it('shows every fixture of a matchweek and steps weeks with the buttons and arrow keys', () => {
    renderAt('mid');
    fireEvent.click(screen.getByRole('tab', { name: 'By matchweek' }));
    const table = screen.getByTestId('fixtures-week');
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(8);
    const subtitle = () => screen.getByTestId('panel-week').querySelector('.panel__subtitle')!.textContent;
    expect(subtitle()).toContain('Matchweek 7');
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(subtitle()).toContain('Matchweek 6');
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(subtitle()).toContain('Matchweek 7');
    expect(within(screen.getByTestId('fixtures-week')).getAllByRole('row').filter((r) => r.classList.contains('is-us'))).toHaveLength(1);
  });

  it('shows the calendar with every week, markers and the current week', () => {
    const { content } = renderAt('mid');
    fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
    const cal = screen.getByTestId('fixtures-calendar');
    expect(cal.querySelectorAll('.fixtures-cal__week')).toHaveLength(content.weeks.list.length);
    expect(cal.querySelectorAll('.fixtures-cal__week.is-now')).toHaveLength(1);
    expect(within(screen.getByTestId('cal-P1')).getByRole('img', { name: /Trials Day/ })).toBeTruthy();
    expect(cal.querySelectorAll('.fixtures-cal__week.is-won, .fixtures-cal__week.is-lost')).toHaveLength(7);
  });
});
