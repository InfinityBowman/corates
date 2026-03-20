/**
 * Editable - Inline editable text component (@ark-ui/react)
 *
 * @example
 * <SimpleEditable
 *   value={name}
 *   onSubmit={handleNameChange}
 *   activationMode="click"
 * />
 *
 * @example
 * <Editable defaultValue={description} onValueCommit={handleSave}>
 *   <EditableArea>
 *     <EditableTextarea rows={2} />
 *     <EditablePreview />
 *   </EditableArea>
 * </Editable>
 */

import * as React from 'react';
import { Editable as EditablePrimitive } from '@ark-ui/react/editable';
import { CheckIcon, XIcon, PencilIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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

/* eslint-disable no-unused-vars */
interface SimpleEditableProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  autoResize?: boolean;
  activationMode?: 'focus' | 'dblclick' | 'click' | 'none';
  submitMode?: 'enter' | 'blur' | 'none' | 'both';
  selectOnFocus?: boolean;
  maxLength?: number;
  variant?: EditableVariant;
  className?: string;
  areaClassName?: string;
  inputClassName?: string;
  previewClassName?: string;
  showControls?: boolean;
  showEditIcon?: boolean;
  label?: string;
}
/* eslint-enable no-unused-vars */

function SimpleEditable({
  value,
  defaultValue,
  placeholder = 'Click to edit...',
  onChange,
  onSubmit,
  onCancel,
  disabled,
  readOnly,
  autoResize = true,
  activationMode = 'dblclick',
  submitMode = 'both',
  selectOnFocus = true,
  maxLength,
  variant = 'default',
  className,
  areaClassName,
  inputClassName,
  previewClassName,
  showControls = false,
  showEditIcon = false,
  label,
}: SimpleEditableProps) {
  const variantStyles = variants[variant] || variants.default;
  const initialValue = value ?? defaultValue ?? '';

  return (
    <EditablePrimitive.Root
      defaultValue={initialValue}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      autoResize={autoResize}
      activationMode={activationMode}
      submitMode={submitMode}
      selectOnFocus={selectOnFocus}
      maxLength={maxLength}
      onValueChange={details => onChange?.(details.value)}
      onValueCommit={details => onSubmit?.(details.value)}
      onValueRevert={() => onCancel?.()}
      className={cn('group inline-block', className)}
    >
      <EditablePrimitive.Context>
        {api => (
          <>
            {label && (
              <EditablePrimitive.Label className='text-muted-foreground mb-1 block text-sm font-medium'>
                {label}
              </EditablePrimitive.Label>
            )}

            <div className='flex items-center gap-2'>
              <EditablePrimitive.Area
                className={cn(
                  variantStyles.area,
                  disabled && 'cursor-not-allowed opacity-50',
                  areaClassName,
                )}
              >
                <EditablePrimitive.Input className={cn(variantStyles.input, inputClassName)} />
                <EditablePrimitive.Preview
                  className={cn(
                    variantStyles.preview,
                    !api.value && 'text-muted-foreground/70',
                    previewClassName,
                  )}
                />
              </EditablePrimitive.Area>

              {showControls && (
                <div className='flex items-center gap-1'>
                  {api.editing ?
                    <>
                      <EditablePrimitive.SubmitTrigger className='rounded p-1 text-green-500 transition-colors hover:bg-green-50 hover:text-green-600'>
                        <CheckIcon className='h-4 w-4' />
                      </EditablePrimitive.SubmitTrigger>
                      <EditablePrimitive.CancelTrigger className='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground rounded p-1 transition-colors'>
                        <XIcon className='h-4 w-4' />
                      </EditablePrimitive.CancelTrigger>
                    </>
                  : <EditablePrimitive.EditTrigger className='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground rounded p-1 opacity-0 transition-colors group-hover:opacity-100'>
                      <PencilIcon className='h-4 w-4' />
                    </EditablePrimitive.EditTrigger>
                  }
                </div>
              )}

              {showEditIcon && !showControls && !api.editing && (
                <EditablePrimitive.EditTrigger className='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground rounded p-1 opacity-0 transition-colors group-hover:opacity-100'>
                  <PencilIcon className='h-4 w-4' />
                </EditablePrimitive.EditTrigger>
              )}
            </div>
          </>
        )}
      </EditablePrimitive.Context>
    </EditablePrimitive.Root>
  );
}

function EditableTextarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <EditablePrimitive.Input asChild>
      <textarea
        className={cn(
          'placeholder:text-muted-foreground/60 w-full resize-none bg-transparent outline-none',
          className,
        )}
        {...props}
      />
    </EditablePrimitive.Input>
  );
}

const Editable = EditablePrimitive.Root;
const EditableArea = EditablePrimitive.Area;
const EditableInput = EditablePrimitive.Input;
const EditablePreview = EditablePrimitive.Preview;
const EditableLabel = EditablePrimitive.Label;
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
  EditableEditTrigger,
  EditableSubmitTrigger,
  EditableCancelTrigger,
  EditableContext,
};
