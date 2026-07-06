/**
 * FeedbackDialog - In-app feedback form (bug reports, ideas)
 *
 * Mounted once in the root layout; opened from anywhere via feedbackStore.
 * Submissions are stored server-side and emailed to the team. Bug reports
 * silently attach the current Sentry session replay id when one exists.
 */

import { useState } from 'react';
import { BugIcon, CheckIcon, LightbulbIcon, MessageCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useFeedbackStore } from '@/stores/feedbackStore';
import { submitFeedback } from '@/server/functions/feedback.functions';
import { getSentryReplayId } from '@/config/sentry';
import { track } from '@/lib/analytics';

type Category = 'bug' | 'idea' | 'other';
type FormState = 'idle' | 'sending' | 'sent' | 'error';

const CATEGORIES: { value: Category; label: string; icon: typeof BugIcon }[] = [
  { value: 'bug', label: 'Bug', icon: BugIcon },
  { value: 'idea', label: 'Idea', icon: LightbulbIcon },
  { value: 'other', label: 'Other', icon: MessageCircleIcon },
];

const CLOSE_AFTER_SENT_MS = 1500;

export function FeedbackDialog() {
  const isOpen = useFeedbackStore(s => s.isOpen);
  const close = useFeedbackStore(s => s.close);

  const [category, setCategory] = useState<Category>('idea');
  const [message, setMessage] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      close();
      setMessage('');
      setFormState('idle');
    }
  };

  const handleSubmit = async () => {
    if (!message.trim() || formState === 'sending') return;
    setFormState('sending');

    try {
      await submitFeedback({
        data: {
          category,
          message: message.trim(),
          context: {
            route: window.location.pathname,
            userAgent: navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            replayId: category === 'bug' ? getSentryReplayId() : undefined,
          },
        },
      });
      track('Feedback:Submitted', { category });
      setFormState('sent');
      setTimeout(() => handleOpenChange(false), CLOSE_AFTER_SENT_MS);
    } catch {
      setFormState('error');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-md'>
        {formState === 'sent' ?
          <div className='flex flex-col items-center gap-3 py-8 text-center'>
            <div className='flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30'>
              <CheckIcon className='size-6 text-green-600 dark:text-green-400' />
            </div>
            <DialogTitle>Thanks for the feedback</DialogTitle>
            <DialogDescription>We read every submission.</DialogDescription>
          </div>
        : <>
            <DialogHeader>
              <DialogTitle>Give feedback</DialogTitle>
              <DialogDescription>
                Tell us what's broken, missing, or working well.
              </DialogDescription>
            </DialogHeader>

            <div className='flex gap-2'>
              {CATEGORIES.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type='button'
                  variant={category === value ? 'default' : 'outline'}
                  size='sm'
                  aria-pressed={category === value}
                  onClick={() => setCategory(value)}
                >
                  <Icon className='size-4' />
                  {label}
                </Button>
              ))}
            </div>

            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={
                category === 'bug' ?
                  'What happened, and what did you expect?'
                : 'What should we know?'
              }
              maxLength={2000}
              rows={5}
              aria-label='Feedback message'
            />

            {category === 'bug' && (
              <p className='text-muted-foreground text-xs'>
                Bug reports include a recording of your current session to help us reproduce the
                issue.
              </p>
            )}

            {formState === 'error' && (
              <p className='text-destructive text-sm'>
                Something went wrong sending your feedback. Please try again.
              </p>
            )}

            <DialogFooter>
              <Button
                onClick={handleSubmit}
                disabled={!message.trim() || formState === 'sending'}
              >
                {formState === 'sending' ? 'Sending...' : 'Send feedback'}
              </Button>
            </DialogFooter>
          </>
        }
      </DialogContent>
    </Dialog>
  );
}
