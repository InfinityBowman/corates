/**
 * UpgradePrompt Component
 * A small prompt to encourage users to upgrade
 */

import { Show } from 'solid-js';
import { FiZap } from 'solid-icons/fi';

export default function UpgradePrompt(props) {
  const feature = () => props.feature ?? 'this feature';
  const requiredTier = () => props.requiredTier ?? 'pro';

  const tierNames = {
    pro: 'Pro',
    team: 'Team',
    enterprise: 'Enterprise',
  };

  return (
    <div class='bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4'>
      <div class='flex items-start space-x-3'>
        <div class='shrink-0'>
          <div class='w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center'>
            <FiZap class='w-5 h-5 text-blue-600' />
          </div>
        </div>
        <div class='flex-1 min-w-0'>
          <h3 class='text-sm font-medium text-gray-900'>
            Upgrade to {tierNames[requiredTier()] ?? 'Pro'}
          </h3>
          <p class='text-sm text-gray-600 mt-1'>
            {props.message ??
              `Unlock ${feature()} and more with a ${tierNames[requiredTier()] ?? 'Pro'} subscription.`}
          </p>
          <Show when={props.onUpgrade}>
            <button
              type='button'
              class='mt-3 inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors'
              onClick={() => props.onUpgrade()}
            >
              <FiZap class='w-4 h-4 mr-1' />
              Upgrade Now
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
