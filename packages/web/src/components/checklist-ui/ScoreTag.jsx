import { Show } from 'solid-js';
import { FaSolidCircleInfo } from 'solid-icons/fa';
import { AMSTAR2_URL } from '@/config/api.js';
import Tooltip from '@/components/zag/Tooltip.jsx';

const scoreStyle = score => {
  switch (score) {
    case 'High':
      return 'bg-green-100 text-green-800';
    case 'Moderate':
      return 'bg-yellow-100 text-yellow-800';
    case 'Low':
      return 'bg-orange-100 text-orange-800';
    case 'Critically Low':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export default function ScoreTag(props) {
  return (
    <Show when={props.currentScore}>
      <span
        class={`px-2.5 py-1 text-xs font-medium rounded-full inline-flex items-center gap-1 ${scoreStyle(props.currentScore)}`}
      >
        <span>Score: {props.currentScore}</span>
        <Tooltip content='Open AMSTAR 2 scoring guide' placement='bottom' openDelay={200}>
          <a
            href={AMSTAR2_URL}
            target='_blank'
            rel='noreferrer'
            class='inline-flex items-center justify-center rounded-full p-0.5 mt-0.5 opacity-70 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
            aria-label='Open AMSTAR 2 guidance in a new tab'
          >
            <FaSolidCircleInfo size={12} />
          </a>
        </Tooltip>
      </span>
    </Show>
  );
}
