/**
 * Stripe-specific error messages for user-friendly display
 * Maps Stripe error codes and decline codes to actionable messages
 */

/**
 * User-friendly messages for Stripe card errors
 */
export const STRIPE_ERROR_MESSAGES: Record<string, string> = {
  // Card decline codes
  card_declined: 'Your card was declined. Please try a different payment method.',
  generic_decline: 'Your card was declined. Please try a different payment method.',
  insufficient_funds: 'Insufficient funds. Please try a different card.',
  lost_card: 'This card has been reported lost. Please use a different card.',
  stolen_card: 'This card has been reported stolen. Please use a different card.',
  expired_card: 'Your card has expired. Please use a different card.',
  incorrect_cvc: 'The security code (CVC) is incorrect. Please check and try again.',
  incorrect_number: 'The card number is incorrect. Please check and try again.',
  incorrect_zip: 'The postal code is incorrect. Please check and try again.',
  invalid_cvc: 'The security code (CVC) is invalid. Please check and try again.',
  invalid_expiry_month: 'The expiration month is invalid.',
  invalid_expiry_year: 'The expiration year is invalid.',
  invalid_number: 'The card number is invalid. Please check and try again.',
  postal_code_invalid: 'The postal code is invalid.',

  // Processing errors
  processing_error: 'An error occurred while processing your card. Please try again.',
  card_not_supported: 'This card is not supported. Please try a different card.',
  currency_not_supported: 'This currency is not supported by your card.',
  duplicate_transaction: 'A duplicate transaction was detected. Please wait a moment.',

  // Authentication
  authentication_required:
    'Additional authentication is required. Please complete the verification.',
  card_velocity_exceeded: 'Too many transactions. Please wait and try again later.',

  // Rate limits
  rate_limit: 'Too many requests. Please wait a moment and try again.',

  // Fraud
  fraudulent: 'This transaction was flagged as potentially fraudulent.',
  merchant_blacklist: 'This card cannot be used for this purchase.',

  // Setup errors
  setup_intent_authentication_failure: 'Card authentication failed. Please try again.',

  // Default fallback
  default: 'Payment failed. Please try again or use a different payment method.',
};

/**
 * Get a user-friendly error message for a Stripe error
 * @param error - Stripe error object or error-like object with code/decline_code
 * @returns User-friendly error message
 */
export function getStripeErrorMessage(error: {
  code?: string;
  decline_code?: string;
  message?: string;
}): string {
  // Check decline_code first (more specific)
  if (error.decline_code && STRIPE_ERROR_MESSAGES[error.decline_code]) {
    return STRIPE_ERROR_MESSAGES[error.decline_code];
  }

  // Then check error code
  if (error.code && STRIPE_ERROR_MESSAGES[error.code]) {
    return STRIPE_ERROR_MESSAGES[error.code];
  }

  // Return default message
  return STRIPE_ERROR_MESSAGES.default;
}

/**
 * Check if an error is a Stripe card error
 * Stripe card errors have type === 'card_error'
 */
export function isStripeCardError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as { type: string }).type === 'card_error'
  );
}

/**
 * Check if an error is a Stripe rate limit error
 * Stripe rate limit errors have type === 'rate_limit_error'
 */
export function isStripeRateLimitError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as { type: string }).type === 'rate_limit_error'
  );
}
