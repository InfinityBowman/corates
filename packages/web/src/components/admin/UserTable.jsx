/**
 * User Table component for admin dashboard
 * Simple table listing users with links to detail pages
 */

import { Show, For } from 'solid-js';
import { A } from '@solidjs/router';
import { FiCheckCircle, FiMail } from 'solid-icons/fi';
import { Avatar, Tooltip } from '@corates/ui';
import { table, getStatusBadgeClass } from './styles/admin-tokens.js';

// Provider display info
const PROVIDER_INFO = {
  google: { name: 'Google', icon: '/logos/google.svg' },
  orcid: { name: 'ORCID', icon: '/logos/orcid.svg' },
  credential: { name: 'Email/Password', icon: null },
};

/**
 * User Table component for admin dashboard
 * Lists all users with search and pagination
 * @param {object} props - Component props
 * @param {Array<object>} props.users - Array of user objects
 * @returns {JSX.Element} - The UserTable component
 */
export default function UserTable(props) {
  const users = () => props.users || [];

  const formatDate = timestamp => {
    if (!timestamp) return '-';
    // Handle both ISO strings and unix timestamps
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div class='overflow-x-auto'>
      <table class={table.base}>
        <thead>
          <tr class={table.header}>
            <th class={table.headerCell}>User</th>
            <th class={table.headerCell}>Email</th>
            <th class={table.headerCell}>Providers</th>
            <th class={table.headerCell}>Status</th>
            <th class={table.headerCell}>Stripe Customer</th>
            <th class={table.headerCell}>Joined</th>
          </tr>
        </thead>
        <tbody class={table.body}>
          <For
            each={users()}
            fallback={
              <tr>
                <td colspan='6' class='px-6 py-12 text-center text-gray-500'>
                  No users found
                </td>
              </tr>
            }
          >
            {user => (
              <tr class={table.row}>
                <td class='px-6 py-4'>
                  <div class='flex items-center space-x-3'>
                    <Avatar
                      src={user.avatarUrl || user.image}
                      name={user.displayName || user.name}
                      class='h-8 w-8'
                    />
                    <div>
                      <A
                        href={`/admin/users/${user.id}`}
                        class='font-medium text-blue-600 hover:text-blue-700 hover:underline'
                      >
                        {user.displayName || user.name || 'Unknown'}
                      </A>
                      <Show when={user.username}>
                        <p class='text-sm text-gray-500'>@{user.username}</p>
                      </Show>
                    </div>
                  </div>
                </td>
                <td class={table.cell}>
                  <div class='flex items-center space-x-2'>
                    <span class='text-sm text-gray-500'>{user.email}</span>
                    <Show when={user.emailVerified}>
                      <FiCheckCircle class='h-4 w-4 text-green-500' title='Email verified' />
                    </Show>
                  </div>
                </td>
                <td class={table.cell}>
                  <div class='flex items-center gap-1.5'>
                    <For each={user.providers || []}>
                      {provider => {
                        const info = PROVIDER_INFO[provider];
                        return (
                          <Tooltip content={info?.name || provider}>
                            <div class='flex h-5 w-5 items-center justify-center'>
                              <Show
                                when={info?.icon}
                                fallback={<FiMail class='h-4 w-4 text-gray-500' />}
                              >
                                <img
                                  src={info?.icon}
                                  alt={info?.name || provider}
                                  title={info?.name || provider}
                                  class='h-4 w-4'
                                />
                              </Show>
                            </div>
                          </Tooltip>
                        );
                      }}
                    </For>
                    <Show when={!user.providers || user.providers.length === 0}>
                      <span class='text-xs text-gray-400'>None</span>
                    </Show>
                  </div>
                </td>
                <td class={table.cell}>
                  <Show
                    when={user.banned}
                    fallback={<span class={getStatusBadgeClass('success')}>Active</span>}
                  >
                    <span class={getStatusBadgeClass('error')}>Banned</span>
                  </Show>
                </td>
                <td class={table.cell}>
                  <Show
                    when={user.stripeCustomerId}
                    fallback={<span class='text-sm text-gray-400'>-</span>}
                  >
                    <code class='rounded bg-gray-100 px-2 py-1 text-xs text-gray-700'>
                      {user.stripeCustomerId}
                    </code>
                  </Show>
                </td>
                <td class={`${table.cell} text-gray-500`}>{formatDate(user.createdAt)}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
