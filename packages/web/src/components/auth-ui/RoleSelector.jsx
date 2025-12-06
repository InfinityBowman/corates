import { For } from 'solid-js';
import { FiUser, FiBook, FiBookOpen, FiUsers } from 'solid-icons/fi';

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
];

export function getRoleLabel(roleId) {
  return ROLES.find(r => r.id === roleId)?.label || roleId;
}

/**
 * Role selection grid for sign up flow
 * @param {Object} props
 * @param {string} props.selectedRole - Currently selected role ID
 * @param {Function} props.onSelect - Callback when role is selected
 */
export default function RoleSelector(props) {
  return (
    <div class='grid grid-cols-2 gap-2 sm:gap-3'>
      <For each={ROLES}>
        {roleOption => (
          <button
            type='button'
            onClick={() => props.onSelect(roleOption.id)}
            class={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              props.selectedRole === roleOption.id ?
                'border-blue-600 bg-blue-50'
              : 'border-gray-200'
            }`}
          >
            <roleOption.icon class='w-5 h-5 sm:w-6 sm:h-6 text-blue-600 mb-1.5' />
            <div class='font-semibold text-gray-900 text-sm'>{roleOption.label}</div>
            <div class='text-xs text-gray-500 mt-0.5 hidden sm:block'>{roleOption.description}</div>
          </button>
        )}
      </For>
    </div>
  );
}
