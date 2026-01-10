/**
 * useInitialAnimation - Track whether initial animations have played
 *
 * Returns animation style props that only apply on first render.
 * Uses module-level state so animations persist across re-renders
 * but reset on page reload (new session).
 */

// Module-level flag - persists across re-renders, resets on page reload
let hasAnimated = false;

/**
 * Hook to get animation styles for initial load only
 * @returns {Object} Animation helpers
 */
export function useInitialAnimation() {
  // Capture whether we should animate at hook creation time
  const shouldAnimate = !hasAnimated;

  // Mark as animated immediately so subsequent components don't re-animate
  if (!hasAnimated) {
    hasAnimated = true;
  }

  /**
   * Get animation style for fade-up effect
   * @param {number} delay - Delay in ms
   * @returns {Object} Style object
   */
  const fadeUp = (delay = 0) => {
    if (!shouldAnimate) return {};
    return { animation: `fade-up 0.6s ease-out ${delay}ms backwards` };
  };

  /**
   * Get animation style for stat-rise effect
   * @param {number} delay - Delay in ms
   * @returns {Object} Style object
   */
  const statRise = (delay = 0) => {
    if (!shouldAnimate) return {};
    return { animation: `stat-rise 0.4s ease-out ${delay}ms backwards` };
  };

  return {
    shouldAnimate,
    fadeUp,
    statRise,
  };
}

/**
 * Reset animation state (for testing or forced re-animation)
 */
export function resetAnimationState() {
  hasAnimated = false;
}

export default useInitialAnimation;
