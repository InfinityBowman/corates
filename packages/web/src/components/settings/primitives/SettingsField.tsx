/** A labelled form control inside a settings panel. */

import { useId, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface SettingsFieldProps {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: (id: string) => ReactNode;
}

export function SettingsField({ label, hint, className, children }: SettingsFieldProps) {
  const id = useId();

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
    </div>
  );
}
