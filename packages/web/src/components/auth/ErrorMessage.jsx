import { AnimatedShow } from '../AnimatedShow.jsx';

/**
 * Error message component with proper accessibility attributes
 * AnimatedShow already provides role="alert" and aria-live by default
 * @param {Object} props
 * @param {Function} props.displayError - Signal returning error string or null
 * @param {string} props.id - Optional ID for aria-describedby linking
 */
export default function ErrorMessage(props) {
  return (
    <AnimatedShow when={!!props.displayError()} role='alert' ariaLive='assertive'>
      <div
        id={props.id}
        class='mt-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 sm:text-sm'
      >
        {props.displayError()}
      </div>
    </AnimatedShow>
  );
}
