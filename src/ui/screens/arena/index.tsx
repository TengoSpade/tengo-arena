/** #/arena: the player's match being watched (M2; WP-M2E). Contract placeholder until then. */
import type { ScreenProps } from '../../app/routes';
import { ArenaPlaceholder } from './ArenaPlaceholder';

export default function ArenaScreen(_props: ScreenProps) {
  return <ArenaPlaceholder mode="arena" />;
}
