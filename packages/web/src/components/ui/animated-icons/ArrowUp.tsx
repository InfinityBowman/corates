import type { Component } from 'solid-js';
import { splitProps } from 'solid-js';
import { animate } from 'motion';
import type { AnimatedIconProps } from './types';
import { cn } from '@components/ui/cn';

export interface ArrowUpProps extends Omit<AnimatedIconProps, 'animation'> {
  /** Animation variant matching animate-ui */
  animation?: 'default' | 'pointing';
}

interface AnimationControl {
  stop: () => void;
  cancel: () => void;
}

/**
 * Animated arrow-up icon (matches animate-ui)
 * - default: moves up 25% on hover
 * - pointing: morphs to more pointed arrow
 */
export const ArrowUp: Component<ArrowUpProps> = props => {
  const [local, others] = splitProps(props, ['size', 'color', 'strokeWidth', 'class', 'animation']);

  const size = () => local.size ?? 24;
  const color = () => local.color ?? 'currentColor';
  const strokeWidth = () => local.strokeWidth ?? 2;
  const animationName = () => local.animation ?? 'default';

  let groupRef: SVGGElement | undefined;
  let path1Ref: SVGPathElement | undefined; // eslint-disable-line no-undef
  let path2Ref: SVGPathElement | undefined; // eslint-disable-line no-undef
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

  const playAnimation = () => {
    cancelAnimations();
    const variant = animationName();

    if (variant === 'default' && groupRef) {
      const anim = animate(groupRef, { y: '-25%' } as Record<string, unknown>, {
        duration: 0.3,
        ease: 'easeInOut',
      }) as AnimationControl;
      activeAnimations.push(anim);
    } else if (variant === 'pointing') {
      if (path1Ref) {
        const anim = animate(path1Ref, { d: 'M12 19V10' } as Record<string, unknown>, {
          duration: 0.3,
          ease: 'easeInOut',
        }) as AnimationControl;
        activeAnimations.push(anim);
      }
      if (path2Ref) {
        const anim = animate(path2Ref, { d: 'm5 16 7-7 7 7' } as Record<string, unknown>, {
          duration: 0.3,
          ease: 'easeInOut',
        }) as AnimationControl;
        activeAnimations.push(anim);
      }
    }
  };

  const resetAnimation = () => {
    cancelAnimations();
    const variant = animationName();

    if (variant === 'default' && groupRef) {
      const anim = animate(groupRef, { y: 0 } as Record<string, unknown>, {
        duration: 0.3,
        ease: 'easeInOut',
      }) as AnimationControl;
      activeAnimations.push(anim);
    } else if (variant === 'pointing') {
      if (path1Ref) {
        const anim = animate(path1Ref, { d: 'M12 19V5' } as Record<string, unknown>, {
          duration: 0.3,
          ease: 'easeInOut',
        }) as AnimationControl;
        activeAnimations.push(anim);
      }
      if (path2Ref) {
        const anim = animate(path2Ref, { d: 'm5 12 7-7 7 7' } as Record<string, unknown>, {
          duration: 0.3,
          ease: 'easeInOut',
        }) as AnimationControl;
        activeAnimations.push(anim);
      }
    }
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
      <g ref={groupRef}>
        <path ref={path1Ref} d='M12 19V5' />
        <path ref={path2Ref} d='m5 12 7-7 7 7' />
      </g>
    </svg>
  );
};
