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

  const buttonClass =
    'flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors';

  return (
    <div className='flex flex-col gap-4 p-3'>
      <div>
        <h4 className='text-foreground mb-2 text-xs font-semibold'>Toast Types</h4>
        <div className='flex flex-wrap gap-2'>
          <button
            className={`${buttonClass} border-success-border text-success hover:border-success hover:bg-success-bg`}
            onClick={() => triggerToast('success')}
          >
            <CheckCircleIcon size={14} />
            Success
          </button>
          <button
            className={`${buttonClass} border-red-200 text-red-600 hover:border-red-400 hover:bg-red-50`}
            onClick={() => triggerToast('error')}
          >
            <AlertCircleIcon size={14} />
            Error
          </button>
          <button
            className={`${buttonClass} border-amber-200 text-amber-600 hover:border-amber-400 hover:bg-amber-50`}
            onClick={() => triggerToast('warning')}
          >
            <AlertTriangleIcon size={14} />
            Warning
          </button>
          <button
            className={`${buttonClass} border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50`}
            onClick={() => triggerToast('info')}
          >
            <InfoIcon size={14} />
            Info
          </button>
          <button
            className={`${buttonClass} ${loadingToastId ? 'border-purple-400 bg-purple-50' : 'border-purple-200'} text-purple-600 hover:border-purple-400 hover:bg-purple-50`}
            onClick={triggerLoading}
          >
            <LoaderIcon size={14} className={loadingToastId ? 'animate-spin' : ''} />
            {loadingToastId ? 'Dismiss Loading' : 'Loading'}
          </button>
        </div>
      </div>

      <div>
        <h4 className='text-foreground mb-2 text-xs font-semibold'>Multiple Toasts</h4>
        <button
          className={`${buttonClass} border-border text-muted-foreground hover:border-border hover:bg-muted`}
          onClick={triggerMultiple}
        >
          Trigger 3 Toasts
        </button>
      </div>

      <div className='border-border border-t pt-3'>
        <h4 className='text-foreground mb-2 text-xs font-semibold'>Custom Toast</h4>
        <div className='flex flex-col gap-2'>
          <input
            type='text'
            value={customTitle}
            onChange={e => setCustomTitle(e.target.value)}
            placeholder='Title'
            className='border-border rounded border px-2 py-1 text-xs focus:border-purple-500 focus:outline-none'
          />
          <input
            type='text'
            value={customDescription}
            onChange={e => setCustomDescription(e.target.value)}
            placeholder='Description'
            className='border-border rounded border px-2 py-1 text-xs focus:border-purple-500 focus:outline-none'
          />
          <button
            className={`${buttonClass} border-purple-200 text-purple-600 hover:border-purple-400 hover:bg-purple-50`}
            onClick={triggerCustom}
          >
            Show Custom Toast
          </button>
        </div>
      </div>
    </div>
  );
}
