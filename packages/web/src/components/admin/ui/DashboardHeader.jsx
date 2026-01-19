/**
 * DashboardHeader - Consistent page header for admin views
 *
 * Provides a standardized header layout with icon, title, description,
 * and optional action buttons. Based on Polar's page header pattern.
 *
 * @example
 * <DashboardHeader
 *   icon={FiUsers}
 *   title="User Management"
 *   description="View and manage all system users"
 *   actions={<Button>Add User</Button>}
 * />
 */

import { Show } from 'solid-js';

/**
 * @param {Object} props
 * @param {import('solid-icons').IconTypes} [props.icon] - Icon component to display
 * @param {string} props.title - Page title
 * @param {string} [props.description] - Optional description text
 * @param {JSX.Element} [props.actions] - Optional action buttons/elements
 * @param {'blue'|'green'|'purple'|'orange'|'red'|'gray'} [props.iconColor='blue'] - Icon background color
 * @param {string} [props.class] - Additional CSS classes
 */
export function DashboardHeader(props) {
  const iconColorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600',
    gray: 'bg-secondary text-muted-foreground',
  };

  const iconBgClass = () => iconColorClasses[props.iconColor || 'blue'];

  return (
    <div class={`mb-8 flex items-center justify-between ${props.class || ''}`}>
      <div class='flex items-center gap-3'>
        <Show when={props.icon}>
          <div class={`rounded-xl p-2.5 ${iconBgClass()}`}>
            <props.icon class='h-6 w-6' />
          </div>
        </Show>
        <div>
          <h1 class='text-foreground text-2xl font-bold'>{props.title}</h1>
          <Show when={props.description}>
            <p class='text-muted-foreground text-sm'>{props.description}</p>
          </Show>
        </div>
      </div>
      <Show when={props.actions}>
        <div class='flex items-center gap-3'>{props.actions}</div>
      </Show>
    </div>
  );
}

export default DashboardHeader;
