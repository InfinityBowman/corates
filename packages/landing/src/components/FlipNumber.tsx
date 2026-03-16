/**
 * FlipNumber - Animated number display using CountUp.js
 * Smoothly animates between numeric values with a counting effect
 */

import { useRef, useEffect, useCallback } from 'react';
import { CountUp } from 'countup.js';

interface FlipNumberProps {
  value: number;
  prefix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export default function FlipNumber({
  value,
  prefix = '',
  decimals = 0,
  duration = 0.6,
  className = '',
}: FlipNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const countUpRef = useRef<CountUp | null>(null);
  const currentDecimalsRef = useRef<number>(decimals);
  const prevValueRef = useRef<number>(value);

  const createCountUp = useCallback(
    (startVal: number, endVal: number, dec: number) => {
      if (!ref.current) return;

      if (countUpRef.current) {
        countUpRef.current.reset();
      }

      const instance = new CountUp(ref.current, endVal, {
        startVal,
        decimalPlaces: dec,
        duration,
        prefix,
        useEasing: true,
        useGrouping: true,
        separator: ',',
      });

      currentDecimalsRef.current = dec;
      countUpRef.current = instance;

      if (!instance.error) {
        instance.start();
      }
    },
    [duration, prefix],
  );

  // Initialize on mount
  useEffect(() => {
    if (ref.current) {
      createCountUp(value, value, decimals);
    }

    return () => {
      if (countUpRef.current) {
        countUpRef.current.reset();
        countUpRef.current = null;
      }
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update when value or decimals change after initial mount
  useEffect(() => {
    if (!ref.current) return;

    // Skip the initial render since the mount effect handles it
    if (prevValueRef.current === value && currentDecimalsRef.current === decimals) {
      return;
    }

    if (decimals !== currentDecimalsRef.current) {
      const currentVal = (countUpRef.current as any)?.endVal ?? value;
      createCountUp(currentVal, value, decimals);
    } else if (countUpRef.current && !countUpRef.current.error) {
      countUpRef.current.update(value);
    }

    prevValueRef.current = value;
  }, [value, decimals, createCountUp]);

  // Format initial value for SSR/initial render
  const formatInitial = () => {
    const formatted = value.toFixed(decimals);
    return `${prefix}${formatted}`;
  };

  return (
    <span ref={ref} className={className}>
      {formatInitial()}
    </span>
  );
}
