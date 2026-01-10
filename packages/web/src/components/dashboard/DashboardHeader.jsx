/**
 * DashboardHeader - Welcome section with user info and actions
 */

import { Show, useContext } from 'solid-js';
import { FiPlus, FiSearch } from 'solid-icons/fi';
import { getRoleLabel } from '@/components/auth/RoleSelector.jsx';
import { AnimationContext } from './Dashboard.jsx';

/**
 * @param {Object} props
 * @param {Object} props.user - User object { name, email, image }
 * @param {boolean} props.canCreateProject - Whether user can create projects
 * @param {boolean} props.isOnline - Whether user is online
 * @param {Function} props.onCreateProject - Called when create project button clicked
 * @param {Function} props.onSearch - Called when search button clicked (optional)
 */
export function DashboardHeader(props) {
  const animation = useContext(AnimationContext);
  const firstName = () => {
    const name = props.user?.name || '';
    return name.split(' ')[0] || '';
  };

  return (
    <header class='mb-10' style={animation.fadeUp(0)}>
      <div class='flex items-start justify-between'>
        <div>
          <Show
            when={firstName()}
            fallback={<p class='mb-1 text-sm font-medium text-blue-600'>Welcome to CoRATES!</p>}
          >
            <p class='mb-1 text-sm font-medium text-blue-600'>Welcome back,</p>
            <h1 class='text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl'>
              {firstName()}
            </h1>
          </Show>
          <Show when={props.user?.persona || props.user?.email}>
            <p class='mt-2 text-stone-500'>
              {props.user?.persona ? getRoleLabel(props.user.persona) : props.user.email}
            </p>
          </Show>
        </div>
        <div class='flex items-center gap-3'>
          <Show when={props.onSearch}>
            <button
              onClick={() => props.onSearch?.()}
              class='hidden items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 shadow-sm transition-all hover:border-stone-300 hover:shadow sm:flex'
            >
              <FiSearch class='h-4 w-4' />
              <span>Search</span>
              <kbd class='ml-2 hidden rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-400 lg:inline'>
                /
              </kbd>
            </button>
          </Show>
          <Show when={props.canCreateProject}>
            <button
              onClick={() => props.onCreateProject?.()}
              disabled={!props.isOnline}
              title={!props.isOnline ? 'Cannot create projects while offline' : ''}
              class='flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50'
            >
              <FiPlus class='h-4 w-4' />
              New Project
            </button>
          </Show>
        </div>
      </div>
    </header>
  );
}

export default DashboardHeader;
