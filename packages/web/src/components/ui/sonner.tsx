import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme='light'
      richColors
      closeButton
      className='toaster group'
      icons={{
        success: <CircleCheckIcon className='size-4' />,
        info: <InfoIcon className='size-4' />,
        warning: <TriangleAlertIcon className='size-4' />,
        error: <OctagonXIcon className='size-4' />,
        loading: <Loader2Icon className='size-4 animate-spin' />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          // Point Sonner's rich-colors palette at our status tokens. Sonner's
          // variable names collide with the app tokens (--success-bg etc.), so
          // reference the Tailwind @theme --color-* aliases to avoid
          // self-referential cycles.
          '--success-bg': 'var(--color-success-bg)',
          '--success-border': 'var(--color-success-border)',
          '--success-text': 'var(--color-success)',
          '--error-bg': 'var(--color-destructive-bg)',
          '--error-border': 'var(--color-destructive-border)',
          '--error-text': 'var(--color-destructive)',
          '--warning-bg': 'var(--color-warning-bg)',
          '--warning-border': 'var(--color-warning-border)',
          '--warning-text': 'var(--color-warning-foreground)',
          '--info-bg': 'var(--color-info-bg)',
          '--info-border': 'var(--color-info-border)',
          '--info-text': 'var(--color-info)',
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
