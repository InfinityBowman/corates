/**
 * FeedbackPrompt - Home CTA for the early-access feedback ask.
 *
 * Deliberately not dismissible: the account-menu entry was too easy to miss,
 * and a one-line row is cheap to scroll past without becoming a nag.
 */

import { MessageCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeedbackStore } from '@/stores/feedbackStore';

interface FeedbackPromptProps {
  style?: React.CSSProperties;
}

export function FeedbackPrompt({ style }: FeedbackPromptProps) {
  const openFeedback = useFeedbackStore(s => s.open);

  return (
    <section
      className='border-border bg-card flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3'
      style={style}
    >
      <MessageCircleIcon className='text-muted-foreground size-4 shrink-0' aria-hidden='true' />
      <p className='text-muted-foreground min-w-0 flex-1 text-sm'>
        CoRATES is in early access. Tell us what's broken, missing, or slowing you down.
      </p>
      <Button variant='outline' size='sm' onClick={openFeedback}>
        Give feedback
      </Button>
    </section>
  );
}
