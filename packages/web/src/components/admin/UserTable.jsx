/**
 * User Table component for admin dashboard
 * Simple table listing users with links to detail pages
 */

import { Show, For } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { FiCheckCircle, FiMail } from 'solid-icons/fi';
import { Avatar } from '@corates/ui';
import {
  Tooltip,
  TooltipTrigger,
  TooltipPositioner,
  TooltipContent,
} from '@/components/ui/tooltip';
import { AdminDataTable } from './ui/index.js';
import { getStatusBadgeClass } from './styles/admin-tokens.js';

// Provider display info
const PROVIDER_INFO = {
  google: { name: 'Google', icon: '/logos/google.svg' },
  orcid: { name: 'ORCID', icon: '/logos/orcid.svg' },
  credential: { name: 'Email/Password', icon: null },
};

const formatDate = timestamp => {
  if (!timestamp) return '-';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * User Table component for admin dashboard
 * Lists all users with search and pagination
 * @param {object} props - Component props
 * @param {Array<object>} props.users - Array of user objects
 * @param {boolean} [props.loading] - Loading state
 * @returns {JSX.Element} - The UserTable component
 */
export default function UserTable(props) {
  const navigate = useNavigate();

  const columns = [
    {
      accessorKey: 'name',
      header: 'User',
      cell: info => {
        const user = info.row.original;
        return (
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
                onClick={e => e.stopPropagation()}
              >
                {user.displayName || user.name || 'Unknown'}
              </A>
              <Show when={user.username}>
                <p class='text-sm text-gray-500'>@{user.username}</p>
              </Show>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: info => {
        const user = info.row.original;
        return (
          <div class='flex items-center space-x-2'>
            <span class='text-sm text-gray-500'>{user.email}</span>
            <Show when={user.emailVerified}>
              <FiCheckCircle class='h-4 w-4 text-green-500' title='Email verified' />
            </Show>
          </div>
        );
      },
    },
    {
      accessorKey: 'providers',
      header: 'Providers',
      cell: info => {
        const user = info.row.original;
        return (
          <div class='flex items-center gap-1.5'>
            <For each={user.providers || []}>
              {provider => {
                const providerInfo = PROVIDER_INFO[provider];
                return (
                  <Tooltip>
                    <TooltipTrigger>
                      <div class='flex h-5 w-5 items-center justify-center'>
                        <Show
                          when={providerInfo?.icon}
                          fallback={<FiMail class='h-4 w-4 text-gray-500' />}
                        >
                          <img
                            src={providerInfo?.icon}
                            alt={providerInfo?.name || provider}
                            title={providerInfo?.name || provider}
                            class='h-4 w-4'
                          />
                        </Show>
                      </div>
                    </TooltipTrigger>
                    <TooltipPositioner>
                      <TooltipContent>{providerInfo?.name || provider}</TooltipContent>
                    </TooltipPositioner>
                  </Tooltip>
                );
              }}
            </For>
            <Show when={!user.providers || user.providers.length === 0}>
              <span class='text-xs text-gray-400'>None</span>
            </Show>
          </div>
        );
      },
    },
    {
      accessorKey: 'banned',
      header: 'Status',
      cell: info => {
        const user = info.row.original;
        return (
          <Show
            when={user.banned}
            fallback={<span class={getStatusBadgeClass('success')}>Active</span>}
          >
            <span class={getStatusBadgeClass('error')}>Banned</span>
          </Show>
        );
      },
    },
    {
      accessorKey: 'stripeCustomerId',
      header: 'Stripe Customer',
      cell: info => {
        const value = info.getValue();
        return (
          <Show when={value} fallback={<span class='text-sm text-gray-400'>-</span>}>
            <code class='rounded bg-gray-100 px-2 py-1 text-xs text-gray-700'>{value}</code>
          </Show>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Joined',
      cell: info => <span class='text-gray-500'>{formatDate(info.getValue())}</span>,
    },
  ];

  return (
    <AdminDataTable
      columns={columns}
      data={props.users || []}
      loading={props.loading}
      emptyMessage='No users found'
      enableSorting
      enablePagination
      pageSize={20}
      onRowClick={row => navigate(`/admin/users/${row.id}`)}
    />
  );
}
