/**
 * Dialog component for modal overlays.
 *
 * @example
 * <Dialog>
 *   <DialogTrigger>
 *     <Button>Open Dialog</Button>
 *   </DialogTrigger>
 *   <DialogBackdrop />
 *   <DialogPositioner>
 *     <DialogContent>
 *       <DialogHeader>
 *         <DialogTitle>Confirm Action</DialogTitle>
 *         <DialogCloseTrigger>
 *           <FiX />
 *         </DialogCloseTrigger>
 *       </DialogHeader>
 *       <DialogBody>
 *         <DialogDescription>Are you sure you want to proceed?</DialogDescription>
 *       </DialogBody>
 *       <DialogFooter>
 *         <DialogCloseTrigger>
 *           <Button variant="outline">Cancel</Button>
 *         </DialogCloseTrigger>
 *         <Button>Confirm</Button>
 *       </DialogFooter>
 *     </DialogContent>
 *   </DialogPositioner>
 * </Dialog>
 *
 * @example
 * // Controlled dialog
 * const [open, setOpen] = createSignal(false);
 * <Dialog open={open()} onOpenChange={setOpen}>
 *   ...
 * </Dialog>
 */
import type { Component, ComponentProps, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Dialog as DialogPrimitive } from '@ark-ui/solid/dialog';
import type {
  DialogRootProps as ArkDialogRootProps,
  DialogBackdropProps as ArkDialogBackdropProps,
  DialogContentProps as ArkDialogContentProps,
  DialogTitleProps as ArkDialogTitleProps,
  DialogDescriptionProps as ArkDialogDescriptionProps,
  DialogCloseTriggerProps as ArkDialogCloseTriggerProps,
} from '@ark-ui/solid/dialog';
import { Portal } from 'solid-js/web';
import { cn } from './cn';
import { Z_INDEX } from './z-index';

type DialogProps = Omit<ArkDialogRootProps, 'onOpenChange'> & {
  children?: JSX.Element;
  onOpenChange?: (_open: boolean) => void;
};

const Dialog: Component<DialogProps> = props => {
  const [local, others] = splitProps(props, ['children', 'onOpenChange']);
  return (
    <DialogPrimitive.Root onOpenChange={details => local.onOpenChange?.(details.open)} {...others}>
      {local.children}
    </DialogPrimitive.Root>
  );
};

const DialogTrigger = DialogPrimitive.Trigger;

type DialogBackdropProps = ArkDialogBackdropProps & {
  class?: string;
};

const DialogBackdrop: Component<DialogBackdropProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Portal>
      <DialogPrimitive.Backdrop
        class={cn('fixed inset-0 bg-black/50', Z_INDEX.BACKDROP, local.class)}
        {...others}
      />
    </Portal>
  );
};

type DialogPositionerProps = ComponentProps<typeof DialogPrimitive.Positioner> & {
  class?: string;
  children?: JSX.Element;
};

const DialogPositioner: Component<DialogPositionerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <Portal>
      <DialogPrimitive.Positioner
        class={cn(
          'fixed inset-0 flex items-center justify-center overflow-y-auto p-4',
          Z_INDEX.DIALOG,
          local.class,
        )}
        {...others}
      >
        {local.children}
      </DialogPrimitive.Positioner>
    </Portal>
  );
};

type DialogContentProps = ArkDialogContentProps & {
  class?: string;
  children?: JSX.Element;
};

const DialogContent: Component<DialogContentProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <DialogPrimitive.Content
      class={cn(
        'my-auto w-full max-w-lg rounded-lg border border-gray-200 bg-white shadow-xl',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </DialogPrimitive.Content>
  );
};

type DialogTitleProps = ArkDialogTitleProps & {
  class?: string;
};

const DialogTitle: Component<DialogTitleProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <DialogPrimitive.Title
      class={cn('text-lg font-semibold text-gray-900', local.class)}
      {...others}
    />
  );
};

type DialogDescriptionProps = ArkDialogDescriptionProps & {
  class?: string;
};

const DialogDescription: Component<DialogDescriptionProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <DialogPrimitive.Description
      class={cn('mt-1 text-sm text-gray-500', local.class)}
      {...others}
    />
  );
};

type DialogCloseTriggerProps = ArkDialogCloseTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const DialogCloseTrigger: Component<DialogCloseTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <DialogPrimitive.CloseTrigger
      class={cn(
        'rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500',
        'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </DialogPrimitive.CloseTrigger>
  );
};

const DialogHeader: Component<ComponentProps<'div'>> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <div
      class={cn('flex items-center justify-between border-b border-gray-200 p-4', local.class)}
      {...others}
    />
  );
};

const DialogBody: Component<ComponentProps<'div'>> = props => {
  const [local, others] = splitProps(props, ['class']);
  return <div class={cn('p-4', local.class)} {...others} />;
};

const DialogFooter: Component<ComponentProps<'div'>> = props => {
  const [local, others] = splitProps(props, ['class']);
  return <div class={cn('flex justify-end gap-3 bg-gray-50 px-4 py-3', local.class)} {...others} />;
};

export {
  Dialog,
  DialogTrigger,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogCloseTrigger,
  DialogHeader,
  DialogBody,
  DialogFooter,
};
