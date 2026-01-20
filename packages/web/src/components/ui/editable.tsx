/**
 * Editable - Inline editable text component
 *
 * @example
 * // Basic usage
 * <SimpleEditable
 *   value={name()}
 *   onSubmit={handleNameChange}
 *   activationMode="click"
 * />
 *
 * @example
 * // With edit icon
 * <SimpleEditable
 *   value={title()}
 *   onSubmit={handleTitleChange}
 *   showEditIcon
 *   class="text-2xl font-bold"
 * />
 *
 * @example
 * // Composable multi-line editable
 * <Editable defaultValue={description()} onValueCommit={handleSave}>
 *   <EditableArea>
 *     <EditableTextarea rows={2} />
 *     <EditablePreview />
 *   </EditableArea>
 * </Editable>
 */

import type { Component, ComponentProps } from 'solid-js';
import { Show, splitProps, mergeProps } from 'solid-js';
import { Editable as EditablePrimitive } from '@ark-ui/solid/editable';
import { FiCheck, FiX, FiEdit2 } from 'solid-icons/fi';
import { cn } from './cn';

// Variant style presets
const variants = {
  default: {
    area: 'px-2 py-1 rounded transition-colors hover:bg-secondary focus-within:ring-1 focus-within:ring-primary focus-within:border-primary border border-transparent',
    input: 'outline-none bg-transparent',
    preview: 'cursor-pointer',
  },
  inline: {
    area: 'border-b border-transparent focus-within:border-primary transition-colors',
    input: 'outline-none bg-transparent',
    preview: 'cursor-pointer hover:text-primary transition-colors',
  },
  heading: {
    area: 'rounded transition-colors hover:bg-muted focus-within:bg-muted',
    input: 'outline-none bg-transparent',
    preview: 'cursor-pointer',
  },
  field: {
    area: 'px-3 py-2 border border-border rounded-md transition-colors hover:border-border/80 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary',
    input: 'outline-none bg-transparent',
    preview: 'cursor-pointer',
  },
} as const;

type EditableVariant = keyof typeof variants;

type SimpleEditableProps = {
  /** The controlled value */
  value?: string;
  /** The initial value (uncontrolled) */
  defaultValue?: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Called when value changes (on each keystroke) */
  onChange?: (_value: string) => void;
  /** Called when value is committed (Enter/blur/submit button) */
  onSubmit?: (_value: string) => void;
  /** Called when editing is cancelled */
  onCancel?: () => void;
  /** Whether the editable is disabled */
  disabled?: boolean;
  /** Whether the editable is read-only */
  readOnly?: boolean;
  /** Whether to auto-resize to fit content */
  autoResize?: boolean;
  /** How to enter edit mode */
  activationMode?: 'focus' | 'dblclick' | 'click' | 'none';
  /** What triggers submit */
  submitMode?: 'enter' | 'blur' | 'none' | 'both';
  /** Whether to select text when focused */
  selectOnFocus?: boolean;
  /** Maximum characters allowed */
  maxLength?: number;
  /** Style preset */
  variant?: EditableVariant;
  /** Additional CSS classes for the root */
  class?: string;
  /** Additional CSS classes for the area */
  areaClass?: string;
  /** Additional CSS classes for the input */
  inputClass?: string;
  /** Additional CSS classes for the preview */
  previewClass?: string;
  /** Whether to show edit/save/cancel buttons */
  showControls?: boolean;
  /** Whether to show only an edit icon trigger */
  showEditIcon?: boolean;
  /** Optional label text */
  label?: string;
};

const SimpleEditable: Component<SimpleEditableProps> = props => {
  const merged = mergeProps(
    {
      placeholder: 'Click to edit...',
      activationMode: 'dblclick' as const,
      submitMode: 'both' as const,
      selectOnFocus: true,
      autoResize: true,
      showControls: false,
      showEditIcon: false,
      variant: 'default' as EditableVariant,
    },
    props,
  );

  const [local] = splitProps(merged, [
    'value',
    'defaultValue',
    'placeholder',
    'onChange',
    'onSubmit',
    'onCancel',
    'disabled',
    'readOnly',
    'autoResize',
    'activationMode',
    'submitMode',
    'selectOnFocus',
    'maxLength',
    'variant',
    'class',
    'areaClass',
    'inputClass',
    'previewClass',
    'showControls',
    'showEditIcon',
    'label',
  ]);

  const variantStyles = () => variants[local.variant] || variants.default;

  // Always use uncontrolled mode (defaultValue) so the component manages its own
  // editing state. The value/defaultValue prop just initializes it.
  // onSubmit is called when the user commits (blur/Enter).
  const initialValue = () => local.value ?? local.defaultValue ?? '';

  return (
    <EditablePrimitive.Root
      defaultValue={initialValue()}
      placeholder={local.placeholder}
      disabled={local.disabled}
      readOnly={local.readOnly}
      autoResize={local.autoResize}
      activationMode={local.activationMode}
      submitMode={local.submitMode}
      selectOnFocus={local.selectOnFocus}
      maxLength={local.maxLength}
      onValueChange={details => local.onChange?.(details.value)}
      onValueCommit={details => local.onSubmit?.(details.value)}
      onValueRevert={() => local.onCancel?.()}
      class={cn('group inline-block', local.class)}
    >
      <EditablePrimitive.Context>
        {api => (
          <>
            <Show when={local.label}>
              <EditablePrimitive.Label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                {local.label}
              </EditablePrimitive.Label>
            </Show>

            <div class='flex items-center gap-2'>
              <EditablePrimitive.Area
                class={cn(
                  variantStyles().area,
                  local.disabled && 'cursor-not-allowed opacity-50',
                  local.areaClass,
                )}
              >
                <EditablePrimitive.Input class={cn(variantStyles().input, local.inputClass)} />
                <EditablePrimitive.Preview
                  class={cn(
                    variantStyles().preview,
                    !api().value && 'text-muted-foreground/70',
                    local.previewClass,
                  )}
                >
                  {api().value || local.placeholder}
                </EditablePrimitive.Preview>
              </EditablePrimitive.Area>

              <Show when={local.showControls}>
                <div class='flex items-center gap-1'>
                  <Show
                    when={api().editing}
                    fallback={
                      <EditablePrimitive.EditTrigger class='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground rounded p-1 opacity-0 transition-colors group-hover:opacity-100'>
                        <FiEdit2 class='h-4 w-4' />
                      </EditablePrimitive.EditTrigger>
                    }
                  >
                    <EditablePrimitive.SubmitTrigger class='rounded p-1 text-green-500 transition-colors hover:bg-green-50 hover:text-green-600'>
                      <FiCheck class='h-4 w-4' />
                    </EditablePrimitive.SubmitTrigger>
                    <EditablePrimitive.CancelTrigger class='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground rounded p-1 transition-colors'>
                      <FiX class='h-4 w-4' />
                    </EditablePrimitive.CancelTrigger>
                  </Show>
                </div>
              </Show>

              <Show when={local.showEditIcon && !local.showControls && !api().editing}>
                <EditablePrimitive.EditTrigger class='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground rounded p-1 opacity-0 transition-colors group-hover:opacity-100'>
                  <FiEdit2 class='h-4 w-4' />
                </EditablePrimitive.EditTrigger>
              </Show>
            </div>
          </>
        )}
      </EditablePrimitive.Context>
    </EditablePrimitive.Root>
  );
};

// ============================================================================
// EditableTextarea - Multi-line text input for composable usage
// ============================================================================

type EditableTextareaProps = ComponentProps<'textarea'> & {
  class?: string;
};

/**
 * Multi-line textarea variant for Editable.
 * Use with the composable Editable primitives.
 *
 * @example
 * <Editable defaultValue={description()} onValueCommit={handleSave}>
 *   <EditableArea>
 *     <EditableTextarea rows={2} class="text-sm" />
 *     <EditablePreview />
 *   </EditableArea>
 * </Editable>
 */
const EditableTextarea: Component<EditableTextareaProps> = props => {
  const [local, others] = splitProps(props, ['class']);

  return (
    <EditablePrimitive.Input
      asChild={inputProps => (
        <textarea
          {...inputProps()}
          class={cn(
            'w-full resize-none bg-transparent outline-none',
            'placeholder:text-muted-foreground/60',
            local.class,
          )}
          {...others}
        />
      )}
    />
  );
};

// Re-export Ark UI primitives for composable usage
const Editable = EditablePrimitive.Root;
const EditableArea = EditablePrimitive.Area;
const EditableInput = EditablePrimitive.Input;
const EditablePreview = EditablePrimitive.Preview;
const EditableLabel = EditablePrimitive.Label;
const EditableControl = EditablePrimitive.Control;
const EditableEditTrigger = EditablePrimitive.EditTrigger;
const EditableSubmitTrigger = EditablePrimitive.SubmitTrigger;
const EditableCancelTrigger = EditablePrimitive.CancelTrigger;
const EditableContext = EditablePrimitive.Context;

export {
  SimpleEditable,
  Editable,
  EditableArea,
  EditableInput,
  EditableTextarea,
  EditablePreview,
  EditableLabel,
  EditableControl,
  EditableEditTrigger,
  EditableSubmitTrigger,
  EditableCancelTrigger,
  EditableContext,
};
