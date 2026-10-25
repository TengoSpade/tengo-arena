import type { ScreenProps } from '../../app/routes';

/** Placeholder until WP7 builds this screen (docs/design/_drafts/05-technical.md §9). */
export default function SettingsScreen({ params }: ScreenProps) {
  return (
    <section class="page" data-testid="screen-settings" data-params={JSON.stringify(params)}>
      <div class="empty">
        <div class="empty__title">settings</div>
        <div class="empty__text">Not built yet (WP7).</div>
      </div>
    </section>
  );
}
