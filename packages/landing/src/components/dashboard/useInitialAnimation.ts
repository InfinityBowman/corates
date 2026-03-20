/**
 * useInitialAnimation - Animation styles that only apply on first render
 *
 * Uses a module-level flag so animations play once per page load,
 * not on re-renders or component remounts.
 */

import { createContext, useContext, useEffect } from 'react';

// Module-level flag -- persists across re-renders, resets on page reload
let hasAnimated = false;

/* eslint-disable no-unused-vars */
interface AnimationHelpers {
  shouldAnimate: boolean;
  fadeUp: (delay?: number) => React.CSSProperties;
  statRise: (delay?: number) => React.CSSProperties;
}
/* eslint-enable no-unused-vars */

export function useInitialAnimation(): AnimationHelpers {
  const shouldAnimate = !hasAnimated;

  // Set flag after commit (not during render) to keep renders pure
  // and avoid breaking Strict Mode double-render
  useEffect(() => {
    hasAnimated = true;
  }, []);

  const fadeUp = (delay = 0): React.CSSProperties => {
    if (!shouldAnimate) return {};
    return { animation: `fade-up 0.6s ease-out ${delay}ms backwards` };
  };

  const statRise = (delay = 0): React.CSSProperties => {
    if (!shouldAnimate) return {};
    return { animation: `stat-rise 0.4s ease-out ${delay}ms backwards` };
  };

  return { shouldAnimate, fadeUp, statRise };
}

export function resetAnimationState() {
  hasAnimated = false;
}

// Context to share animation helpers down the component tree
export const AnimationContext = createContext<AnimationHelpers>({
  shouldAnimate: false,
  fadeUp: () => ({}),
  statRise: () => ({}),
});

export function useAnimation(): AnimationHelpers {
  return useContext(AnimationContext);
}
