/**
 * Animated Icons
 *
 * SVG icons with hover and auto-play animations using the motion library.
 *
 * @example
 * // Basic usage - bounces on hover
 * import { ArrowDown } from '@components/ui/animated-icons';
 * <ArrowDown size={24} />
 *
 * @example
 * // Path drawing animation
 * import { ArrowRight } from '@components/ui/animated-icons';
 * <ArrowRight animation="path" />
 *
 * @example
 * // Continuous loader
 * import { Loader } from '@components/ui/animated-icons';
 * <Loader animation="spin" />
 */

// Icon components
export { ArrowDown, type ArrowDownProps } from './ArrowDown';
export { ArrowUp, type ArrowUpProps } from './ArrowUp';
export { ArrowLeft, type ArrowLeftProps } from './ArrowLeft';
export { ArrowRight, type ArrowRightProps } from './ArrowRight';
export { Check, type CheckProps } from './Check';
export { Loader, type LoaderProps } from './Loader';

// Types
export type {
  AnimatedIconProps,
  AnimationOptions,
  AnimationVariant,
  VariantDefinition,
  AnimatedIconControls,
  CreateAnimatedIconOptions,
} from './types';

// Primitive (for creating custom animated icons)
export { createAnimatedIcon } from '@/primitives/createAnimatedIcon';
