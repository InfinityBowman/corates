/**
 * DevToastTester - Test toast notifications in development
 */

import { createSignal } from 'solid-js';
import { FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiInfo, FiLoader } from 'solid-icons/fi';
import { showToast } from '@/components/ui/toast';

export default function DevToastTester() {
  const [loadingToastId, setLoadingToastId] = createSignal(null);
  const [customTitle, setCustomTitle] = createSignal('Custom Toast');
  const [customDescription, setCustomDescription] = createSignal('This is a custom message');

  const triggerToast = type => {
    const messages = {
      success: ['Success', 'Operation completed successfully'],
      error: ['Error', 'Something went wrong'],
      warning: ['Warning', 'This action cannot be undone'],
      info: ['Info', 'Here is some information'],
    };
    const [title, description] = messages[type];
    showToast[type](title, description);
  };

  const triggerLoading = () => {
    if (loadingToastId()) {
      showToast.dismiss(loadingToastId());
      setLoadingToastId(null);
    } else {
      const id = showToast.loading('Loading...', 'Please wait while we process');
      setLoadingToastId(id);
    }
  };

  const triggerCustom = () => {
    showToast.info(customTitle(), customDescription());
  };

  const triggerMultiple = () => {
    showToast.success('First Toast', 'This is the first one');
    setTimeout(() => showToast.info('Second Toast', 'This is the second one'), 200);
    setTimeout(() => showToast.warning('Third Toast', 'This is the third one'), 400);
  };

  const buttonClass =
    'flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors';

  return (
    <div class='flex flex-col gap-4 p-3'>
      <div>
        <h4 class='mb-2 text-xs font-semibold text-gray-900'>Toast Types</h4>
        <div class='flex flex-wrap gap-2'>
          <button
            class={`${buttonClass} border-green-200 text-green-600 hover:border-green-400 hover:bg-green-50`}
            onClick={() => triggerToast('success')}
          >
            <FiCheckCircle size={14} />
            Success
          </button>
          <button
            class={`${buttonClass} border-red-200 text-red-600 hover:border-red-400 hover:bg-red-50`}
            onClick={() => triggerToast('error')}
          >
            <FiAlertCircle size={14} />
            Error
          </button>
          <button
            class={`${buttonClass} border-amber-200 text-amber-600 hover:border-amber-400 hover:bg-amber-50`}
            onClick={() => triggerToast('warning')}
          >
            <FiAlertTriangle size={14} />
            Warning
          </button>
          <button
            class={`${buttonClass} border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50`}
            onClick={() => triggerToast('info')}
          >
            <FiInfo size={14} />
            Info
          </button>
          <button
            class={`${buttonClass} ${loadingToastId() ? 'border-purple-400 bg-purple-50' : 'border-purple-200'} text-purple-600 hover:border-purple-400 hover:bg-purple-50`}
            onClick={triggerLoading}
          >
            <FiLoader size={14} class={loadingToastId() ? 'animate-spin' : ''} />
            {loadingToastId() ? 'Dismiss Loading' : 'Loading'}
          </button>
        </div>
      </div>

      <div>
        <h4 class='mb-2 text-xs font-semibold text-gray-900'>Multiple Toasts</h4>
        <button
          class={`${buttonClass} border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50`}
          onClick={triggerMultiple}
        >
          Trigger 3 Toasts
        </button>
      </div>

      <div class='border-t border-gray-200 pt-3'>
        <h4 class='mb-2 text-xs font-semibold text-gray-900'>Custom Toast</h4>
        <div class='flex flex-col gap-2'>
          <input
            type='text'
            value={customTitle()}
            onInput={e => setCustomTitle(e.target.value)}
            placeholder='Title'
            class='rounded border border-gray-300 px-2 py-1 text-xs focus:border-purple-500 focus:outline-none'
          />
          <input
            type='text'
            value={customDescription()}
            onInput={e => setCustomDescription(e.target.value)}
            placeholder='Description'
            class='rounded border border-gray-300 px-2 py-1 text-xs focus:border-purple-500 focus:outline-none'
          />
          <button
            class={`${buttonClass} border-purple-200 text-purple-600 hover:border-purple-400 hover:bg-purple-50`}
            onClick={triggerCustom}
          >
            Show Custom Toast
          </button>
        </div>
      </div>
    </div>
  );
}
