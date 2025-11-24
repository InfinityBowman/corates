import { createSignal, createEffect, onCleanup, Show } from 'solid-js';

/**
 * AnimatedShow
 * Fade-in/fade-out animation with delayed unmount for conditional rendering.
 * @param {object} props
 * @param {boolean} props.when - Whether to show the element.
 * @param {number} [props.duration=300] - Animation duration in ms.
 * @param {string} [props.timingFunction='ease-in-out'] - CSS timing function.
 * @param {JSX.Element} [props.fallback] - Element to show when hidden.
 * @param {string} [props.ariaLive] - ARIA live region setting.
 * @param {string} [props.role] - ARIA role.
 * @returns {JSX.Element}
 */
export function AnimatedShow(props) {
  const [isVisible, setIsVisible] = createSignal(false);
  const [shouldRender, setShouldRender] = createSignal(false);
  let elementRef = null;
  let timeoutId = null;

  const duration = () => props.duration ?? 300;
  const timingFunction = () => props.timingFunction ?? 'ease-in-out';

  const when = () => props.when;

  createEffect(() => {
    if (when()) {
      // Ensure no pending timeout that could trigger after animation frame
      clearTimeout(timeoutId);
      // Show: first render, then fade in
      setShouldRender(true);
      // Use requestAnimationFrame to ensure element is rendered before starting animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      // Hide: first fade out, then stop rendering
      setIsVisible(false);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setShouldRender(false);
      }, duration());
    }
  });

  onCleanup(() => {
    clearTimeout(timeoutId);
  });

  return (
    <Show when={shouldRender()} fallback={props.fallback}>
      <div
        ref={elementRef}
        style={{
          opacity: isVisible() ? 1 : 0,
          transition: `opacity ${duration()}ms ${timingFunction()}`,
        }}
        aria-live={props.ariaLive || 'polite'}
        role={props.role || 'alert'}
        class={props.class || ''}
      >
        {props.children}
      </div>
    </Show>
  );
}

/**
 * AnimatedShowSlide
 * Fade and slide animation with delayed unmount for conditional rendering.
 * @param {object} props
 * @param {boolean} props.when - Whether to show the element.
 * @param {number} [props.duration=300] - Animation duration in ms.
 * @param {string} [props.timingFunction='ease-in-out'] - CSS timing function.
 * @param {'up'|'down'|'left'|'right'} [props.direction='up'] - Slide direction.
 * @param {JSX.Element} [props.fallback] - Element to show when hidden.
 * @returns {JSX.Element}
 */
export function AnimatedShowSlide(props) {
  const [isVisible, setIsVisible] = createSignal(false);
  const [shouldRender, setShouldRender] = createSignal(false);
  let timeoutId;

  const duration = () => props.duration ?? 300;
  const timingFunction = () => props.timingFunction ?? 'ease-in-out';
  const direction = () => props.direction ?? 'up';

  const getTransform = () => {
    if (isVisible()) return 'translate(0, 0)';

    switch (direction()) {
      case 'up':
        return 'translateY(20px)';
      case 'down':
        return 'translateY(-20px)';
      case 'left':
        return 'translateX(20px)';
      case 'right':
        return 'translateX(-20px)';
      default:
        return 'translateY(20px)';
    }
  };

  createEffect(() => {
    if (props.when) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setShouldRender(false);
      }, duration());
    }
  });

  onCleanup(() => {
    clearTimeout(timeoutId);
  });

  return (
    <>
      {shouldRender() && (
        <div
          style={{
            opacity: isVisible() ? 1 : 0,
            transform: getTransform(),
            transition: `opacity ${duration()}ms ${timingFunction()}, transform ${duration()}ms ${timingFunction()}`,
          }}
          aria-live={props.ariaLive || 'polite'}
          role={props.role || 'alert'}
        >
          {props.children}
        </div>
      )}
      {!props.when && props.fallback}
    </>
  );
}
