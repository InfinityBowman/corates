/**
 * AlertDialog component for confirmation dialogs requiring user action.
 *
 * @example
 * const [open, setOpen] = createSignal(false);
 *
 * <AlertDialog open={open()} onOpenChange={setOpen}>
 *   <AlertDialogBackdrop />
 *   <AlertDialogPositioner>
 *     <AlertDialogContent>
 *       <AlertDialogHeader>
 *         <AlertDialogIcon variant="danger" />
 *         <div>
 *           <AlertDialogTitle>Delete Project</AlertDialogTitle>
 *           <AlertDialogDescription>
 *             This action cannot be undone.
 *           </AlertDialogDescription>
 *         </div>
 *       </AlertDialogHeader>
 *       <AlertDialogFooter>
 *         <AlertDialogCancel>Cancel</AlertDialogCancel>
 *         <AlertDialogAction variant="danger" onClick={handleDelete}>
 *           Delete
 *         </AlertDialogAction>
 *       </AlertDialogFooter>
 *     </AlertDialogContent>
 *   </AlertDialogPositioner>
 * </AlertDialog>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Dialog as DialogPrimitive } from '@ark-ui/solid/dialog';
import type { DialogRootProps as ArkDialogRootProps } from '@ark-ui/solid/dialog';
import { Portal } from 'solid-js/web';
import { FiAlertTriangle, FiX } from 'solid-icons/fi';
import { cn } from './cn';
import { Z_INDEX } from './z-index';

type AlertDialogProps = Omit<ArkDialogRootProps, 'onOpenChange'> & {
  children?: JSX.Element;
  onOpenChange?: (open: boolean) => void;
};

const AlertDialog: Component<AlertDialogProps> = props => {
  const [local, others] = splitProps(props, ['children', 'onOpenChange']);
  return (
    <DialogPrimitive.Root
      role='alertdialog'
      onOpenChange={details => local.onOpenChange?.(details.open)}
      {...others}
    >
      {local.children}
    </DialogPrimitive.Root>
  );
};

type AlertDialogBackdropProps = {
  class?: string;
};

const AlertDialogBackdrop: Component<AlertDialogBackdropProps> = props => {
  return (
    <Portal>
      <DialogPrimitive.Backdrop
        class={cn('fixed inset-0 bg-black/50 transition-opacity', Z_INDEX.BACKDROP, props.class)}
      />
    </Portal>
  );
};

type AlertDialogPositionerProps = {
  class?: string;
  children?: JSX.Element;
};

const AlertDialogPositioner: Component<AlertDialogPositionerProps> = props => {
  return (
    <Portal>
      <DialogPrimitive.Positioner
        class={cn(
          'fixed inset-0 flex items-center justify-center p-4',
          Z_INDEX.DIALOG,
          props.class,
        )}
      >
        {props.children}
      </DialogPrimitive.Positioner>
    </Portal>
  );
};

type AlertDialogContentProps = {
  class?: string;
  children?: JSX.Element;
};

const AlertDialogContent: Component<AlertDialogContentProps> = props => {
  return (
    <DialogPrimitive.Content
      class={cn('w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl', props.class)}
    >
      {props.children}
    </DialogPrimitive.Content>
  );
};

type AlertDialogHeaderProps = {
  class?: string;
  children?: JSX.Element;
};

const AlertDialogHeader: Component<AlertDialogHeaderProps> = props => {
  return <div class={cn('flex items-start gap-4 p-6', props.class)}>{props.children}</div>;
};

type AlertDialogIconProps = {
  class?: string;
  variant?: 'danger' | 'warning' | 'info';
};

const AlertDialogIcon: Component<AlertDialogIconProps> = props => {
  const variant = () => props.variant || 'danger';

  const variantStyles = () => {
    switch (variant()) {
      case 'warning':
        return 'bg-amber-100 text-amber-500';
      case 'info':
        return 'bg-blue-100 text-blue-500';
      default:
        return 'bg-red-100 text-red-500';
    }
  };

  return (
    <div class={cn('shrink-0 rounded-full p-2', variantStyles(), props.class)}>
      <FiAlertTriangle class='h-6 w-6' />
    </div>
  );
};

type AlertDialogTitleProps = {
  class?: string;
  children?: JSX.Element;
};

const AlertDialogTitle: Component<AlertDialogTitleProps> = props => {
  return (
    <DialogPrimitive.Title class={cn('text-lg font-semibold text-gray-900', props.class)}>
      {props.children}
    </DialogPrimitive.Title>
  );
};

type AlertDialogDescriptionProps = {
  class?: string;
  children?: JSX.Element;
};

const AlertDialogDescription: Component<AlertDialogDescriptionProps> = props => {
  return (
    <DialogPrimitive.Description class={cn('mt-2 text-sm text-gray-600', props.class)}>
      {props.children}
    </DialogPrimitive.Description>
  );
};

type AlertDialogFooterProps = {
  class?: string;
  children?: JSX.Element;
};

const AlertDialogFooter: Component<AlertDialogFooterProps> = props => {
  return (
    <div class={cn('flex justify-end gap-3 bg-gray-50 px-6 py-4', props.class)}>
      {props.children}
    </div>
  );
};

type AlertDialogCancelProps = {
  class?: string;
  children?: JSX.Element;
  disabled?: boolean;
  onClick?: () => void;
};

const AlertDialogCancel: Component<AlertDialogCancelProps> = props => {
  return (
    <DialogPrimitive.CloseTrigger
      disabled={props.disabled}
      onClick={props.onClick}
      class={cn(
        'rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700',
        'transition-colors hover:bg-gray-50',
        'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
        'disabled:opacity-50',
        props.class,
      )}
    >
      {props.children}
    </DialogPrimitive.CloseTrigger>
  );
};

type AlertDialogActionProps = {
  class?: string;
  children?: JSX.Element;
  disabled?: boolean;
  variant?: 'danger' | 'warning' | 'info';
  onClick?: () => void;
};

const AlertDialogAction: Component<AlertDialogActionProps> = props => {
  const variant = () => props.variant || 'danger';

  const variantStyles = () => {
    switch (variant()) {
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500';
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
      default:
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
    }
  };

  return (
    <button
      type='button'
      disabled={props.disabled}
      onClick={props.onClick}
      class={cn(
        'rounded-md px-4 py-2 text-sm font-medium text-white',
        'transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none',
        'disabled:opacity-50',
        variantStyles(),
        props.class,
      )}
    >
      {props.children}
    </button>
  );
};

type AlertDialogCloseTriggerProps = {
  class?: string;
  disabled?: boolean;
};

const AlertDialogCloseTrigger: Component<AlertDialogCloseTriggerProps> = props => {
  return (
    <DialogPrimitive.CloseTrigger
      disabled={props.disabled}
      class={cn(
        'shrink-0 rounded-md p-1 text-gray-400',
        'transition-colors hover:bg-gray-100 hover:text-gray-500',
        'disabled:opacity-50',
        props.class,
      )}
    >
      <FiX class='h-5 w-5' />
    </DialogPrimitive.CloseTrigger>
  );
};

export {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogPositioner,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogCloseTrigger,
};
