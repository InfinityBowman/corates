/**
 * Store for reconciliation navbar state
 * Using a store provides deep reactivity for nested state updates
 */
import { createStore } from 'solid-js/store';

/**
 * Create a reconciliation navbar store
 * @returns {[Object, Function]} Store state and setter
 */
export function createNavbarStore() {
  const [store, setStore] = createStore({
    questionKeys: [],
    viewMode: 'questions',
    currentPage: 0,
    comparisonByQuestion: {},
    finalAnswers: {},
    summary: null,
    reviewedCount: 0,
    totalPages: 0,
    // Functions stored as references (not reactive)
    setViewMode: null,
    goToQuestion: null,
    onReset: null,
  });

  return [store, setStore];
}
