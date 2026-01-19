import { Show } from 'solid-js';

/**
 * Google sign in/up button
 * @param {Object} props
 * @param {boolean} props.loading - Whether the button is in loading state
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.iconOnly - Show only icon (for compact layout)
 */
export function GoogleButton(props) {
  const baseClass =
    'border border-border hover:bg-muted text-secondary-foreground font-semibold rounded-lg sm:rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center';

  return (
    <Show
      when={props.iconOnly}
      fallback={
        <button
          type='button'
          onClick={() => props.onClick?.()}
          disabled={props.loading}
          class={`${baseClass} w-full gap-3 py-2.5 text-sm sm:py-3 sm:text-base`}
        >
          <Show
            when={props.loading}
            fallback={<img src='/logos/google.svg' alt='' class='h-5 w-5' aria-hidden='true' />}
          >
            <div
              role='status'
              aria-label='Signing in with Google'
              class='border-border border-t-secondary-foreground h-5 w-5 animate-spin rounded-full border-2'
            />
          </Show>
          Continue with Google
        </button>
      }
    >
      <button
        type='button'
        onClick={() => props.onClick?.()}
        disabled={props.loading}
        class={`${baseClass} p-3 sm:p-3.5`}
        title='Continue with Google'
        aria-label='Continue with Google'
      >
        <Show
          when={props.loading}
          fallback={
            <img src='/logos/google.svg' alt='' class='h-5 w-5 sm:h-6 sm:w-6' aria-hidden='true' />
          }
        >
          <div
            role='status'
            aria-label='Signing in with Google'
            class='border-border border-t-secondary-foreground h-5 w-5 animate-spin rounded-full border-2 sm:h-6 sm:w-6'
          />
        </Show>
      </button>
    </Show>
  );
}

/**
 * ORCID sign in/up button for researcher authentication
 * @param {Object} props
 * @param {boolean} props.loading - Whether the button is in loading state
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.iconOnly - Show only icon (for compact layout)
 */
export function OrcidButton(props) {
  const baseClass =
    'border border-border hover:bg-muted text-secondary-foreground font-semibold rounded-lg sm:rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center';

  return (
    <Show
      when={props.iconOnly}
      fallback={
        <button
          type='button'
          onClick={() => props.onClick?.()}
          disabled={props.loading}
          class={`${baseClass} w-full gap-3 py-2.5 text-sm sm:py-3 sm:text-base`}
        >
          <Show
            when={props.loading}
            fallback={<img src='/logos/orcid.svg' alt='' class='h-5 w-5' aria-hidden='true' />}
          >
            <div
              role='status'
              aria-label='Signing in with ORCID'
              class='border-border border-t-secondary-foreground h-5 w-5 animate-spin rounded-full border-2'
            />
          </Show>
          Continue with ORCID
        </button>
      }
    >
      <button
        type='button'
        onClick={() => props.onClick?.()}
        disabled={props.loading}
        class={`${baseClass} p-3 sm:p-3.5`}
        title='Continue with ORCID'
        aria-label='Continue with ORCID'
      >
        <Show
          when={props.loading}
          fallback={
            <img src='/logos/orcid.svg' alt='' class='h-5 w-5 sm:h-6 sm:w-6' aria-hidden='true' />
          }
        >
          <div
            role='status'
            aria-label='Signing in with ORCID'
            class='border-border border-t-secondary-foreground h-5 w-5 animate-spin rounded-full border-2 sm:h-6 sm:w-6'
          />
        </Show>
      </button>
    </Show>
  );
}

/**
 * Container for multiple social auth buttons
 * Automatically switches between horizontal icons and vertical full buttons
 * @param {Object} props
 * @param {JSX.Element} props.children - Social auth buttons
 * @param {number} props.buttonCount - Number of buttons (used for layout decisions)
 */
export function SocialAuthContainer(props) {
  // Use compact horizontal layout when there are multiple providers
  const isCompact = () => (props.buttonCount || 1) > 1;

  return <div class={isCompact() ? 'flex justify-center gap-3' : 'w-full'}>{props.children}</div>;
}

/**
 * Divider between social and email auth
 */
export function AuthDivider() {
  return (
    <div class='relative my-4 sm:my-5'>
      <div class='absolute inset-0 flex items-center'>
        <div class='border-border w-full border-t' />
      </div>
      <div class='relative flex justify-center text-xs sm:text-sm'>
        <span class='bg-card text-muted-foreground px-3'>or</span>
      </div>
    </div>
  );
}
