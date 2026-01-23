import type { JSX } from 'solid-js';

/**
 * Easing function names supported by the motion library
 */
export type EasingName =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'circIn'
  | 'circOut'
  | 'circInOut'
  | 'backIn'
  | 'backOut'
  | 'backInOut'
  | 'anticipate';

/**
 * Cubic bezier definition as four numbers
 */
export type BezierDefinition = readonly [number, number, number, number];

/**
 * Animation options passed to motion's animate() function
 * Uses motion library's naming conventions (ease, repeatType)
 */
export interface AnimationOptions {
  duration?: number;
  delay?: number;
  ease?: EasingName | BezierDefinition;
  repeat?: number;
  repeatType?: 'loop' | 'reverse' | 'mirror';
}

/**
 * Animation variant definition for a single element
 * Keyframes can be an object with property arrays or an array of keyframe objects
 */
export interface AnimationVariant {
  keyframes: Record<string, number | string | (number | string)[]>;
  options?: AnimationOptions;
}

/**
 * Named collection of animation variants for different elements
 * Key is the element identifier used with register(), value is the variant definition
 *
 * @example
 * {
 *   group: {
 *     keyframes: { y: [0, -4, 0] },
 *     options: { duration: 0.4 }
 *   },
 *   path: {
 *     keyframes: { strokeDashoffset: [100, 0] },
 *     options: { duration: 0.6 }
 *   }
 * }
 */
export type VariantDefinition = Record<string, AnimationVariant>;

/**
 * Registration function returned by primitive
 * Call with element key, returns a ref callback
 */
export type RegisterElement = (
  _elementKey: string,
) => (_el: SVGElement | HTMLElement | null) => void;

/**
 * Return value from createAnimatedIcon primitive
 */
export interface AnimatedIconControls {
  /** Register an element for animation by key */
  register: RegisterElement;
  /** Handler for mouse enter - triggers animation */
  onMouseEnter: JSX.EventHandlerUnion<Element, MouseEvent>;
  /** Handler for mouse leave - resets animation */
  onMouseLeave: JSX.EventHandlerUnion<Element, MouseEvent>;
  /** Whether animation is currently running */
  isAnimating: () => boolean;
  /** Manually trigger the animation */
  play: () => void;
  /** Manually stop and reset the animation */
  reset: () => void;
}

/**
 * Options for createAnimatedIcon primitive
 */
export interface CreateAnimatedIconOptions {
  /** Variant definitions for hover-in animation */
  variants: VariantDefinition;
  /** Whether to auto-reverse keyframes on reset (default: true) */
  autoReverse?: boolean;
  /** Custom reset variants (overrides autoReverse) */
  resetVariants?: VariantDefinition;
}

/**
 * Common props for animated icon components
 */
export interface AnimatedIconProps {
  /** Icon size in pixels (default: 24) */
  size?: number;
  /** Icon stroke color (default: currentColor) */
  color?: string;
  /** Stroke width (default: 2) */
  strokeWidth?: number;
  /** Additional CSS class */
  class?: string;
  /** Animation variant to use (default: 'default') */
  animation?: string;
}
