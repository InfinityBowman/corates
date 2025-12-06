import { Show } from 'solid-js';

export default function ProjectHeader(props) {
  return (
    <div class='mb-8'>
      <div class='flex items-center gap-4 mb-2'>
        <button
          onClick={() => props.onBack()}
          class='text-gray-400 hover:text-gray-700 transition-colors'
        >
          <svg class='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path
              stroke-linecap='round'
              stroke-linejoin='round'
              stroke-width='2'
              d='M15 19l-7-7 7-7'
            />
          </svg>
        </button>
        <Show when={props.name}>
          <h1 class='text-2xl font-bold text-gray-900'>{props.name}</h1>
        </Show>
        <Show when={props.userRole}>
          <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize'>
            {props.userRole}
          </span>
        </Show>
      </div>
      <Show when={props.description}>
        <p class='text-gray-500 ml-10'>{props.description}</p>
      </Show>
    </div>
  );
}
