/**
 * Shared billing utility functions
 */

export const formatUsd = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);

export function getAnnualSavings(plan: { price?: { monthly?: number; yearly?: number } | null }) {
  if (!plan.price?.monthly || !plan.price?.yearly) return null;
  const savings = plan.price.monthly * 12 - plan.price.yearly;
  return savings > 0 ? savings : null;
}
