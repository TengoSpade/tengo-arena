/** #/replay/:fixtureId (?round, ?tick): a played match in the arena viewer (M2; WP-M2E). Contract placeholder until then. */
import type { ScreenProps } from '../../app/routes';
import { ArenaPlaceholder } from './ArenaPlaceholder';

export default function ReplayScreen(_props: ScreenProps) {
  return <ArenaPlaceholder mode="replay" />;
}
