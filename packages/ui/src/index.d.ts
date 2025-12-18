import { Component, JSX } from 'solid-js';

// Editable
export interface EditableProps {
  value?: string;
  onSubmit?: (_value: string) => void;
  activationMode?: 'focus' | 'dblclick' | 'click' | 'none';
  variant?: 'default' | 'heading' | 'inline' | 'field';
  showEditIcon?: boolean;
  readOnly?: boolean;
  class?: string;
  placeholder?: string;
}
export const Editable: Component<EditableProps>;

// Collapsible
export interface CollapsibleProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (_open: boolean) => void;
  disabled?: boolean;
  trigger?: (_api: { open: boolean }) => JSX.Element;
  children?: JSX.Element;
}
export const Collapsible: Component<CollapsibleProps>;

// Menu
export interface MenuItem {
  value: string;
  label: string;
  icon?: JSX.Element;
  destructive?: boolean;
  separator?: boolean;
}
export interface MenuProps {
  trigger: JSX.Element;
  items: MenuItem[];
  onSelect?: (_details: { value: string }) => void;
  placement?: string;
  hideIndicator?: boolean;
}
export const Menu: Component<MenuProps>;

// Dialog
export interface DialogProps {
  open?: boolean;
  onOpenChange?: (_open: boolean) => void;
  title?: string;
  description?: string;
  children?: JSX.Element;
}
export const Dialog: Component<DialogProps>;

export interface ConfirmDialogProps {
  open?: boolean;
  onOpenChange?: (_open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  destructive?: boolean;
}
export const ConfirmDialog: Component<ConfirmDialogProps>;
export function useConfirmDialog(): {
  open: () => boolean;
  setOpen: (_open: boolean) => void;
  confirm: () => Promise<boolean>;
};

// Select
export interface SelectOption {
  value: string;
  label: string;
}
export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (_value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}
export const Select: Component<SelectProps>;

// Tooltip
export interface TooltipProps {
  content: string | JSX.Element;
  children: JSX.Element;
  placement?: string;
}
export const Tooltip: Component<TooltipProps>;

// Toast
export interface ToastOptions {
  title?: string;
  description?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}
export const Toaster: Component;
export const toaster: {
  create: (_options: ToastOptions) => void;
  success: (_options: ToastOptions) => void;
  error: (_options: ToastOptions) => void;
  warning: (_options: ToastOptions) => void;
  info: (_options: ToastOptions) => void;
};
export function showToast(_options: ToastOptions): void;

// Primitives
export function useWindowDrag(_options?: { onDragEnd?: () => void }): {
  isDragging: () => boolean;
};

// Utilities
export function cn(..._classes: (string | undefined | null | false)[]): string;

// Re-export other components (add types as needed)
export const Accordion: Component<any>;
export const Avatar: Component<any>;
export const Checkbox: Component<any>;
export const Clipboard: Component<any>;
export const CopyButton: Component<any>;
export const Combobox: Component<any>;
export const FileUpload: Component<any>;
export const FloatingPanel: Component<any>;
export const NumberInput: Component<any>;
export const PasswordInput: Component<any>;
export const PinInput: Component<any>;
export const Popover: Component<any>;
export const Progress: Component<any>;
export const QRCode: Component<any>;
export const RadioGroup: Component<any>;
export const Splitter: Component<any>;
export const Switch: Component<any>;
export const Tabs: Component<any>;
export const TagsInput: Component<any>;
export const ToggleGroup: Component<any>;
export const Tour: Component<any>;
export const TourProvider: Component<any>;
export function useTour(): any;
