/**
 * AccountProviderCard - Displays a single linked authentication provider
 *
 * Shows provider info (name, icon, email/id) and provides unlink action
 * when allowed. Handles loading states and accessibility.
 */

import { Show, createMemo } from 'solid-js'
import { FiMail, FiTrash2, FiCheck, FiExternalLink } from 'solid-icons/fi'
import { Tooltip } from '@corates/ui'

/**
 * Format ORCID ID for display (add hyphens if not present)
 * @param {string} id - The ORCID ID
 * @returns {string} Formatted ORCID ID (e.g., "0000-0001-2345-6789")
 */
function formatOrcidId(id) {
  if (!id) return ''
  // If already formatted with hyphens, return as-is
  if (id.includes('-')) return id
  // Format as XXXX-XXXX-XXXX-XXXX (last char can be X for checksum)
  return id.replace(/(\d{4})(\d{4})(\d{4})(\d{3}[\dXx])/, '$1-$2-$3-$4')
}

export default function AccountProviderCard(props) {
  // Format the account identifier for display
  const displayId = createMemo(() => {
    if (props.account.providerId === 'credential') {
      return props.account.email || 'Email/Password'
    }
    if (props.account.providerId === 'orcid') {
      return formatOrcidId(props.account.accountId)
    }
    return props.account.email || props.account.accountId
  })

  const linkedDate = createMemo(() => {
    if (!props.account.createdAt) return null
    const date = new Date(
      typeof props.account.createdAt === 'number'
        ? props.account.createdAt * 1000 // Unix timestamp in seconds
        : props.account.createdAt,
    )
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  })

  const isCredential = createMemo(
    () => props.account.providerId === 'credential',
  )
  const isOrcid = createMemo(() => props.account.providerId === 'orcid')

  // ORCID profile link
  const orcidProfileUrl = createMemo(() => {
    if (!isOrcid()) return null
    const id = formatOrcidId(props.account.accountId)
    return `https://orcid.org/${id}`
  })

  return (
    <div class="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div class="flex items-center gap-3">
        {/* Provider icon */}
        <div class="rounded-lg border border-gray-200 bg-white p-2">
          <Show
            when={props.provider?.icon}
            fallback={<FiMail class="h-5 w-5 text-gray-600" />}
          >
            <img
              src={props.provider.icon}
              alt={props.provider?.name}
              class="h-5 w-5"
            />
          </Show>
        </div>

        {/* Provider info */}
        <div>
          <div class="flex items-center gap-2">
            <p class="font-medium text-gray-900">
              {props.provider?.name || props.account.providerId}
            </p>
            <Show when={isCredential()}>
              <span class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                <FiCheck class="h-3 w-3" />
                Primary
              </span>
            </Show>
          </div>

          <div class="flex items-center gap-1">
            <p class="text-sm text-gray-500">{displayId()}</p>
            <Show when={isOrcid() && orcidProfileUrl()}>
              <a
                href={orcidProfileUrl()}
                target="_blank"
                rel="noopener noreferrer"
                class="text-gray-400 transition-colors hover:text-gray-600"
                aria-label="View ORCID profile"
              >
                <FiExternalLink class="h-3.5 w-3.5" />
              </a>
            </Show>
          </div>

          <Show when={linkedDate()}>
            <p class="mt-0.5 text-xs text-gray-400">Linked on {linkedDate()}</p>
          </Show>
        </div>
      </div>

      {/* Unlink button - only show if can unlink and not credential */}
      <Show
        when={props.canUnlink}
        fallback={
          <Show when={!isCredential()}>
            <Tooltip content="Can't unlink your only sign-in method. Link another account first.">
              <span class="cursor-help text-xs text-gray-400">
                Only sign-in method
              </span>
            </Tooltip>
          </Show>
        }
      >
        <Show when={!isCredential()}>
          <button
            onClick={() => props.onUnlink?.()}
            disabled={props.unlinking}
            class="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Unlink ${props.provider?.name} account`}
          >
            <FiTrash2 class="h-4 w-4" />
            {props.unlinking ? 'Unlinking...' : 'Unlink'}
          </button>
        </Show>
      </Show>
    </div>
  )
}
