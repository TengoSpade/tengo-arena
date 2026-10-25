import type { ScreenProps } from '../../app/routes';

/** Placeholder until WP6 builds this screen (docs/design/_drafts/05-technical.md §9). */
export default function ClubSelectScreen({ params }: ScreenProps) {
  return (
    <section class="page" data-testid="screen-club-select" data-params={JSON.stringify(params)}>
      <div class="empty">
        <div class="empty__title">club-select</div>
        <div class="empty__text">Not built yet (WP6).</div>
      </div>
    </section>
  );
}
