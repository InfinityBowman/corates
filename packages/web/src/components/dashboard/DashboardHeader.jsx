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
    // Use structured givenName if available, fallback to name
    if (props.user?.givenName) return props.user.givenName;
    return props.user?.name || '';
  };

  return (
    <header class='mb-10' style={animation.fadeUp(0)}>
      <div class='flex items-start justify-between'>
        <div>
          <Show
            when={firstName()}
            fallback={<p class='text-primary mb-1 text-sm font-medium'>Welcome to CoRATES!</p>}
          >
            <p class='text-primary mb-1 text-sm font-medium'>Welcome back,</p>
            <h1 class='text-foreground text-3xl font-semibold tracking-tight sm:text-4xl'>
              {firstName()}
            </h1>
          </Show>
          <Show when={props.user?.persona || props.user?.email}>
            <p class='text-muted-foreground mt-2'>
              {props.user?.persona ? getRoleLabel(props.user.persona) : props.user.email}
            </p>
          </Show>
        </div>
        <div class='flex items-center gap-3'>
          <Show when={props.onSearch}>
            <button
              onClick={() => props.onSearch?.()}
              class='border-border text-secondary-foreground hover:border-border hidden items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-medium shadow-sm transition-all hover:shadow sm:flex'
            >
              <FiSearch class='h-4 w-4' />
              <span>Search</span>
              <kbd class='bg-secondary text-muted-foreground/70 ml-2 hidden rounded px-1.5 py-0.5 text-xs lg:inline'>
                /
              </kbd>
            </button>
          </Show>
          <Show when={props.canCreateProject}>
            <button
              onClick={() => props.onCreateProject?.()}
              disabled={!props.isOnline}
              title={!props.isOnline ? 'Cannot create projects while offline' : ''}
              class='bg-primary hover:bg-primary/90 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50'
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
