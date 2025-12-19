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
    <div class='rounded-lg border border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50 p-4'>
      <div class='flex items-start space-x-3'>
        <div class='shrink-0'>
          <div class='flex h-10 w-10 items-center justify-center rounded-full bg-blue-100'>
            <FiZap class='h-5 w-5 text-blue-600' />
          </div>
        </div>
        <div class='min-w-0 flex-1'>
          <h3 class='text-sm font-medium text-gray-900'>
            Upgrade to {tierNames[requiredTier()] ?? 'Pro'}
          </h3>
          <p class='mt-1 text-sm text-gray-600'>
            {props.message ??
              `Unlock ${feature()} and more with a ${tierNames[requiredTier()] ?? 'Pro'} subscription.`}
          </p>
          <Show when={props.onUpgrade}>
            <button
              type='button'
              class='mt-3 inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700'
              onClick={() => props.onUpgrade()}
            >
              <FiZap class='mr-1 h-4 w-4' />
              Upgrade Now
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
