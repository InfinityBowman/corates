/**
 * Steps component for multi-step wizards and progress indicators.
 *
 * @example
 * <Steps count={3} defaultStep={0}>
 *   <StepsList>
 *     <StepsItem index={0}>
 *       <StepsTrigger>
 *         <StepsIndicator>1</StepsIndicator>
 *       </StepsTrigger>
 *       <StepsSeparator />
 *     </StepsItem>
 *     <StepsItem index={1}>
 *       <StepsTrigger>
 *         <StepsIndicator>2</StepsIndicator>
 *       </StepsTrigger>
 *       <StepsSeparator />
 *     </StepsItem>
 *     <StepsItem index={2}>
 *       <StepsTrigger>
 *         <StepsIndicator>3</StepsIndicator>
 *       </StepsTrigger>
 *     </StepsItem>
 *   </StepsList>
 *
 *   <StepsContent index={0}>Step 1 content</StepsContent>
 *   <StepsContent index={1}>Step 2 content</StepsContent>
 *   <StepsContent index={2}>Step 3 content</StepsContent>
 *   <StepsCompletedContent>All done!</StepsCompletedContent>
 *
 *   <StepsPrevTrigger>Previous</StepsPrevTrigger>
 *   <StepsNextTrigger>Next</StepsNextTrigger>
 * </Steps>
 *
 * @example
 * // Controlled
 * const [step, setStep] = createSignal(0);
 * <Steps step={step()} onStepChange={details => setStep(details.step)}>
 *   ...
 * </Steps>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Steps as StepsPrimitive } from '@ark-ui/solid/steps';
import type {
  StepsRootProps as ArkStepsRootProps,
  StepsListProps as ArkStepsListProps,
  StepsItemProps as ArkStepsItemProps,
  StepsTriggerProps as ArkStepsTriggerProps,
  StepsIndicatorProps as ArkStepsIndicatorProps,
  StepsSeparatorProps as ArkStepsSeparatorProps,
  StepsContentProps as ArkStepsContentProps,
  StepsCompletedContentProps as ArkStepsCompletedContentProps,
  StepsNextTriggerProps as ArkStepsNextTriggerProps,
  StepsPrevTriggerProps as ArkStepsPrevTriggerProps,
} from '@ark-ui/solid/steps';
import { cn } from './cn';

type StepsProps = ArkStepsRootProps & {
  class?: string;
  children?: JSX.Element;
};

const Steps: Component<StepsProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <StepsPrimitive.Root class={local.class} {...others}>
      {local.children}
    </StepsPrimitive.Root>
  );
};

type StepsListProps = ArkStepsListProps & {
  class?: string;
  children?: JSX.Element;
};

const StepsList: Component<StepsListProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <StepsPrimitive.List class={cn('flex items-center gap-2', local.class)} {...others}>
      {local.children}
    </StepsPrimitive.List>
  );
};

type StepsItemProps = ArkStepsItemProps & {
  class?: string;
  children?: JSX.Element;
};

const StepsItem: Component<StepsItemProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <StepsPrimitive.Item class={cn('flex items-center gap-2', local.class)} {...others}>
      {local.children}
    </StepsPrimitive.Item>
  );
};

type StepsTriggerProps = ArkStepsTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const StepsTrigger: Component<StepsTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <StepsPrimitive.Trigger class={local.class} {...others}>
      {local.children}
    </StepsPrimitive.Trigger>
  );
};

type StepsIndicatorProps = ArkStepsIndicatorProps & {
  class?: string;
  children?: JSX.Element;
};

const StepsIndicator: Component<StepsIndicatorProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <StepsPrimitive.Indicator class={local.class} {...others}>
      {local.children}
    </StepsPrimitive.Indicator>
  );
};

type StepsSeparatorProps = ArkStepsSeparatorProps & {
  class?: string;
};

const StepsSeparator: Component<StepsSeparatorProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <StepsPrimitive.Separator
      class={cn('h-0.5 flex-1 bg-gray-200', 'data-[complete]:bg-blue-600', local.class)}
      {...others}
    />
  );
};

type StepsContentProps = ArkStepsContentProps & {
  class?: string;
  children?: JSX.Element;
};

const StepsContent: Component<StepsContentProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <StepsPrimitive.Content class={local.class} {...others}>
      {local.children}
    </StepsPrimitive.Content>
  );
};

type StepsCompletedContentProps = ArkStepsCompletedContentProps & {
  class?: string;
  children?: JSX.Element;
};

const StepsCompletedContent: Component<StepsCompletedContentProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <StepsPrimitive.CompletedContent class={local.class} {...others}>
      {local.children}
    </StepsPrimitive.CompletedContent>
  );
};

type StepsNextTriggerProps = ArkStepsNextTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const StepsNextTrigger: Component<StepsNextTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <StepsPrimitive.NextTrigger class={local.class} {...others}>
      {local.children}
    </StepsPrimitive.NextTrigger>
  );
};

type StepsPrevTriggerProps = ArkStepsPrevTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const StepsPrevTrigger: Component<StepsPrevTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <StepsPrimitive.PrevTrigger class={local.class} {...others}>
      {local.children}
    </StepsPrimitive.PrevTrigger>
  );
};

export {
  Steps,
  StepsList,
  StepsItem,
  StepsTrigger,
  StepsIndicator,
  StepsSeparator,
  StepsContent,
  StepsCompletedContent,
  StepsNextTrigger,
  StepsPrevTrigger,
};
