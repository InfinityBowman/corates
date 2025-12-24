import { Component, JSX, Accessor } from 'solid-js';

// ============================================================================
// Common Types
// ============================================================================

export type Placement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';

// ============================================================================
// Accordion
// ============================================================================

export interface AccordionItem {
  value: string;
  title: JSX.Element;
  content: JSX.Element;
  disabled?: boolean;
}

export interface AccordionProps {
  /** Accordion items */
  items: AccordionItem[];
  /** Initially expanded items */
  defaultValue?: string[];
  /** Controlled expanded items */
  value?: string[];
  /** Callback when expanded items change */
  onValueChange?: (_details: { value: string[] }) => void;
  /** Allow multiple items expanded (default: false) */
  multiple?: boolean;
  /** Allow collapsing all items (default: true) */
  collapsible?: boolean;
  /** Disable all items */
  disabled?: boolean;
  /** Orientation (default: 'vertical') */
  orientation?: 'horizontal' | 'vertical';
  /** Additional class for root element */
  class?: string;
}

export const Accordion: Component<AccordionProps>;

// ============================================================================
// Avatar
// ============================================================================

export interface AvatarProps {
  /** Image source URL */
  src?: string;
  /** Display name for initials fallback */
  name?: string;
  /** Alt text for image */
  alt?: string;
  /** Callback when image load status changes */
  onStatusChange?: (_details: { status: 'loading' | 'loaded' | 'error' }) => void;
  /** Additional class for root element */
  class?: string;
  /** Additional class for fallback element */
  fallbackClass?: string;
}

export const Avatar: Component<AvatarProps>;

// ============================================================================
// Checkbox
// ============================================================================

export interface CheckboxProps {
  /** Controlled checked state */
  checked?: boolean;
  /** Default checked state (uncontrolled) */
  defaultChecked?: boolean;
  /** Whether checkbox is in indeterminate state */
  indeterminate?: boolean;
  /** Whether checkbox is disabled */
  disabled?: boolean;
  /** Name for form submission */
  name?: string;
  /** Value for form submission */
  value?: string;
  /** Label text */
  label?: string;
  /** Callback when checked state changes */
  onChange?: (_checked: boolean) => void;
  /** Additional CSS classes */
  class?: string;
}

export const Checkbox: Component<CheckboxProps>;

// ============================================================================
// Clipboard
// ============================================================================

export interface ClipboardApi {
  /** Current value */
  value: string;
  /** Whether content was copied */
  copied: boolean;
  /** Copy to clipboard */
  copy: () => void;
  /** Get root props */
  getRootProps: () => JSX.HTMLAttributes<HTMLDivElement>;
  /** Get label props */
  getLabelProps: () => JSX.HTMLAttributes<HTMLLabelElement>;
  /** Get control props */
  getControlProps: () => JSX.HTMLAttributes<HTMLDivElement>;
  /** Get input props */
  getInputProps: () => JSX.HTMLAttributes<HTMLInputElement>;
  /** Get trigger props */
  getTriggerProps: () => JSX.HTMLAttributes<HTMLButtonElement>;
}

export interface ClipboardProps {
  /** Value to copy to clipboard */
  value?: string;
  /** Initial value to copy */
  defaultValue?: string;
  /** Callback when value changes */
  onValueChange?: (_details: { value: string }) => void;
  /** Callback when copy status changes */
  onStatusChange?: (_details: { copied: boolean }) => void;
  /** Time in ms before resetting copied state (default: 3000) */
  timeout?: number;
  /** Label for the input */
  label?: string;
  /** Show input field (default: true) */
  showInput?: boolean;
  /** Render function for custom UI */
  children?: (_api: Accessor<ClipboardApi>) => JSX.Element;
  /** Additional class for root element */
  class?: string;
}

export const Clipboard: Component<ClipboardProps>;

// ============================================================================
// CopyButton
// ============================================================================

export interface CopyButtonProps {
  /** Value to copy */
  value: string;
  /** Callback when copy status changes */
  onStatusChange?: (_details: { copied: boolean }) => void;
  /** Time in ms before resetting (default: 3000) */
  timeout?: number;
  /** Button label (default: 'Copy') */
  label?: string;
  /** Label when copied (default: 'Copied!') */
  copiedLabel?: string;
  /** Button size (default: 'md') */
  size?: 'sm' | 'md' | 'lg';
  /** Button variant (default: 'solid') */
  variant?: 'solid' | 'outline' | 'ghost';
  /** Show copy/check icon (default: true) */
  showIcon?: boolean;
  /** Show text label (default: true) */
  showLabel?: boolean;
  /** Additional class for button */
  class?: string;
}

export const CopyButton: Component<CopyButtonProps>;

// ============================================================================
// Collapsible
// ============================================================================

export interface CollapsibleApi {
  open: boolean;
  visible: boolean;
  setOpen: (_open: boolean) => void;
}

export interface CollapsibleProps {
  /** Controlled open state */
  open?: boolean;
  /** Initial open state (uncontrolled) */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_details: { open: boolean }) => void;
  /** Disable the collapsible */
  disabled?: boolean;
  /** Enable lazy mounting */
  lazyMount?: boolean;
  /** Unmount content when closed */
  unmountOnExit?: boolean;
  /** Height when collapsed */
  collapsedHeight?: string | number;
  /** Width when collapsed */
  collapsedWidth?: string | number;
  /** Callback when exit animation completes */
  onExitComplete?: () => void;
  /** Custom IDs for root, content, trigger */
  ids?: { root?: string; content?: string; trigger?: string };
  /** Trigger element or render function receiving collapsible API */
  trigger?: JSX.Element | ((_api: CollapsibleApi) => JSX.Element);
  /** Indicator element or render function receiving collapsible API */
  indicator?: JSX.Element | ((_api: CollapsibleApi) => JSX.Element);
  /** Collapsible content */
  children?: JSX.Element;
}

export const Collapsible: Component<CollapsibleProps> & {
  Root: Component<any>;
  Trigger: Component<any>;
  Content: Component<any>;
  Indicator: Component<any>;
  RootProvider: Component<any>;
};

export function useCollapsible(_props?: any): Accessor<CollapsibleApi>;

// ============================================================================
// Combobox
// ============================================================================

export interface ComboboxItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  /** Available items */
  items: ComboboxItem[];
  /** Input label */
  label?: string;
  /** Input placeholder */
  placeholder?: string;
  /** Controlled selected values */
  value?: string[];
  /** Initial selected values */
  defaultValue?: string[];
  /** Callback when selection changes */
  onValueChange?: (_details: { value: string[]; items: ComboboxItem[] }) => void;
  /** Callback when input changes */
  onInputValueChange?: (_details: { inputValue: string }) => void;
  /** Allow multiple selections (default: false) */
  multiple?: boolean;
  /** Disable the combobox */
  disabled?: boolean;
  /** Make combobox read-only */
  readOnly?: boolean;
  /** Mark as invalid */
  invalid?: boolean;
  /** Form field name */
  name?: string;
  /** Allow custom values not in the list */
  allowCustomValue?: boolean;
  /** Close on selection (default: true for single, false for multiple) */
  closeOnSelect?: boolean;
  /** Open on input click (default: true) */
  openOnClick?: boolean;
  /** Set to true when used inside a Dialog */
  inDialog?: boolean;
  /** Additional class for root element */
  class?: string;
  /** Additional class for input element */
  inputClass?: string;
}

export const Combobox: Component<ComboboxProps>;

// ============================================================================
// Dialog
// ============================================================================

export interface DialogProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_open: boolean) => void;
  /** Dialog title */
  title?: string;
  /** Dialog description */
  description?: string;
  /** Dialog content */
  children?: JSX.Element;
}

export const Dialog: Component<DialogProps>;

export interface ConfirmDialogProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_open: boolean) => void;
  /** Dialog title */
  title?: string;
  /** Dialog description */
  description?: string;
  /** Confirm button label */
  confirmLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Callback when confirmed */
  onConfirm?: () => void;
  /** Callback when cancelled */
  onCancel?: () => void;
  /** Use destructive styling */
  destructive?: boolean;
}

export const ConfirmDialog: Component<ConfirmDialogProps>;

export function useConfirmDialog(): {
  open: () => boolean;
  setOpen: (_open: boolean) => void;
  confirm: () => Promise<boolean>;
};

// ============================================================================
// Drawer
// ============================================================================

export interface DrawerProps {
  /** Whether the drawer is open */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_open: boolean) => void;
  /** Drawer title */
  title?: string;
  /** Optional description below title */
  description?: string;
  /** Drawer content */
  children?: JSX.Element;
  /** Which side the drawer slides in from (default: 'right') */
  side?: 'left' | 'right';
  /** Drawer width (default: 'md') */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether to show the header (default: true) */
  showHeader?: boolean;
  /** Close when clicking backdrop (default: true) */
  closeOnOutsideClick?: boolean;
  /** Whether to show the dark overlay backdrop (default: true) */
  showBackdrop?: boolean;
}

export const Drawer: Component<DrawerProps>;

// ============================================================================
// Editable
// ============================================================================

export interface EditableProps {
  /** Current value */
  value?: string;
  /** Callback when value is submitted */
  onSubmit?: (_value: string) => void;
  /** How to activate edit mode */
  activationMode?: 'focus' | 'dblclick' | 'click' | 'none';
  /** Style variant */
  variant?: 'default' | 'heading' | 'inline' | 'field';
  /** Show edit icon */
  showEditIcon?: boolean;
  /** Make read-only */
  readOnly?: boolean;
  /** Additional CSS class */
  class?: string;
  /** Placeholder text */
  placeholder?: string;
}

export const Editable: Component<EditableProps>;

// ============================================================================
// FileUpload
// ============================================================================

export interface FileUploadProps {
  /** Accepted file types (e.g., 'application/pdf') */
  accept?: string;
  /** Allow multiple file selection (default: false) */
  multiple?: boolean;
  /** Callback when files change */
  onFilesChange?: (_files: File[]) => void;
  /** Callback when files are accepted */
  onFileAccept?: (_details: { files: File[] }) => void;
  /** Custom text for the dropzone */
  dropzoneText?: string;
  /** Custom text for the trigger button */
  buttonText?: string;
  /** Helper text below the dropzone text */
  helpText?: string;
  /** Whether to show the list of uploaded files (default: true) */
  showFileList?: boolean;
  /** Additional CSS classes for the root element */
  class?: string;
  /** Additional CSS classes for the dropzone */
  dropzoneClass?: string;
  /** Disable the file upload */
  disabled?: boolean;
  /** Use compact/minimal styling */
  compact?: boolean;
  /** Allow dropping directories (default: true for multiple) */
  allowDirectories?: boolean;
}

export const FileUpload: Component<FileUploadProps>;

// ============================================================================
// FloatingPanel
// ============================================================================

export interface FloatingPanelSize {
  width: number;
  height: number;
}

export interface FloatingPanelPosition {
  x: number;
  y: number;
}

export interface FloatingPanelProps {
  /** Whether the panel is open (controlled) */
  open?: boolean;
  /** Initial open state (uncontrolled) */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_details: { open: boolean }) => void;
  /** Panel title */
  title?: string;
  /** Panel content */
  children?: JSX.Element;
  /** Initial size */
  defaultSize?: FloatingPanelSize;
  /** Initial position */
  defaultPosition?: FloatingPanelPosition;
  /** Controlled size */
  size?: FloatingPanelSize;
  /** Controlled position */
  position?: FloatingPanelPosition;
  /** Callback when size changes */
  onSizeChange?: (_details: { size: FloatingPanelSize }) => void;
  /** Callback when position changes */
  onPositionChange?: (_details: { position: FloatingPanelPosition }) => void;
  /** Callback when stage changes */
  onStageChange?: (_details: { stage: 'minimized' | 'maximized' | 'default' }) => void;
  /** Whether the panel can be resized (default: true) */
  resizable?: boolean;
  /** Whether the panel can be dragged (default: true) */
  draggable?: boolean;
  /** Minimum size constraints */
  minSize?: FloatingPanelSize;
  /** Maximum size constraints */
  maxSize?: FloatingPanelSize;
  /** Lock aspect ratio when resizing */
  lockAspectRatio?: boolean;
  /** Show all control buttons (default: true) */
  showControls?: boolean;
  /** Show minimize button (default: true, requires showControls) */
  showMinimize?: boolean;
  /** Show maximize button (default: true, requires showControls) */
  showMaximize?: boolean;
  /** Show restore button (default: true, requires showControls) */
  showRestore?: boolean;
  /** Show close button (default: true, requires showControls) */
  showClose?: boolean;
  /** Close panel on Escape key (default: true) */
  closeOnEscape?: boolean;
  /** Persist size/position when closed (default: false) */
  persistRect?: boolean;
}

export const FloatingPanel: Component<FloatingPanelProps>;

// ============================================================================
// Menu
// ============================================================================

export interface MenuItem {
  value: string;
  label: string;
  icon?: JSX.Element;
  destructive?: boolean;
  separator?: boolean;
}

export interface MenuProps {
  /** Trigger element */
  trigger: JSX.Element;
  /** Menu items */
  items: MenuItem[];
  /** Callback when item is selected */
  onSelect?: (_details: { value: string }) => void;
  /** Menu placement */
  placement?: Placement;
  /** Hide the indicator arrow */
  hideIndicator?: boolean;
}

export const Menu: Component<MenuProps>;

// ============================================================================
// NumberInput
// ============================================================================

export interface NumberInputProps {
  /** Input label */
  label?: string;
  /** Controlled value (as string for formatting) */
  value?: string;
  /** Initial value */
  defaultValue?: string;
  /** Callback when value changes */
  onValueChange?: (_details: { value: string; valueAsNumber: number }) => void;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Increment/decrement step (default: 1) */
  step?: number;
  /** Disable the input */
  disabled?: boolean;
  /** Make input read-only */
  readOnly?: boolean;
  /** Mark as invalid */
  invalid?: boolean;
  /** Mark as required */
  required?: boolean;
  /** Form field name */
  name?: string;
  /** Input placeholder */
  placeholder?: string;
  /** Allow mouse wheel to change value (default: false) */
  allowMouseWheel?: boolean;
  /** Clamp value to min/max on blur (default: true) */
  clampValueOnBlur?: boolean;
  /** Spin on button press and hold (default: true) */
  spinOnPress?: boolean;
  /** Number format options */
  formatOptions?: Intl.NumberFormatOptions;
  /** Show increment/decrement buttons (default: true) */
  showControls?: boolean;
  /** Input size (default: 'md') */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class for root element */
  class?: string;
  /** Additional class for input element */
  inputClass?: string;
}

export const NumberInput: Component<NumberInputProps>;

// ============================================================================
// PasswordInput
// ============================================================================

export interface PasswordInputProps {
  /** Current password value */
  password?: string;
  /** Callback when password changes */
  onPasswordChange?: (_value: string) => void;
  /** Input label */
  label?: string;
  /** Autocomplete attribute */
  autoComplete?: string;
  /** Mark as required */
  required?: boolean;
  /** Additional class for root element */
  class?: string;
  /** Additional class for input element */
  inputClass?: string;
  /** Size of the visibility toggle icon */
  iconSize?: number;
}

export const PasswordInput: Component<PasswordInputProps>;

// ============================================================================
// PinInput
// ============================================================================

export interface PinInputProps {
  /** Callback when value changes */
  onInput?: (_value: string) => void;
  /** Callback when all digits are entered */
  onComplete?: (_value: string) => void;
  /** Mark as required (default: true) */
  required?: boolean;
  /** Enable OTP mode (default: true) */
  otp?: boolean;
  /** Autocomplete attribute (default: 'one-time-code') */
  autoComplete?: string;
  /** Show error styling */
  isError?: boolean;
}

export const PinInput: Component<PinInputProps>;

// ============================================================================
// Popover
// ============================================================================

export interface PopoverProps {
  /** The trigger element */
  trigger: JSX.Element;
  /** Popover content */
  children?: JSX.Element;
  /** Optional popover title */
  title?: string;
  /** Optional popover description */
  description?: string;
  /** Controlled open state */
  open?: boolean;
  /** Initial open state */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_details: { open: boolean }) => void;
  /** Popover placement (default: 'bottom') */
  placement?: Placement;
  /** Whether to trap focus (default: false) */
  modal?: boolean;
  /** Close on outside click (default: true) */
  closeOnInteractOutside?: boolean;
  /** Close on escape key (default: true) */
  closeOnEscape?: boolean;
  /** Show arrow pointing to trigger (default: false) */
  showArrow?: boolean;
  /** Show close button in header (default: true) */
  showCloseButton?: boolean;
  /** Set to true when used inside a Dialog */
  inDialog?: boolean;
  /** Additional class for content */
  class?: string;
}

export const Popover: Component<PopoverProps>;

// ============================================================================
// Progress
// ============================================================================

export interface ProgressProps {
  /** Current progress value */
  value?: number;
  /** Minimum value (default: 0) */
  min?: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Accessible label */
  label?: string;
  /** Show percentage value (default: false) */
  showValue?: boolean;
  /** Bar height (default: 'md') */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant (default: 'default') */
  variant?: 'default' | 'success' | 'warning' | 'error';
  /** Show indeterminate animation */
  indeterminate?: boolean;
  /** Additional class for root element */
  class?: string;
}

export const Progress: Component<ProgressProps>;

// ============================================================================
// QRCode
// ============================================================================

export interface QRCodeProps {
  /** The data to encode in the QR code (e.g., URL, text) */
  data: string;
  /** Size of the QR code in pixels (default: 200) */
  size?: number;
  /** Additional CSS classes */
  class?: string;
  /** Alt text for accessibility (default: 'QR Code') */
  alt?: string;
  /** Error correction level (L=7%, M=15%, Q=25%, H=30%) (default: 'M') */
  ecc?: 'L' | 'M' | 'Q' | 'H';
}

export const QRCode: Component<QRCodeProps>;

// ============================================================================
// RadioGroup
// ============================================================================

export interface RadioGroupItem {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Radio items */
  items: RadioGroupItem[];
  /** Group label */
  label?: string;
  /** Controlled selected value */
  value?: string;
  /** Initial selected value */
  defaultValue?: string;
  /** Callback when selection changes */
  onValueChange?: (_details: { value: string }) => void;
  /** Form field name */
  name?: string;
  /** Disable all items */
  disabled?: boolean;
  /** Layout orientation (default: 'vertical') */
  orientation?: 'horizontal' | 'vertical';
  /** Additional class for root element */
  class?: string;
}

export const RadioGroup: Component<RadioGroupProps>;

// ============================================================================
// Select
// ============================================================================

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  /** Available options */
  options: SelectOption[];
  /** Controlled selected value */
  value?: string;
  /** Callback when selection changes */
  onChange?: (_value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disable the select */
  disabled?: boolean;
  /** Set to true when used inside a Dialog or Popover */
  inDialog?: boolean;
}

export const Select: Component<SelectProps>;

// ============================================================================
// Splitter
// ============================================================================

export interface SplitterPanel {
  id: string;
  minSize?: number;
  maxSize?: number;
}

export interface SplitterProps {
  /** Default panel sizes as percentages */
  defaultSize?: number[];
  /** Panel configurations */
  panels?: SplitterPanel[];
  /** Orientation (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
  /** Additional class for root element */
  class?: string;
}

export const Splitter: Component<SplitterProps>;

// ============================================================================
// Switch
// ============================================================================

export interface SwitchProps {
  /** Controlled checked state */
  checked?: boolean;
  /** Default checked state (uncontrolled) */
  defaultChecked?: boolean;
  /** Whether switch is disabled */
  disabled?: boolean;
  /** Form field name */
  name?: string;
  /** Callback when checked state changes */
  onChange?: (_checked: boolean) => void;
  /** Additional CSS classes */
  class?: string;
}

export const Switch: Component<SwitchProps>;

// ============================================================================
// Tabs
// ============================================================================

export interface TabDefinition {
  value: string;
  label: string;
  icon?: JSX.Element;
  count?: number;
  getCount?: () => number;
}

export interface TabsProps {
  /** Array of tab definitions */
  tabs: TabDefinition[];
  /** Default selected tab value */
  defaultValue?: string;
  /** Controlled tab value */
  value?: string;
  /** Callback when tab changes */
  onValueChange?: (_value: string) => void;
  /** Tab content render function */
  children?: (_tabValue: string) => JSX.Element;
}

export const Tabs: Component<TabsProps>;

// ============================================================================
// TagsInput
// ============================================================================

export interface TagsInputProps {
  /** Input label */
  label?: string;
  /** Input placeholder (default: 'Add tag...') */
  placeholder?: string;
  /** Controlled tag values */
  value?: string[];
  /** Initial tag values */
  defaultValue?: string[];
  /** Callback when tags change */
  onValueChange?: (_details: { value: string[] }) => void;
  /** Maximum number of tags */
  max?: number;
  /** Allow duplicate tags (default: false) */
  allowDuplicates?: boolean;
  /** Disable the input */
  disabled?: boolean;
  /** Make input read-only */
  readOnly?: boolean;
  /** Mark as invalid */
  invalid?: boolean;
  /** Form field name */
  name?: string;
  /** What to do with input on blur */
  blurBehavior?: 'add' | 'clear';
  /** Add tags when pasting (default: true) */
  addOnPaste?: boolean;
  /** Allow editing tags (default: true) */
  editable?: boolean;
  /** Additional class for root element */
  class?: string;
  /** Additional class for input element */
  inputClass?: string;
}

export const TagsInput: Component<TagsInputProps>;

// ============================================================================
// Toast
// ============================================================================

export interface ToastOptions {
  /** Toast title */
  title?: string;
  /** Toast description */
  description?: string;
  /** Toast type */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Duration in milliseconds */
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

// ============================================================================
// ToggleGroup
// ============================================================================

export interface ToggleGroupItem {
  value: string;
  label: JSX.Element;
  disabled?: boolean;
}

export interface ToggleGroupProps {
  /** Toggle items */
  items: ToggleGroupItem[];
  /** Controlled selected values */
  value?: string[];
  /** Initial selected values */
  defaultValue?: string[];
  /** Callback when selection changes */
  onValueChange?: (_details: { value: string[] }) => void;
  /** Allow multiple selections (default: false) */
  multiple?: boolean;
  /** Disable all toggles */
  disabled?: boolean;
  /** Layout orientation (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
  /** Loop focus navigation (default: true) */
  loop?: boolean;
  /** Use roving tabindex (default: true) */
  rovingFocus?: boolean;
  /** Allow deselecting when single (default: true) */
  deselectable?: boolean;
  /** Button size (default: 'md') */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class for root element */
  class?: string;
}

export const ToggleGroup: Component<ToggleGroupProps>;

// ============================================================================
// Tooltip
// ============================================================================

export interface TooltipProps {
  /** Tooltip content */
  content: string | JSX.Element;
  /** Trigger element */
  children: JSX.Element;
  /** Tooltip placement */
  placement?: Placement;
}

export const Tooltip: Component<TooltipProps>;

// ============================================================================
// Tour
// ============================================================================

export interface TourStepAction {
  label: string;
  action: 'next' | 'prev' | 'dismiss';
}

export interface TourStep {
  /** Unique step identifier */
  id: string;
  /** Step type */
  type: 'tooltip' | 'dialog' | 'floating' | 'wait';
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Target element for tooltip steps */
  target?: () => Element | null;
  /** Tooltip placement */
  placement?: Placement;
  /** Step actions */
  actions?: TourStepAction[];
  /** Show backdrop (default: true) */
  backdrop?: boolean;
  /** Show arrow for tooltips (default: true) */
  arrow?: boolean;
  /** Side effect before showing step */
  effect?: (_ctx: {
    next: () => void;
    show: () => void;
    update: () => void;
  }) => void | (() => void);
}

export interface TourApi {
  /** Whether tour is open */
  open: boolean;
  /** Current step */
  step: TourStep | null;
  /** Start the tour */
  start: () => void;
  /** Stop the tour */
  stop: () => void;
  /** Go to next step */
  next: () => void;
  /** Go to previous step */
  prev: () => void;
  /** Get progress text */
  getProgressText: () => string;
}

export interface TourProviderProps {
  /** Tour steps configuration */
  steps: TourStep[];
  /** Callback when step changes */
  onStepChange?: (_details: { stepId: string; stepIndex: number }) => void;
  /** Callback when tour status changes */
  onStatusChange?: (_details: { status: 'started' | 'stopped' | 'completed' | 'skipped' }) => void;
  /** Close on outside click (default: true) */
  closeOnInteractOutside?: boolean;
  /** Close on escape key (default: true) */
  closeOnEscape?: boolean;
  /** Allow arrow key navigation (default: true) */
  keyboardNavigation?: boolean;
  /** Prevent page interaction during tour */
  preventInteraction?: boolean;
  /** Spotlight padding offset */
  spotlightOffset?: { x: number; y: number };
  /** Spotlight border radius */
  spotlightRadius?: number;
  /** Child components */
  children: JSX.Element;
}

export const TourProvider: Component<TourProviderProps>;

export interface TourProps extends Omit<TourProviderProps, 'children'> {
  /** Render function for trigger */
  renderTrigger?: (_api: Accessor<TourApi>) => JSX.Element;
}

export const Tour: Component<TourProps>;

export function useTour(): Accessor<TourApi>;

// ============================================================================
// Primitives
// ============================================================================

export function useWindowDrag(_options?: { onDragEnd?: () => void }): {
  isDragging: () => boolean;
};

// ============================================================================
// Utilities
// ============================================================================

export function cn(..._classes: (string | undefined | null | false)[]): string;
