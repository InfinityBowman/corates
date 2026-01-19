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
        'border-border bg-card my-auto w-full max-w-lg rounded-lg border shadow-xl',
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
      class={cn('text-foreground text-lg font-semibold', local.class)}
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
      class={cn('text-muted-foreground mt-1 text-sm', local.class)}
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
        'text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1 transition-colors',
        'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
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
      class={cn('border-border flex items-center justify-between border-b p-4', local.class)}
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
  return <div class={cn('bg-muted flex justify-end gap-3 px-4 py-3', local.class)} {...others} />;
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
