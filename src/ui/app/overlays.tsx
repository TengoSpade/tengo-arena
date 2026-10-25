/**
 * The transient "Simulating" panel (04 ui-match: 600 ms, 0 with reduced motion; Esc does nothing
 * but is not an error). The shortcut sheet and search live in palettes.tsx (loaded on first use).
 */
import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { t } from '../text';

/** "Simulating · Round 1 · Round 2 · Round 3" filling in while the week resolves. */
export function SimulatingPanel({ rounds }: { rounds: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setShown((s) => Math.min(rounds, s + 1)), 180);
    return () => clearInterval(id);
  }, [rounds]);
  return (
    <div class="modal-backdrop" role="status" aria-live="polite" data-testid="simulating">
      <div class="modal modal--narrow">
        <header class="modal__header">
          <Icon name="swords" size="lg" />
          <h2 class="modal__title">{t('continue.simulating')}</h2>
        </header>
        <div class="modal__body">
          <div class="round-pips">
            {Array.from({ length: rounds }, (_, i) => (
              <span key={i} class="round-pip" data-winner={i < shown ? 'us' : undefined}>
                <strong>{t('continue.round', { n: i + 1 })}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
