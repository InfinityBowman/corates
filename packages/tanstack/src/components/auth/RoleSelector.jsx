import { For } from 'solid-js'
import { FiUser, FiBook, FiBookOpen, FiUsers } from 'solid-icons/fi'

export const ROLES = [
  {
    id: 'researcher',
    label: 'Researcher',
    description: 'Academic or professional',
    icon: FiBookOpen,
  },
  {
    id: 'student',
    label: 'Student',
    description: 'Graduate or undergraduate',
    icon: FiBook,
  },
  {
    id: 'librarian',
    label: 'Librarian',
    description: 'Information specialist',
    icon: FiUsers,
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Clinician, policy maker, etc.',
    icon: FiUser,
  },
]

export function getRoleLabel(roleId) {
  return ROLES.find((r) => r.id === roleId)?.label || roleId
}

/**
 * Role selection grid for sign up flow
 * @param {Object} props
 * @param {string} props.selectedRole - Currently selected role ID
 * @param {Function} props.onSelect - Callback when role is selected
 */
export default function RoleSelector(props) {
  return (
    <div class="grid grid-cols-2 gap-2 sm:gap-3">
      <For each={ROLES}>
        {(roleOption) => (
          <button
            type="button"
            onClick={() => props.onSelect(roleOption.id)}
            class={`rounded-xl border-2 p-3 text-left transition-all hover:border-blue-400 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none sm:p-4 ${
              props.selectedRole === roleOption.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200'
            }`}
          >
            <roleOption.icon class="mb-1.5 h-5 w-5 text-blue-600 sm:h-6 sm:w-6" />
            <div class="text-sm font-semibold text-gray-900">
              {roleOption.label}
            </div>
            <div class="mt-0.5 hidden text-xs text-gray-500 sm:block">
              {roleOption.description}
            </div>
          </button>
        )}
      </For>
    </div>
  )
}
