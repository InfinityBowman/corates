import { createSignal, onMount, Show } from 'solid-js';
import { getLastLoginMethod, LOGIN_METHOD_LABELS, LOGIN_METHODS } from '@lib/lastLoginMethod.js';
import { AiOutlineGoogle } from 'solid-icons/ai';
import { FaBrandsOrcid } from 'solid-icons/fa';
import { FiLock, FiMail } from 'solid-icons/fi';

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
          <AiOutlineGoogle class='w-4 h-4' />
        );
      case LOGIN_METHODS.ORCID:
        return (
          <FaBrandsOrcid class='w-4 h-4' />
        );
      case LOGIN_METHODS.MAGIC_LINK:
        return (
          <FiMail class='w-4 h-4' />
        );
      default:
        return (
          <FiLock class='w-4 h-4' />
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
