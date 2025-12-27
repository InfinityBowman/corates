import { createSignal, onMount, Show } from 'solid-js'
import {
  getLastLoginMethod,
  LOGIN_METHOD_LABELS,
  LOGIN_METHODS,
} from '@lib/lastLoginMethod.js'
import { AiOutlineGoogle } from 'solid-icons/ai'
import { FaBrandsOrcid } from 'solid-icons/fa'
import { FiLock, FiMail } from 'solid-icons/fi'

/**
 * Displays a hint about the user's last login method
 * Shows "You last signed in with X" if a previous method is stored
 */
export default function LastLoginHint() {
  const [lastMethod, setLastMethod] = createSignal(null)

  onMount(() => {
    const method = getLastLoginMethod()
    if (method && LOGIN_METHOD_LABELS[method]) {
      setLastMethod(method)
    }
  })

  const getIcon = () => {
    switch (lastMethod()) {
      case LOGIN_METHODS.GOOGLE:
        return <AiOutlineGoogle class="h-4 w-4" />
      case LOGIN_METHODS.ORCID:
        return <FaBrandsOrcid class="h-4 w-4" />
      case LOGIN_METHODS.MAGIC_LINK:
        return <FiMail class="h-4 w-4" />
      default:
        return <FiLock class="h-4 w-4" />
    }
  }

  return (
    <Show when={lastMethod()}>
      <div class="flex items-center justify-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
        <span class="text-gray-400">{getIcon()}</span>
        <span>You last signed in with {LOGIN_METHOD_LABELS[lastMethod()]}</span>
      </div>
    </Show>
  )
}
