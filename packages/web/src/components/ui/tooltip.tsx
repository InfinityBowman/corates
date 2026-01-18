/**
 * Tooltip component for contextual information on hover.
 * Arrow is shown by default. Use showArrow={false} to hide it.
 *
 * @example
 * <Tooltip>
 *   <TooltipTrigger>
 *     <Button variant="ghost" size="icon"><FiInfo /></Button>
 *   </TooltipTrigger>
 *   <TooltipPositioner>
 *     <TooltipContent>
 *       This is helpful information
 *     </TooltipContent>
 *   </TooltipPositioner>
 * </Tooltip>
 *
 * @example
 * // Without arrow
 * <Tooltip>
 *   <TooltipTrigger>Hover me</TooltipTrigger>
 *   <TooltipPositioner>
 *     <TooltipContent showArrow={false}>
 *       Tooltip without arrow
 *     </TooltipContent>
 *   </TooltipPositioner>
 * </Tooltip>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Tooltip as TooltipPrimitive } from '@ark-ui/solid/tooltip';
import type {
  TooltipContentProps as ArkTooltipContentProps,
  TooltipTriggerProps as ArkTooltipTriggerProps,
  TooltipArrowProps as ArkTooltipArrowProps,
  TooltipArrowTipProps as ArkTooltipArrowTipProps,
} from '@ark-ui/solid/tooltip';
import { Portal } from 'solid-js/web';
import { cn } from './cn';
import { Z_INDEX } from './z-index';

const Tooltip = TooltipPrimitive.Root;

type TooltipTriggerProps = ArkTooltipTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const TooltipTrigger: Component<TooltipTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <TooltipPrimitive.Trigger class={local.class} {...others}>
      {local.children}
    </TooltipPrimitive.Trigger>
  );
};

type TooltipPositionerProps = {
  class?: string;
  children?: JSX.Element;
};

const TooltipPositioner: Component<TooltipPositionerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <Portal>
      <TooltipPrimitive.Positioner class={local.class} {...others}>
        {local.children}
      </TooltipPrimitive.Positioner>
    </Portal>
  );
};

type TooltipContentProps = ArkTooltipContentProps & {
  class?: string;
  children?: JSX.Element;
  showArrow?: boolean;
};

const TooltipContent: Component<TooltipContentProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children', 'showArrow']);
  const showArrow = () => local.showArrow !== false;
  return (
    <TooltipPrimitive.Content
      class={cn(
        'max-w-xs rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white shadow-md',
        Z_INDEX.TOOLTIP,
        local.class,
      )}
      style={{ '--arrow-size': '8px', '--arrow-background': '#111827' }}
      {...others}
    >
      {showArrow() && (
        <TooltipPrimitive.Arrow>
          <TooltipPrimitive.ArrowTip class='bg-gray-900' />
        </TooltipPrimitive.Arrow>
      )}
      {local.children}
    </TooltipPrimitive.Content>
  );
};

type TooltipArrowProps = ArkTooltipArrowProps & {
  class?: string;
};

const TooltipArrow: Component<TooltipArrowProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return <TooltipPrimitive.Arrow class={local.class} {...others} />;
};

type TooltipArrowTipProps = ArkTooltipArrowTipProps & {
  class?: string;
};

const TooltipArrowTip: Component<TooltipArrowTipProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <TooltipPrimitive.ArrowTip
      class={cn('border-t border-l border-gray-900', local.class)}
      {...others}
    />
  );
};

export {
  Tooltip,
  TooltipTrigger,
  TooltipPositioner,
  TooltipContent,
  TooltipArrow,
  TooltipArrowTip,
};
