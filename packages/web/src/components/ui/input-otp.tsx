import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';

import { cn } from '@/lib/utils';
import { MinusIcon } from 'lucide-react';

// The library's overlay input keeps its text collapsed, so a native click always
// lands at the end; pick the slot under the pointer and select that character
function selectClickedSlot(event: React.MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const slots = input
    .closest('[data-input-otp-container]')
    ?.querySelectorAll<HTMLElement>('[data-slot=input-otp-slot]');
  if (!slots?.length) return;
  const clicked = Array.from(slots).findIndex(
    slot => event.clientX < slot.getBoundingClientRect().right,
  );
  const index = Math.min(clicked === -1 ? slots.length : clicked, input.value.length);

  // Native focus would first snap the selection to the end and paint that frame
  event.preventDefault();
  if (document.activeElement !== input) input.focus();
  if (index < input.value.length) {
    input.setSelectionRange(index, index + 1, 'forward');
  } else {
    input.setSelectionRange(index, index);
  }
  // The library listens for this to sync its slot state; the browser's own
  // selectionchange arrives a task later, after the focus frame has painted
  document.dispatchEvent(new Event('selectionchange'));
}

function InputOTP({
  className,
  containerClassName,
  onMouseDown,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot='input-otp'
      containerClassName={cn(
        'cn-input-otp flex items-center has-disabled:opacity-50',
        containerClassName,
      )}
      spellCheck={false}
      className={cn('disabled:cursor-not-allowed', className)}
      onMouseDown={event => {
        selectClickedSlot(event);
        onMouseDown?.(event);
      }}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='input-otp-group'
      className={cn(
        'has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 flex items-center rounded-lg has-aria-invalid:ring-3',
        className,
      )}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  index: number;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-slot='input-otp-slot'
      data-active={isActive}
      className={cn(
        'border-input aria-invalid:border-destructive data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40 relative -ml-px flex size-8 items-center justify-center border text-sm transition-all outline-none first:ml-0 first:rounded-l-lg last:rounded-r-lg data-[active=true]:z-10 data-[active=true]:ring-3',
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
          <div className='animate-caret-blink bg-foreground h-4 w-px duration-1000' />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({ ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='input-otp-separator'
      className="flex items-center [&_svg:not([class*='size-'])]:size-4"
      role='separator'
      {...props}
    >
      <MinusIcon />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
