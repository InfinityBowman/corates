/**
 * useDebouncedSignal - Creates a signal with a debounced derived value
 *
 * Useful for search inputs and other cases where you want to delay
 * updates to a derived value (e.g., API queries) while allowing
 * immediate updates to the input value.
 *
 * @param {any} initialValue - Initial value for the signal
 * @param {number} delay - Debounce delay in milliseconds (default: 300)
 * @returns {[Accessor, Setter, Accessor]} - [value, setValue, debouncedValue]
 *
 * @example
 * const [search, setSearch, debouncedSearch] = useDebouncedSignal('', 300);
 *
 * // Use search for the input value (updates immediately)
 * <input value={search()} onInput={e => setSearch(e.target.value)} />
 *
 * // Use debouncedSearch for queries (updates after delay)
 * const query = useQuery(() => ({ search: debouncedSearch() }));
 */
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { debounce } from '@solid-primitives/scheduled';

export function useDebouncedSignal(initialValue = '', delay = 300) {
  const [value, setValue] = createSignal(initialValue);
  const [debouncedValue, setDebouncedValue] = createSignal(initialValue);

  // Create debounced setter for the debounced value
  const updateDebouncedValue = debounce((newValue) => {
    setDebouncedValue(newValue);
  }, delay);

  // Update debounced value whenever value changes
  createEffect(() => {
    const currentValue = value();
    updateDebouncedValue(currentValue);
  });

  onCleanup(() => {
    updateDebouncedValue.clear();
  });

  return [value, setValue, debouncedValue];
}
