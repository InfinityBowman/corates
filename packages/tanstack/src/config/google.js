/**
 * Google Configuration (Vite)
 *
 * These are only used client-side for Google Picker.
 *
 * Required for Picker:
 * - VITE_GOOGLE_PICKER_API_KEY (aka "Developer Key" / API key)
 * Optional:
 * - VITE_GOOGLE_PICKER_APP_ID (Google Cloud project number)
 */

export const GOOGLE_PICKER_API_KEY = import.meta.env.VITE_GOOGLE_PICKER_API_KEY
export const GOOGLE_PICKER_APP_ID = import.meta.env.VITE_GOOGLE_PICKER_APP_ID
