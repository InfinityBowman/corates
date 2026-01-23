import type { Component } from 'solid-js';
import { splitProps } from 'solid-js';
import { animate } from 'motion';
import type { AnimatedIconProps } from './types';
import { cn } from '@components/ui/cn';

export interface CheckProps extends Omit<AnimatedIconProps, 'animation'> {}

interface AnimationControl {
  stop: () => void;
  cancel: () => void;
}

/**
 * Animated check icon with path drawing animation
 * Draws the checkmark on hover, exactly like animate-ui
 */
export const Check: Component<CheckProps> = props => {
  const [local, others] = splitProps(props, ['size', 'color', 'strokeWidth', 'class']);

  const size = () => local.size ?? 24;
  const color = () => local.color ?? 'currentColor';
  const strokeWidth = () => local.strokeWidth ?? 2;

  let pathRef: SVGPathElement | undefined; // eslint-disable-line no-undef
  let activeAnimation: AnimationControl | null = null;

  const cancelAnimation = () => {
    if (activeAnimation) {
      try {
        activeAnimation.cancel();
      } catch {
        // Already finished
      }
      activeAnimation = null;
    }
  };

  const playAnimation = () => {
    if (!pathRef) return;
    cancelAnimation();

    // Animate pathLength from 0 to 1 (draws the path)
    // Also animate opacity and scale like animate-ui
    activeAnimation = animate(
      pathRef,
      {
        pathLength: [0, 1],
        opacity: [0, 1],
      } as Record<string, unknown>,
      {
        duration: 0.6,
        ease: 'easeInOut',
      },
    ) as AnimationControl;
  };

  const resetAnimation = () => {
    if (!pathRef) return;
    cancelAnimation();

    // Reset to fully visible
    activeAnimation = animate(
      pathRef,
      {
        pathLength: 1,
        opacity: 1,
      } as Record<string, unknown>,
      {
        duration: 0.3,
        ease: 'easeOut',
      },
    ) as AnimationControl;
  };

  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size()}
      height={size()}
      viewBox='0 0 24 24'
      fill='none'
      stroke={color()}
      stroke-width={strokeWidth()}
      stroke-linecap='round'
      stroke-linejoin='round'
      class={cn('inline-block overflow-visible', local.class)}
      style={{ overflow: 'visible' }}
      onMouseEnter={playAnimation}
      onMouseLeave={resetAnimation}
      {...others}
    >
      <path
        ref={pathRef}
        d='m4 12 5 5L20 6'
        pathLength={1}
        style={{ 'transform-origin': 'center' }}
      />
    </svg>
  );
};
