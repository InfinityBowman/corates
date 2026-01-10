/**
 * QuickActions - Quick start cards for creating new appraisals
 */

import { For, useContext } from 'solid-js';
import { FiPlayCircle, FiBook } from 'solid-icons/fi';

import { AnimationContext } from './Dashboard.jsx';

/**
 * Quick action button component
 * @param {Object} props
 * @param {string} props.title - Action title
 * @param {string} props.description - Action description
 * @param {JSX.Element} props.icon - Icon element
 * @param {string} props.iconBg - Background class for icon
 * @param {string} props.border - Border color class
 * @param {() => void} props.onClick - Click handler
 * @param {boolean} [props.disabled] - Whether action is disabled
 * @param {number} [props.delay] - Animation delay
 */
function QuickActionCard(props) {
  return (
    <button
      type='button'
      onClick={() => props.onClick?.()}
      disabled={props.disabled}
      class={`group flex items-center gap-4 rounded-xl border bg-white p-4 text-left transition-all duration-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${props.border}`}
    >
      <div
        class={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${props.iconBg} transition-transform duration-200 group-hover:scale-105`}
      >
        {props.icon}
      </div>
      <div>
        <h4 class='font-medium text-stone-800'>{props.title}</h4>
        <p class='text-sm text-stone-500'>{props.description}</p>
      </div>
    </button>
  );
}

/**
 * Quick actions section
 * @param {Object} props
 * @param {() => void} props.onStartROBINSI - Handler for starting ROBINS-I
 * @param {() => void} props.onStartAMSTAR2 - Handler for starting AMSTAR 2
 * @param {() => void} props.onLearnMore - Handler for learn more action
 * @param {boolean} [props.canCreate] - Whether user can create new appraisals
 */
export function QuickActions(props) {
  const animation = useContext(AnimationContext);

  const actions = () => [
    {
      id: 'robins-i',
      title: 'Start ROBINS-I',
      description: 'Risk of bias for non-randomized studies',
      icon: <FiPlayCircle class='h-6 w-6 text-blue-600' />,
      iconBg: 'bg-blue-50',
      border: 'border-blue-100 hover:border-blue-200',
      onClick: () => props.onStartROBINSI?.(),
      requiresCreate: true,
    },
    {
      id: 'amstar-2',
      title: 'Start AMSTAR 2',
      description: 'Quality assessment for systematic reviews',
      icon: <FiPlayCircle class='h-6 w-6 text-emerald-600' />,
      iconBg: 'bg-emerald-50',
      border: 'border-emerald-100 hover:border-emerald-200',
      onClick: () => props.onStartAMSTAR2?.(),
      requiresCreate: true,
    },
    {
      id: 'learn-more',
      title: 'Learn More',
      description: 'View documentation and guides',
      icon: <FiBook class='h-6 w-6 text-violet-600' />,
      iconBg: 'bg-violet-50',
      border: 'border-violet-100 hover:border-violet-200',
      onClick: () => props.onLearnMore?.(),
      requiresCreate: false,
    },
  ];

  return (
    <section class='mb-6' style={animation.fadeUp(400)}>
      <h3 class='mb-4 text-sm font-semibold tracking-wide text-stone-500 uppercase'>Quick Start</h3>
      <div class='grid gap-3'>
        <For each={actions()}>
          {action => (
            <QuickActionCard
              title={action.title}
              description={action.description}
              icon={action.icon}
              iconBg={action.iconBg}
              border={action.border}
              onClick={action.onClick}
              disabled={action.requiresCreate && !props.canCreate}
            />
          )}
        </For>
      </div>
    </section>
  );
}

export default QuickActions;
