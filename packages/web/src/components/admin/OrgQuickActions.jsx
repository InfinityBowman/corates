/**
 * Org Quick Actions component
 * Provides quick action buttons for common billing operations
 */

import { FiPlus } from 'solid-icons/fi';

export default function OrgQuickActions(props) {
  const loading = () => props.loading;
  const onGrantTrial = () => props.onGrantTrial;
  const onGrantSingleProject = () => props.onGrantSingleProject;
  const onCreateSubscription = () => props.onCreateSubscription;
  const onCreateGrant = () => props.onCreateGrant;

  return (
    <div class='rounded-lg border border-gray-200 bg-white p-6'>
      <h2 class='mb-4 text-lg font-semibold text-gray-900'>Quick Actions</h2>
      <div class='flex flex-wrap gap-3'>
        <button
          onClick={onGrantTrial()}
          disabled={loading()}
          class='inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
        >
          <FiPlus class='h-4 w-4' />
          <span>Grant Trial (14 days)</span>
        </button>
        <button
          onClick={onGrantSingleProject()}
          disabled={loading()}
          class='inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
        >
          <FiPlus class='h-4 w-4' />
          <span>Grant Single Project (6 months)</span>
        </button>
        <button
          onClick={onCreateSubscription()}
          disabled={loading()}
          class='inline-flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
        >
          <FiPlus class='h-4 w-4' />
          <span>Create Subscription</span>
        </button>
        <button
          onClick={onCreateGrant()}
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
