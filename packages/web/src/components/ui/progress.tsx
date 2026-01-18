/**
 * Progress component for displaying completion status.
 *
 * @example
 * // Basic usage
 * <Progress value={75}>
 *   <ProgressTrack>
 *     <ProgressRange />
 *   </ProgressTrack>
 * </Progress>
 *
 * @example
 * // With label and value
 * <Progress value={50}>
 *   <ProgressLabel>Loading...</ProgressLabel>
 *   <ProgressTrack>
 *     <ProgressRange />
 *   </ProgressTrack>
 *   <ProgressValueText />
 * </Progress>
 *
 * @example
 * // With variant colors
 * <Progress value={90}>
 *   <ProgressTrack>
 *     <ProgressRange class="bg-red-500" />
 *   </ProgressTrack>
 * </Progress>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Progress as ProgressPrimitive } from '@ark-ui/solid/progress';
import type {
  ProgressRootProps as ArkProgressRootProps,
  ProgressTrackProps as ArkProgressTrackProps,
  ProgressRangeProps as ArkProgressRangeProps,
  ProgressLabelProps as ArkProgressLabelProps,
  ProgressValueTextProps as ArkProgressValueTextProps,
} from '@ark-ui/solid/progress';
import { cn } from './cn';

// Re-export context directly
const ProgressContext = ProgressPrimitive.Context;

type ProgressProps = ArkProgressRootProps & {
  class?: string;
  children?: JSX.Element;
};

const Progress: Component<ProgressProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <ProgressPrimitive.Root class={cn('w-full', local.class)} {...others}>
      {local.children}
    </ProgressPrimitive.Root>
  );
};

type ProgressTrackProps = ArkProgressTrackProps & {
  class?: string;
  children?: JSX.Element;
};

const ProgressTrack: Component<ProgressTrackProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <ProgressPrimitive.Track
      class={cn('h-2 w-full overflow-hidden rounded-full bg-gray-200', local.class)}
      {...others}
    >
      {local.children}
    </ProgressPrimitive.Track>
  );
};

type ProgressRangeProps = ArkProgressRangeProps & {
  class?: string;
};

const ProgressRange: Component<ProgressRangeProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <ProgressPrimitive.Range
      class={cn('h-full bg-blue-600 transition-[width] duration-300 ease-in-out', local.class)}
      {...others}
    />
  );
};

type ProgressLabelProps = ArkProgressLabelProps & {
  class?: string;
  children?: JSX.Element;
};

const ProgressLabel: Component<ProgressLabelProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <ProgressPrimitive.Label
      class={cn('mb-1 block text-sm font-medium text-gray-700', local.class)}
      {...others}
    >
      {local.children}
    </ProgressPrimitive.Label>
  );
};

type ProgressValueTextProps = ArkProgressValueTextProps & {
  class?: string;
};

const ProgressValueText: Component<ProgressValueTextProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <ProgressPrimitive.ValueText
      class={cn('text-sm font-medium text-gray-600', local.class)}
      {...others}
    />
  );
};

// Circular progress components
const ProgressCircle = ProgressPrimitive.Circle;
const ProgressCircleTrack = ProgressPrimitive.CircleTrack;
const ProgressCircleRange = ProgressPrimitive.CircleRange;

export {
  Progress,
  ProgressTrack,
  ProgressRange,
  ProgressLabel,
  ProgressValueText,
  ProgressContext,
  ProgressCircle,
  ProgressCircleTrack,
  ProgressCircleRange,
};
