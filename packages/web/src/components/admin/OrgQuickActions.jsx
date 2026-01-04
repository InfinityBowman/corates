/**
 * Org Quick Actions component
 * Provides quick action buttons for common billing operations
 */

import { FiPlus } from 'solid-icons/fi';

/**
 * Org Quick Actions component
 * Provides quick action buttons for common billing operations
 * @param {object} props - Component props
 * @param {function(): void} props.onGrantTrial - Function to grant a 14-day trial
 * @param {function(): void} props.onGrantSingleProject - Function to grant single project access (6 months)
 * @param {function(): void} props.onCreateSubscription - Function to open subscription creation dialog
 * @param {function(): void} props.onCreateGrant - Function to open grant creation dialog
 * @param {boolean} [props.loading] - Whether any action is in progress
 * @returns {JSX.Element} - The OrgQuickActions component
 */
export default function OrgQuickActions(props) {
  const loading = () => props.loading;

  return (
    <div class='rounded-lg border border-gray-200 bg-white p-6'>
      <h2 class='mb-4 text-lg font-semibold text-gray-900'>Quick Actions</h2>
      <div class='flex flex-wrap gap-3'>
        <button
          onClick={() => props.onGrantTrial?.()}
          disabled={loading()}
          class='inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
        >
          <FiPlus class='h-4 w-4' />
          <span>Grant Trial (14 days)</span>
        </button>
        <button
          onClick={() => props.onGrantSingleProject?.()}
          disabled={loading()}
          class='inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
        >
          <FiPlus class='h-4 w-4' />
          <span>Grant Single Project (6 months)</span>
        </button>
        <button
          onClick={() => props.onCreateSubscription?.()}
          disabled={loading()}
          class='inline-flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
        >
          <FiPlus class='h-4 w-4' />
          <span>Create Subscription</span>
        </button>
        <button
          onClick={() => props.onCreateGrant?.()}
          disabled={loading()}
          class='inline-flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
        >
          <FiPlus class='h-4 w-4' />
          <span>Create Grant</span>
        </button>
      </div>
    </div>
  );
}
