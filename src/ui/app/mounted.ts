/**
 * "Is this component still on screen?": a step that outlives its screen (a commit, the Simulating pause, a season step)
 * checks it before it routes, opens a card or raises a toast. Without the check a press of Back mid-step is undone a moment
 * later, when the step finishes and navigates the player somewhere he has already left.
 */
import { useEffect, useRef } from 'preact/hooks';

export function useMounted(): { readonly current: boolean } {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}
