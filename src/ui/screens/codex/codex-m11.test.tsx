import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { TestProviders, createTestStore } from '../../debug/test-store';
import CodexScreen from './index';

afterEach(cleanup);

describe('Codex: ranks and perks (M1.1)', () => {
  it('shows each ability’s rank II and III effects, the class’s perks, and the full catalog by archetype', async () => {
    const { store, content } = createTestStore();
    const klass = content.classes.list.find((k) => k.archetypes.length === 1)!;
    render(
      <TestProviders store={store}>
        <CodexScreen params={{ class: klass.id }} />
      </TestProviders>,
    );
    const detail = await screen.findByTestId('class-detail');
    const a1 = content.classAbility(klass.id, 'a1');
    const ranks = within(detail).getByTestId(`ranks-${a1.id}`);
    expect(ranks.querySelectorAll('li')).toHaveLength(2);
    expect(ranks.textContent).toContain(content.abilityRanks(a1.id)!.ranks[0]!.summary);
    const classPerks = within(detail).getByTestId('class-perk-catalog');
    expect(within(classPerks).getByTestId('perks-general')).toBeTruthy();
    expect(within(classPerks).getByTestId(`perks-${klass.archetypes[0]}`)).toBeTruthy();
    expect(within(classPerks).queryAllByTestId(/^perks-/)).toHaveLength(2);
    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Perks \(/ }));
    });
    const all = screen.getByTestId('codex-perks');
    for (const a of ['general', 'tank', 'melee', 'ranged', 'controller', 'healer']) {
      const n = content.perks.list.filter((p) => p.archetype === a).length;
      if (n) expect(within(all).getByTestId(`perks-${a}`).querySelectorAll('li')).toHaveLength(n);
    }
  });
});
