import { For } from 'solid-js';
import { FiUser, FiBook, FiBookOpen, FiUsers } from 'solid-icons/fi';

export const TITLE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'Dr.', label: 'Dr.' },
  { value: 'Prof.', label: 'Prof.' },
  { value: 'other', label: 'Other' },
];

export function getTitleLabel(titleValue) {
  if (titleValue == null) return null;
  return TITLE_OPTIONS.find(t => t.value === titleValue)?.label || titleValue;
}

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
 * Uses radiogroup pattern for single-select accessibility
 * @param {Object} props
 * @param {string} props.selectedRole - Currently selected role ID
 * @param {Function} props.onSelect - Callback when role is selected
 */
export default function RoleSelector(props) {
  return (
    <div class='grid grid-cols-2 gap-2 sm:gap-3' role='radiogroup' aria-label='Select your role'>
      <For each={ROLES}>
        {roleOption => (
          <button
            type='button'
            role='radio'
            onClick={() => props.onSelect(roleOption.id)}
            aria-checked={props.selectedRole === roleOption.id}
            class={`focus:ring-primary rounded-xl border-2 p-3 text-left transition-all hover:border-blue-400 hover:bg-blue-50 focus:ring-2 focus:outline-none sm:p-4 ${
              props.selectedRole === roleOption.id ? 'border-blue-600 bg-blue-50' : 'border-border'
            }`}
          >
            <roleOption.icon
              class='mb-1.5 h-5 w-5 text-blue-600 sm:h-6 sm:w-6'
              aria-hidden='true'
            />
            <div class='text-foreground text-sm font-semibold'>{roleOption.label}</div>
            <div class='text-muted-foreground mt-0.5 hidden text-xs sm:block'>
              {roleOption.description}
            </div>
          </button>
        )}
      </For>
    </div>
  );
}
