import type { ScreenProps } from '../../app/routes';

/** Placeholder until WP6 builds this screen (docs/design/_drafts/05-technical.md §9). */
export default function HomeScreen({ params }: ScreenProps) {
  return (
    <section class="page" data-testid="screen-home" data-params={JSON.stringify(params)}>
      <div class="empty">
        <div class="empty__title">home</div>
        <div class="empty__text">Not built yet (WP6).</div>
      </div>
    </section>
  );
}
