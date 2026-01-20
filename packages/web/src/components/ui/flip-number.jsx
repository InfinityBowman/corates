/**
 * FlipNumber - Animated number display using CountUp.js
 * Smoothly animates between numeric values with a counting effect
 */

import { createEffect, on, onCleanup, onMount } from 'solid-js';
import { CountUp } from 'countup.js';

/**
 * Animates between number values with a smooth counting effect
 * @param {Object} props
 * @param {number} props.value - The numeric value to display
 * @param {string} [props.prefix] - Prefix string (e.g., "$")
 * @param {number} [props.decimals] - Number of decimal places (default: 0)
 * @param {number} [props.duration] - Animation duration in seconds (default: 0.4)
 * @param {string} [props.class] - Additional CSS classes
 */
export default function FlipNumber(props) {
  let ref;
  let countUp;
  let currentDecimals;

  const createCountUp = (startVal, endVal, decimals) => {
    if (countUp) {
      countUp.reset();
    }
    countUp = new CountUp(ref, endVal, {
      startVal,
      decimalPlaces: decimals,
      duration: props.duration ?? 0.6,
      prefix: props.prefix ?? '',
      useEasing: true,
      useGrouping: true,
      separator: ',',
    });
    currentDecimals = decimals;
    if (!countUp.error) {
      countUp.start();
    }
  };

  onMount(() => {
    if (ref) {
      const decimals = props.decimals ?? 0;
      createCountUp(props.value, props.value, decimals);
    }
  });

  // Update when value or decimals change
  createEffect(
    on(
      () => [props.value, props.decimals ?? 0],
      ([newValue, newDecimals]) => {
        if (!ref) return;

        // If decimals changed, recreate the countup instance
        if (newDecimals !== currentDecimals) {
          const currentVal = countUp?.endVal ?? newValue;
          createCountUp(currentVal, newValue, newDecimals);
        } else if (countUp && !countUp.error) {
          countUp.update(newValue);
        }
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    if (countUp) {
      countUp.reset();
      countUp = null;
    }
  });

  // Format initial value for SSR/initial render
  const formatInitial = () => {
    const decimals = props.decimals ?? 0;
    const formatted = props.value.toFixed(decimals);
    return `${props.prefix ?? ''}${formatted}`;
  };

  return (
    <span ref={ref} class={props.class ?? ''}>
      {formatInitial()}
    </span>
  );
}
