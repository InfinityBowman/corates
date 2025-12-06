import { createSignal, onMount, Show } from 'solid-js';
import { getLastLoginMethod, LOGIN_METHOD_LABELS, LOGIN_METHODS } from '@lib/lastLoginMethod.js';

/**
 * Displays a hint about the user's last login method
 * Shows "You last signed in with X" if a previous method is stored
 */
export default function LastLoginHint() {
  const [lastMethod, setLastMethod] = createSignal(null);

  onMount(() => {
    const method = getLastLoginMethod();
    if (method && LOGIN_METHOD_LABELS[method]) {
      setLastMethod(method);
    }
  });

  const getIcon = () => {
    switch (lastMethod()) {
      case LOGIN_METHODS.GOOGLE:
        return (
          <svg class='w-4 h-4' viewBox='0 0 24 24'>
            <path
              fill='currentColor'
              d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
            />
            <path
              fill='currentColor'
              d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
            />
            <path
              fill='currentColor'
              d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
            />
            <path
              fill='currentColor'
              d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
            />
          </svg>
        );
      case LOGIN_METHODS.ORCID:
        return (
          <svg class='w-4 h-4' viewBox='0 0 24 24'>
            <path
              fill='currentColor'
              d='M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 0 1-.947-.947c0-.525.422-.947.947-.947zm-.684 3.625h1.369v9.681H6.685V8.003zm3.857 0h3.7c3.605 0 5.275 2.587 5.275 4.857 0 2.587-1.986 4.824-5.275 4.824h-3.7V8.003zm1.369 1.272v7.137h2.178c2.839 0 4.037-1.906 4.037-3.569 0-1.906-1.369-3.569-4.037-3.569h-2.178z'
            />
          </svg>
        );
      case LOGIN_METHODS.MAGIC_LINK:
        return (
          <svg
            class='w-4 h-4'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            stroke-width='2'
          >
            <path d='M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' />
            <polyline points='22,6 12,13 2,6' />
          </svg>
        );
      default:
        return (
          <svg
            class='w-4 h-4'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            stroke-width='2'
          >
            <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
            <path d='M7 11V7a5 5 0 0 1 10 0v4' />
          </svg>
        );
    }
  };

  return (
    <Show when={lastMethod()}>
      <div class='flex items-center justify-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg py-2 px-3'>
        <span class='text-gray-400'>{getIcon()}</span>
        <span>You last signed in with {LOGIN_METHOD_LABELS[lastMethod()]}</span>
      </div>
    </Show>
  );
}
