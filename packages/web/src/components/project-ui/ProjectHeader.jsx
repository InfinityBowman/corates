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
        <Show when={props.isConnected}>
          <span class='flex items-center gap-1 text-green-600 text-sm'>
            <div class='w-2 h-2 bg-green-500 rounded-full' />
            Synced
          </span>
        </Show>
        <div class='flex-1' />
        <Show when={props.isOwner}>
          <button
            onClick={() => props.onDeleteProject()}
            class='inline-flex items-center px-3 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors gap-1.5'
            title='Delete Project'
          >
            <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
              />
            </svg>
            Delete Project
          </button>
        </Show>
      </div>
      <Show when={props.description}>
        <p class='text-gray-500 ml-10'>{props.description}</p>
      </Show>
    </div>
  );
}
