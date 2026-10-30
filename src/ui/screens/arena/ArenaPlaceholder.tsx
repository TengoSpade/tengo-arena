/**
 * M2 contract placeholder for the arena screens (05-technical-m2 §A7). WP-M2E replaces it with the arena
 * screen: the PixiJS canvas (loaded with import('../../../render/viewer')) under a DOM HUD, controls, the
 * fighter strip, the pause inspector and the live feed. Nothing links here yet (the report's Replay button
 * stays disabled), so the game flow is unchanged.
 */
import { Empty, PageHeader } from '../../components';
import { hrefFor } from '../../app/routes';
import { t } from './text';

export function ArenaPlaceholder({ mode }: { mode: 'arena' | 'replay' }) {
  return (
    <section class="page" data-testid={`screen-${mode}`}>
      <PageHeader eyebrow={t(mode === 'arena' ? 'eyebrowLive' : 'eyebrowReplay')} title={t('title')} />
      <Empty
        icon="swords"
        title={t('pending')}
        text={t('pendingText')}
        actions={
          <a class="btn btn--sm" href={hrefFor('home')}>
            {t('home')}
          </a>
        }
      />
    </section>
  );
}
