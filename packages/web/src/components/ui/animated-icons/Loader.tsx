import type { Component } from 'solid-js';
import { splitProps, onMount, onCleanup } from 'solid-js';
import { animate } from 'motion';
import type { AnimatedIconProps } from './types';
import { cn } from '@components/ui/cn';

export interface LoaderProps extends Omit<AnimatedIconProps, 'animation'> {
  /** Animation variant: 'spin' (staggered opacity like animate-ui) or 'pulse' (opacity pulse) */
  animation?: 'spin' | 'pulse';
  /** Whether animation auto-plays on mount (default: true) */
  autoPlay?: boolean;
}

interface AnimationControl {
  stop: () => void;
  cancel: () => void;
}

const SEGMENT_COUNT = 8;
const DURATION = 1.2;
const BASE_OPACITY = 0.25;

/**
 * Animated loader/spinner icon
 * Uses staggered opacity animations on each spoke (like animate-ui)
 */
export const Loader: Component<LoaderProps> = props => {
  const [local, others] = splitProps(props, [
    'size',
    'color',
    'strokeWidth',
    'class',
    'animation',
    'autoPlay',
  ]);

  const size = () => local.size ?? 24;
  const color = () => local.color ?? 'currentColor';
  const strokeWidth = () => local.strokeWidth ?? 2;
  const animationName = () => local.animation ?? 'spin';
  const autoPlay = () => local.autoPlay ?? true;

  let groupRef: SVGGElement | undefined;
  const pathRefs: (SVGPathElement | undefined)[] = []; // eslint-disable-line no-undef
  let activeAnimations: AnimationControl[] = [];

  const cancelAnimations = () => {
    for (const anim of activeAnimations) {
      try {
        anim.cancel();
      } catch {
        // Already finished
      }
    }
    activeAnimations = [];
  };

  const startAnimation = () => {
    cancelAnimations();

    if (animationName() === 'spin') {
      // Staggered opacity animation on each spoke (like animate-ui)
      for (let i = 0; i < SEGMENT_COUNT; i++) {
        const pathRef = pathRefs[i];
        if (!pathRef) continue;

        // Reverse index creates the "chasing" effect
        const reverseIndex = SEGMENT_COUNT - 1 - i;
        const delay = -(reverseIndex * DURATION) / SEGMENT_COUNT;

        const anim = animate(pathRef, { opacity: [1, BASE_OPACITY] } as Record<string, unknown>, {
          duration: DURATION,
          ease: 'linear',
          repeat: Infinity,
          delay,
        }) as AnimationControl;
        activeAnimations.push(anim);
      }
    } else if (animationName() === 'pulse' && groupRef) {
      const anim = animate(groupRef, { opacity: [1, 0.4, 1] } as Record<string, unknown>, {
        duration: 1.2,
        ease: 'easeInOut',
        repeat: Infinity,
      }) as AnimationControl;
      activeAnimations.push(anim);
    }
  };

  onMount(() => {
    if (autoPlay()) {
      startAnimation();
    }
  });

  onCleanup(() => {
    cancelAnimations();
  });

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
      class={cn('inline-block', local.class)}
      {...others}
    >
      <g ref={groupRef}>
        <path ref={el => (pathRefs[0] = el)} d='M12 2v4' />
        <path ref={el => (pathRefs[1] = el)} d='m16.2 7.8 2.9-2.9' />
        <path ref={el => (pathRefs[2] = el)} d='M18 12h4' />
        <path ref={el => (pathRefs[3] = el)} d='m16.2 16.2 2.9 2.9' />
        <path ref={el => (pathRefs[4] = el)} d='M12 18v4' />
        <path ref={el => (pathRefs[5] = el)} d='m4.9 19.1 2.9-2.9' />
        <path ref={el => (pathRefs[6] = el)} d='M2 12h4' />
        <path ref={el => (pathRefs[7] = el)} d='m4.9 4.9 2.9 2.9' />
      </g>
    </svg>
  );
};
