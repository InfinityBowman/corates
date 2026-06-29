/**
 * DevToastTester - Test toast notifications in development
 */

import { useState } from 'react';
import {
  CheckCircleIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  LoaderIcon,
} from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ToastType = 'success' | 'error' | 'warning' | 'info';

export function DevToastTester() {
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(null);
  const [customTitle, setCustomTitle] = useState('Custom Toast');
  const [customDescription, setCustomDescription] = useState('This is a custom message');

  const triggerToast = (type: ToastType) => {
    const messages: Record<ToastType, [string, string]> = {
      success: ['Success', 'Operation completed successfully'],
      error: ['Error', 'Something went wrong'],
      warning: ['Warning', 'This action cannot be undone'],
      info: ['Info', 'Here is some information'],
    };
    const [title, description] = messages[type];
    showToast[type](title, description);
  };

  const triggerLoading = () => {
    if (loadingToastId) {
      showToast.dismiss(loadingToastId);
      setLoadingToastId(null);
    } else {
      const id = showToast.loading('Loading...', 'Please wait while we process');
      setLoadingToastId(id);
    }
  };

  const triggerCustom = () => {
    showToast.info(customTitle, customDescription);
  };

  const triggerMultiple = () => {
    showToast.success('First Toast', 'This is the first one');
    setTimeout(() => showToast.info('Second Toast', 'This is the second one'), 200);
    setTimeout(() => showToast.warning('Third Toast', 'This is the third one'), 400);
  };

  return (
    <div className='flex flex-col gap-4 p-3'>
      <div>
        <h4 className='text-foreground mb-2 text-xs font-semibold'>Toast Types</h4>
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='outline'
            size='sm'
            className='border-success-border text-success hover:bg-success-bg'
            onClick={() => triggerToast('success')}
          >
            <CheckCircleIcon />
            Success
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='border-destructive-border text-destructive hover:bg-destructive-bg'
            onClick={() => triggerToast('error')}
          >
            <AlertCircleIcon />
            Error
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='border-warning-border text-warning-foreground hover:bg-warning-bg'
            onClick={() => triggerToast('warning')}
          >
            <AlertTriangleIcon />
            Warning
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='border-info-border text-info hover:bg-info-bg'
            onClick={() => triggerToast('info')}
          >
            <InfoIcon />
            Info
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='border-purple-200 text-purple-600 hover:bg-purple-50 aria-pressed:bg-purple-50'
            aria-pressed={!!loadingToastId}
            onClick={triggerLoading}
          >
            <LoaderIcon className={loadingToastId ? 'animate-spin' : ''} />
            {loadingToastId ? 'Dismiss Loading' : 'Loading'}
          </Button>
        </div>
      </div>

      <div>
        <h4 className='text-foreground mb-2 text-xs font-semibold'>Multiple Toasts</h4>
        <Button variant='outline' size='sm' onClick={triggerMultiple}>
          Trigger 3 Toasts
        </Button>
      </div>

      <div className='border-border border-t pt-3'>
        <h4 className='text-foreground mb-2 text-xs font-semibold'>Custom Toast</h4>
        <div className='flex flex-col gap-2'>
          <Input
            type='text'
            value={customTitle}
            onChange={e => setCustomTitle(e.target.value)}
            placeholder='Title'
            className='h-7 text-xs'
          />
          <Input
            type='text'
            value={customDescription}
            onChange={e => setCustomDescription(e.target.value)}
            placeholder='Description'
            className='h-7 text-xs'
          />
          <Button
            variant='outline'
            size='sm'
            className='border-purple-200 text-purple-600 hover:bg-purple-50'
            onClick={triggerCustom}
          >
            Show Custom Toast
          </Button>
        </div>
      </div>
    </div>
  );
}
