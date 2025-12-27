import { AnimatedShow } from '../AnimatedShow.jsx'
import { AiOutlineLoading3Quarters } from 'solid-icons/ai'

/**
 * Primary button for auth forms
 * @param {Object} props
 * @param {boolean} props.loading - Whether the button is in loading state
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {string} props.loadingText - Text to show while loading
 * @param {string} props.type - Button type (default: 'submit')
 * @param {Function} props.onClick - Click handler
 * @param {JSX.Element} props.children - Button content
 */
export function PrimaryButton(props) {
  return (
    <button
      type={props.type || 'submit'}
      class="flex w-full items-center justify-center rounded-lg bg-blue-600 py-2 text-sm font-bold text-white shadow transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:py-3 sm:text-base"
      disabled={props.disabled || props.loading}
      onClick={() => props.onClick?.()}
    >
      <AnimatedShow when={props.loading} fallback={props.children}>
        <div class="flex items-center">
          <AiOutlineLoading3Quarters class="mr-2 animate-spin" size={22} />
          {props.loadingText || 'Loading...'}
        </div>
      </AnimatedShow>
    </button>
  )
}

/**
 * Secondary/outline button for auth forms
 * @param {Object} props
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {string} props.type - Button type (default: 'button')
 * @param {Function} props.onClick - Click handler
 * @param {JSX.Element} props.children - Button content
 */
export function SecondaryButton(props) {
  return (
    <button
      type={props.type || 'button'}
      class="w-full rounded-lg border border-gray-300 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:py-3 sm:text-base"
      disabled={props.disabled}
      onClick={() => props.onClick?.()}
    >
      {props.children}
    </button>
  )
}

/**
 * Auth link styled as text
 * @param {Object} props
 * @param {string} props.href - Link destination
 * @param {Function} props.onClick - Click handler (for SPA navigation)
 * @param {JSX.Element} props.children - Link content
 */
export function AuthLink(props) {
  return (
    <a
      href={props.href}
      class="font-semibold text-blue-600 hover:underline"
      onClick={(e) => props.onClick?.(e)}
    >
      {props.children}
    </a>
  )
}
