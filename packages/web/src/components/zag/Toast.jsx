import * as toast from '@zag-js/toast';
import { normalizeProps, useMachine, Key } from '@zag-js/solid';
import { createMemo, createUniqueId, Show } from 'solid-js';
import { FiX, FiCheck, FiAlertCircle, FiInfo, FiLoader } from 'solid-icons/fi';

/**
 * Create the toast store - this is the global toaster instance
 * Import this to create toasts from anywhere in the app
 */
export const toaster = toast.createStore({
  placement: 'top-end',
  overlap: true,
  gap: 12,
  offsets: '16px',
});

/**
 * Individual Toast component
 */
function ToastItem(props) {
  const machineProps = createMemo(() => ({
    ...props.toast(),
    parent: props.parent,
    index: props.index(),
  }));
  // eslint-disable-next-line solid/reactivity
  const service = useMachine(toast.machine, machineProps);
  const api = createMemo(() => toast.connect(service, normalizeProps));

  const getIcon = () => {
    const type = api().type;
    switch (type) {
      case 'success':
        return <FiCheck class='w-5 h-5 text-green-500' />;
      case 'error':
        return <FiAlertCircle class='w-5 h-5 text-red-500' />;
      case 'loading':
        return <FiLoader class='w-5 h-5 text-blue-500 animate-spin' />;
      default:
        return <FiInfo class='w-5 h-5 text-blue-500' />;
    }
  };

  const getStyles = () => {
    const type = api().type;
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'loading':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  return (
    <div
      {...api().getRootProps()}
      class={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border shadow-lg ${getStyles()}`}
    >
      <div class='p-4'>
        <div class='flex items-start'>
          <div class='shrink-0'>{getIcon()}</div>
          <div class='ml-3 w-0 flex-1'>
            <Show when={api().title}>
              <p {...api().getTitleProps()} class='text-sm font-medium text-gray-900'>
                {api().title}
              </p>
            </Show>
            <Show when={api().description}>
              <p {...api().getDescriptionProps()} class='mt-1 text-sm text-gray-500'>
                {api().description}
              </p>
            </Show>
          </div>
          <div class='ml-4 flex shrink-0'>
            <button
              type='button'
              onClick={() => api().dismiss()}
              class='inline-flex rounded-md bg-transparent text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 p-1 cursor-pointer'
            >
              <span class='sr-only'>Close</span>
              <FiX class='h-5 w-5' />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Toaster component - renders all active toasts
 * Add this once at the root of your app (e.g., in Layout.jsx)
 */
export function Toaster() {
  const service = useMachine(toast.group.machine, {
    id: createUniqueId(),
    store: toaster,
  });

  const api = createMemo(() => toast.group.connect(service, normalizeProps));

  return (
    <div
      {...api().getGroupProps()}
      class='pointer-events-none fixed inset-0 z-50 flex flex-col items-end p-4 sm:p-6'
    >
      <Key each={api().getToasts()} by={t => t.id}>
        {(toastItem, index) => <ToastItem toast={toastItem} parent={service} index={index} />}
      </Key>
    </div>
  );
}

/**
 * Convenience methods for creating toasts
 */
export const showToast = {
  success: (title, description) =>
    toaster.create({ title, description, type: 'success', duration: 4000 }),

  error: (title, description) =>
    toaster.create({ title, description, type: 'error', duration: 6000 }),

  info: (title, description) =>
    toaster.create({ title, description, type: 'info', duration: 4000 }),

  loading: (title, description) =>
    toaster.create({ title, description, type: 'loading', duration: Infinity }),

  promise: (promise, options) => toaster.promise(promise, options),

  dismiss: id => toaster.dismiss(id),

  update: (id, options) => toaster.update(id, options),
};

export default Toaster;
