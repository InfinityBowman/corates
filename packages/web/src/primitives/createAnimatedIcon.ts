/**
 * createAnimatedIcon - Primitive for creating hover-animated icon components
 *
 * Handles element registration, animation coordination, and hover triggers.
 * Uses vanilla motion library for GPU-accelerated animations.
 *
 * @example
 * const icon = createAnimatedIcon({
 *   variants: {
 *     group: { keyframes: { y: [0, -4, 0] }, options: { duration: 0.5 } },
 *     path: { keyframes: { strokeDashoffset: [100, 0] }, options: { duration: 0.6 } }
 *   }
 * });
 *
 * <svg onMouseEnter={icon.onMouseEnter} onMouseLeave={icon.onMouseLeave}>
 *   <g ref={icon.register('group')}>
 *     <path ref={icon.register('path')} d="..." />
 *   </g>
 * </svg>
 */
import { createSignal, onCleanup } from 'solid-js';
import { animate } from 'motion';
import type {
  AnimatedIconControls,
  CreateAnimatedIconOptions,
  RegisterElement,
  VariantDefinition,
} from '@components/ui/animated-icons/types';

interface AnimationControl {
  stop: () => void;
  cancel: () => void;
  finished: Promise<void>;
}

/**
 * Reverses keyframe arrays in a variant definition
 */
function reverseKeyframes(
  keyframes: Record<string, number | string | (number | string)[]>,
): Record<string, number | string | (number | string)[]> {
  const reversed: Record<string, number | string | (number | string)[]> = {};

  for (const [key, value] of Object.entries(keyframes)) {
    if (Array.isArray(value)) {
      reversed[key] = [...value].reverse();
    } else {
      reversed[key] = value;
    }
  }

  return reversed;
}

/**
 * Creates animation controls and handlers for an animated icon
 */
export function createAnimatedIcon(options: CreateAnimatedIconOptions): AnimatedIconControls {
  const { variants, autoReverse = true, resetVariants } = options;

  const elements = new Map<string, SVGElement | HTMLElement>();
  const activeAnimations = new Map<string, AnimationControl>();

  const [isAnimating, setIsAnimating] = createSignal(false);

  /**
   * Register an element for animation by key
   */
  const register: RegisterElement = (elementKey: string) => {
    return (el: SVGElement | HTMLElement | null) => {
      if (el) {
        elements.set(elementKey, el);
      } else {
        elements.delete(elementKey);
      }
    };
  };

  /**
   * Cancel all active animations
   */
  const cancelAll = () => {
    activeAnimations.forEach(control => {
      try {
        control.cancel();
      } catch {
        // Animation may already be finished
      }
    });
    activeAnimations.clear();
  };

  /**
   * Play animations for all registered elements using given variants
   */
  const playVariants = async (variantDef: VariantDefinition) => {
    cancelAll();
    setIsAnimating(true);

    const animationPromises: Promise<void>[] = [];

    elements.forEach((element, key) => {
      const variant = variantDef[key];
      if (!variant) return;

      try {
        const control = animate(element, variant.keyframes as Record<string, unknown>, {
          duration: variant.options?.duration ?? 0.3,
          delay: variant.options?.delay,
          ease: variant.options?.ease,
          repeat: variant.options?.repeat,
          repeatType: variant.options?.repeatType,
        }) as AnimationControl;

        activeAnimations.set(key, control);
        animationPromises.push(control.finished);
      } catch (error) {
        console.warn(`[createAnimatedIcon] Failed to animate element '${key}':`, error);
      }
    });

    try {
      await Promise.all(animationPromises);
    } catch {
      // Animations were cancelled
    } finally {
      setIsAnimating(false);
    }
  };

  /**
   * Play the hover-in animation
   */
  const play = () => {
    playVariants(variants);
  };

  /**
   * Reset to initial state (play reverse animation or use reset variants)
   */
  const reset = () => {
    if (resetVariants) {
      playVariants(resetVariants);
      return;
    }

    if (!autoReverse) {
      cancelAll();
      setIsAnimating(false);
      return;
    }

    // Build reversed variants
    const reversedVariants: VariantDefinition = {};
    for (const [key, variant] of Object.entries(variants)) {
      reversedVariants[key] = {
        keyframes: reverseKeyframes(variant.keyframes),
        options: {
          ...variant.options,
          duration: (variant.options?.duration ?? 0.3) * 0.5, // Faster reset
        },
      };
    }

    playVariants(reversedVariants);
  };

  const onMouseEnter = () => {
    play();
  };

  const onMouseLeave = () => {
    reset();
  };

  onCleanup(() => {
    cancelAll();
    elements.clear();
  });

  return {
    register,
    onMouseEnter,
    onMouseLeave,
    isAnimating,
    play,
    reset,
  };
}
