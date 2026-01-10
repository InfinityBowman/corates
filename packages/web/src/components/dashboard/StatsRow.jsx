/**
 * StatsRow - Row of stat cards showing key metrics
 */

import { Show, For, useContext } from 'solid-js';
import { FiFolder, FiCheck, FiFileText, FiUsers } from 'solid-icons/fi';
import { AnimationContext } from './Dashboard.jsx';

/**
 * Individual stat card
 * @param {Object} props
 * @param {string} props.label - Stat label
 * @param {string|number} props.value - Main value to display
 * @param {string} [props.subtext] - Optional subtext
 * @param {JSX.Element} props.icon - Icon element
 * @param {string} [props.iconBg] - Background class for icon container
 * @param {number} [props.delay] - Animation delay in ms
 * @param {Object} [props.style] - Additional style object
 */
export function StatCard(props) {
  return (
    <div
      class='relative overflow-hidden rounded-xl border border-stone-200/60 bg-white p-5 transition-all duration-200 hover:shadow-md'
      style={props.style}
    >
      <div class='flex items-start justify-between'>
        <div>
          <p class='text-xs font-medium tracking-wide text-stone-400 uppercase'>{props.label}</p>
          <p class='mt-1 text-3xl font-semibold text-stone-800 tabular-nums'>{props.value}</p>
        </div>
        <div
          class={`flex h-10 w-10 items-center justify-center rounded-xl ${props.iconBg || 'bg-stone-100'}`}
        >
          {props.icon}
        </div>
      </div>
      <Show when={props.subtext}>
        <p class='mt-2 text-xs text-stone-500'>{props.subtext}</p>
      </Show>
    </div>
  );
}

/**
 * Stats row with computed metrics
 * @param {Object} props
 * @param {number} props.projectCount - Number of active projects
 * @param {number} props.completedStudies - Number of completed studies
 * @param {number} props.totalStudies - Total number of studies
 * @param {number} props.localAppraisalCount - Number of local appraisals
 */
export function StatsRow(props) {
  const animation = useContext(AnimationContext);
  const stats = () => [
    {
      label: 'Active Projects',
      value: props.projectCount,
      icon: <FiFolder class='h-5 w-5 text-blue-600' />,
      iconBg: 'bg-blue-50',
      delay: 0,
    },
    {
      label: 'Studies Reviewed',
      value: props.completedStudies,
      subtext: props.totalStudies > 0 ? `of ${props.totalStudies} total` : undefined,
      icon: <FiCheck class='h-5 w-5 text-emerald-600' />,
      iconBg: 'bg-emerald-50',
      delay: 50,
    },
    {
      label: 'Local Appraisals',
      value: props.localAppraisalCount,
      icon: <FiFileText class='h-5 w-5 text-amber-600' />,
      iconBg: 'bg-amber-50',
      delay: 100,
    },
    {
      label: 'Team Members',
      value: props.teamMemberCount || '-',
      subtext: props.teamMemberCount ? 'Across all projects' : undefined,
      icon: <FiUsers class='h-5 w-5 text-violet-600' />,
      iconBg: 'bg-violet-50',
      delay: 150,
    },
  ];

  return (
    <section class='mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4' style={animation.fadeUp(100)}>
      <For each={stats()}>
        {stat => (
          <StatCard
            label={stat.label}
            value={stat.value}
            subtext={stat.subtext}
            icon={stat.icon}
            iconBg={stat.iconBg}
            style={animation.statRise(stat.delay)}
          />
        )}
      </For>
    </section>
  );
}

export default StatsRow;
