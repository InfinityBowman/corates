import { Show } from 'solid-js';
import { AnimatedShow } from '../AnimatedShow.jsx';
import { AiOutlineLoading3Quarters } from 'solid-icons/ai';

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
      class='w-full py-2 sm:py-3 text-sm sm:text-base bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg sm:rounded-xl shadow transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center'
      disabled={props.disabled || props.loading}
      onClick={props.onClick}
    >
      <AnimatedShow when={props.loading} fallback={props.children}>
        <div class='flex items-center'>
          <AiOutlineLoading3Quarters class='animate-spin mr-2' size={22} />
          {props.loadingText || 'Loading...'}
        </div>
      </AnimatedShow>
    </button>
  );
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
      class='w-full py-2 sm:py-3 text-sm sm:text-base border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg sm:rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed'
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
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
      class='text-blue-600 hover:underline font-semibold'
      onClick={props.onClick}
    >
      {props.children}
    </a>
  );
}
