import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent, type RawContentFiles } from '../../../core/content';
import { FIXTURE_CONTENT_RAW } from '../../../core/testkit';
import { TestProviders, createTestStore } from '../../debug/test-store';
import CodexScreen from './index';

afterEach(cleanup);

describe('Codex: starter classes', () => {
  it('tags the beginner picks with a small Starter tag on the class cards', async () => {
    const { store } = createTestStore();
    // The fixture content is a subset without starter tags: mark its first class as the default content marks the beginner picks.
    const raw = structuredClone(FIXTURE_CONTENT_RAW) as RawContentFiles & { classes: { classes: { roleTags: string[] }[] } };
    raw.classes.classes[0]!.roleTags.push('starter');
    const loaded = loadContent('fixture', raw, { profile: 'fixture' });
    if (!loaded.ok) throw new Error('fixture content invalid');
    const content = loaded.value;
    store.replaceWorld(store.game.value!, content);
    render(
      <TestProviders store={store}>
        <CodexScreen params={{}} />
      </TestProviders>,
    );
    const starter = content.classes.list.find((k) => k.roleTags.includes('starter'));
    const plain = content.classes.list.find((k) => !k.roleTags.includes('starter'));
    if (starter) expect(within(await screen.findByTestId(`class-card-${starter.id}`)).getByText('Starter')).toBeTruthy();
    if (plain) expect(within(await screen.findByTestId(`class-card-${plain.id}`)).queryByText('Starter')).toBeNull();
    expect(starter).toBeTruthy();
  });
});

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
