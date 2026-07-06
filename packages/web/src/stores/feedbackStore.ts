/**
 * feedbackStore - Global open/close state for the in-app feedback dialog
 *
 * The dialog is mounted once in the root layout; entry points (navbar
 * dropdown, early access banner) open it through this store.
 */

import { create } from 'zustand';

interface FeedbackState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useFeedbackStore = create<FeedbackState>()(set => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
