When implementing new Zag components, check existing components for patterns and the Zag docs from the CoRATES MCP tool. Always add new components to this list and any modifications if nececcary.

Here are the existing components and a summary of them:

- `Accordion.jsx` - Vertically stacked expandable sections (supports `items`, `defaultValue`, `value`, `onValueChange`, `multiple`, `collapsible`, `disabled`, `orientation`, `class` props)
- `Avatar.jsx` - User avatar with image and fallback initials (supports `src`, `name`, `alt`, `onStatusChange`, `class` props)
- `Checkbox.jsx` - Checkbox input with label (supports `checked`, `defaultChecked`, `indeterminate`, `disabled`, `name`, `value`, `label`, `onChange`, `class` props)
- `Clipboard.jsx` - Copy to clipboard functionality (supports `value`, `defaultValue`, `onValueChange`, `onStatusChange`, `timeout`, `label`, `showInput`, `children`, `class` props). Also exports `CopyButton` for simple copy buttons with `value`, `label`, `copiedLabel`, `size`, `variant`, `showIcon`, `showLabel` props
- `Collapsible.jsx` - Expandable/collapsible content sections
- `Combobox.jsx` - Searchable select with autocomplete (supports `items`, `label`, `placeholder`, `value`, `defaultValue`, `onValueChange`, `onInputValueChange`, `multiple`, `disabled`, `readOnly`, `invalid`, `name`, `allowCustomValue`, `closeOnSelect`, `openOnClick`, `inDialog`, `class`, `inputClass` props)
- `Dialog.jsx` - Modal dialogs
- `Editable.jsx` - Inline editable single-line text (supports `value`, `defaultValue`, `placeholder`, `onChange`, `onSubmit`, `onCancel`, `disabled`, `readOnly`, `autoResize`, `activationMode`, `submitMode`, `selectOnFocus`, `maxLength`, `showControls`, `label`, `class`, `inputClass`, `previewClass` props). Best for titles/names - use manual textarea for multi-line content.
- `FileUpload.jsx` - File upload with drag-and-drop
- `FloatingPanel.jsx` - Draggable and resizable floating panel (supports `open`, `onOpenChange`, `title`, `defaultSize`, `defaultPosition`, `size`, `position`, `onSizeChange`, `onPositionChange`, `onStageChange`, `resizable`, `draggable`, `minSize`, `maxSize`, `lockAspectRatio`, `showControls`, `showResizeHandles` props)
- `Menu.jsx` - Dropdown menu for actions (supports `trigger`, `items`, `onSelect`, `open`, `defaultOpen`, `onOpenChange`, `placement`, `closeOnSelect`, `inDialog`, `class` props - items can have `value`, `label`, `icon`, `disabled`, `destructive`, `separator`, `groupLabel`)
- `NumberInput.jsx` - Numeric input with increment/decrement controls (supports `label`, `value`, `defaultValue`, `onValueChange`, `min`, `max`, `step`, `disabled`, `readOnly`, `invalid`, `required`, `name`, `placeholder`, `allowMouseWheel`, `clampValueOnBlur`, `spinOnPress`, `formatOptions`, `showControls`, `size`, `class`, `inputClass` props)
- `PasswordInput.jsx` - Password input with show/hide toggle (supports `label`, `password`, `onPasswordChange`, `autoComplete`, `inputClass` props)
- `PinInput.jsx` - PIN/OTP code input
- `Popover.jsx` - Non-modal floating dialog (supports `trigger`, `children`, `title`, `description`, `open`, `defaultOpen`, `onOpenChange`, `placement`, `modal`, `closeOnInteractOutside`, `closeOnEscape`, `showArrow`, `showCloseButton`, `inDialog`, `class` props)
- `Progress.jsx` - Linear progress bar (supports `value`, `min`, `max`, `label`, `showValue`, `size`, `variant`, `indeterminate`, `class` props)
- `QRCode.jsx` - QR code generator
- `RadioGroup.jsx` - Radio button group for single selection (supports `items`, `label`, `value`, `defaultValue`, `onValueChange`, `name`, `disabled`, `orientation`, `class` props)
- `Select.jsx` - Custom dropdown select (supports `items`, `value`, `onChange`, `label`, `placeholder`, `disabled`, `name`, `invalid`, `disabledValues`, `inDialog` props - set `inDialog` to true when used inside a Dialog)
- `Splitter.jsx` - Resizable split panes
- `Switch.jsx` - Toggle switch
- `Tabs.jsx` - Tabbed content
- `TagsInput.jsx` - Input for multiple tag values (supports `label`, `placeholder`, `value`, `defaultValue`, `onValueChange`, `max`, `allowDuplicates`, `disabled`, `readOnly`, `invalid`, `name`, `blurBehavior`, `addOnPaste`, `editable`, `class`, `inputClass` props)
- `Toast.jsx` - Toast notifications (use via `useToast` from `@primitives/useToast.jsx`)
- `ToggleGroup.jsx` - Group of toggle buttons (supports `items`, `value`, `defaultValue`, `onValueChange`, `multiple`, `disabled`, `orientation`, `loop`, `rovingFocus`, `deselectable`, `size`, `class` props)
- `Tooltip.jsx` - Tooltips with arrow support (supports `content`, `placement`, `openDelay`, `closeDelay` props)
- `Tour.jsx` - Onboarding tour/walkthrough (exports `TourProvider`, `useTour`, `Tour` - supports `steps`, `onStepChange`, `onStatusChange`, `closeOnInteractOutside`, `closeOnEscape`, `keyboardNavigation`, `preventInteraction`, `spotlightOffset`, `spotlightRadius` props. Steps have `id`, `type`, `title`, `description`, `target`, `placement`, `actions`, `backdrop`, `arrow`, `effect`)
