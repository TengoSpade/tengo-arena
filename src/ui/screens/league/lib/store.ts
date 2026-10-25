/**
 * Store access for WP7 screens. Screens read the fixed GameStore contract
 * (src/ui/store). `useCareer()` tolerates a missing provider (the route
 * smoke test renders every screen bare) and a store with no career yet, so
 * every screen can render its "no career" empty state instead of throwing.
 */
import { useContext } from 'preact/hooks';
import type { ContentDB } from '../../../../core/content';
import type { Club, GameState } from '../../../../core/model';
import { StoreContext, type GameStore } from '../../../store';

export function useOptionalStore(): GameStore | null {
  return useContext(StoreContext);
}

export interface Career {
  store: GameStore;
  game: GameState;
  content: ContentDB;
  club: Club;
}

/**
 * The loaded career with the player's club, or null. Reading `.value` inside
 * render subscribes the component to the signals (@preact/signals).
 */
export function useCareer(): Career | null {
  const store = useOptionalStore();
  if (!store) return null;
  const game = store.game.value;
  const content = store.content.value;
  if (!game || !content) return null;
  const clubId = store.playerClubId.value ?? game.playerClubId;
  const club = clubId ? game.clubs[clubId] : undefined;
  if (!club) return null;
  return { store, game, content, club };
}

/** Like useCareer but a club is not required (e.g. Saves, Settings). */
export function useGameOnly(): { store: GameStore | null; game: GameState | null; content: ContentDB | null } {
  const store = useOptionalStore();
  return { store, game: store?.game.value ?? null, content: store?.content.value ?? null };
}

/** Hash navigation (the WP6 router listens to hashchange). */
export function go(path: string): void {
  if (typeof window !== 'undefined') window.location.hash = `#/${path.replace(/^#?\/?/, '')}`;
}

export function href(path: string): string {
  return `#/${path.replace(/^#?\/?/, '')}`;
}
