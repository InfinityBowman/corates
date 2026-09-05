/**
 * Six-digit emailed code entry plus the resend link with cooldown, shared by
 * sign-in, email verification, password reset, and onboarding.
 */

import { useState, useEffect } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { handleError } from '@/lib/error-utils';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const RESEND_COOLDOWN_SECONDS = 30;

interface CodeInputProps {
  id: string;
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
}

export function CodeInput({ id, value, onChange, onComplete, disabled }: CodeInputProps) {
  return (
    <div className='flex justify-center'>
      <InputOTP
        id={id}
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode='numeric'
        autoComplete='one-time-code'
        autoFocus
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        disabled={disabled}
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map(index => (
            <InputOTPSlot key={index} index={index} className='size-11 text-lg' />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

interface ResendCodeProps {
  onResend: () => Promise<void>;
  onChangeEmail?: () => void;
}

export function ResendCode({ onResend, onChangeEmail }: ResendCodeProps) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const canResend = secondsLeft === 0;

  useEffect(() => {
    if (canResend) return;
    const timer = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(timer);
  }, [canResend]);

  async function handleResend() {
    if (!canResend || resending) return;
    setResending(true);
    setError('');
    try {
      await onResend();
      setResent(true);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      await handleError(err, { setError, showToast: false });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className='flex flex-col items-center gap-1 text-center text-xs'>
      {error && <p className='text-destructive'>{error}</p>}
      <Button
        type='button'
        variant='link'
        className='h-auto p-0 text-xs'
        onClick={handleResend}
        disabled={!canResend || resending}
      >
        {resending ?
          'Sending...'
        : canResend ?
          "Didn't get a code? Send again"
        : resent ?
          `Code sent. Send again in ${secondsLeft}s`
        : `Send again in ${secondsLeft}s`}
      </Button>
      {onChangeEmail && (
        <Button
          type='button'
          variant='link'
          className='text-muted-foreground hover:text-secondary-foreground h-auto p-0 text-xs'
          onClick={onChangeEmail}
        >
          Use a different email
        </Button>
      )}
    </div>
  );
}
