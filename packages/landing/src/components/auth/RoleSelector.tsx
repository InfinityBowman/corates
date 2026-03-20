import { FiUser, FiBook, FiBookOpen, FiUsers } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { cn } from '@/lib/utils';

export const TITLE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'Dr.', label: 'Dr.' },
  { value: 'Prof.', label: 'Prof.' },
  { value: 'other', label: 'Other' },
];

export function getTitleLabel(titleValue?: string | null): string | null {
  if (titleValue == null) return null;
  return TITLE_OPTIONS.find(t => t.value === titleValue)?.label || titleValue;
}

interface RoleOption {
  id: string;
  label: string;
  description: string;
  icon: IconType;
}

export const ROLES: RoleOption[] = [
  {
    id: 'researcher',
    label: 'Researcher',
    description: 'Academic or professional',
    icon: FiBookOpen,
  },
  { id: 'student', label: 'Student', description: 'Graduate or undergraduate', icon: FiBook },
  { id: 'librarian', label: 'Librarian', description: 'Information specialist', icon: FiUsers },
  { id: 'other', label: 'Other', description: 'Clinician, policy maker, etc.', icon: FiUser },
];

export function getRoleLabel(roleId: string): string {
  return ROLES.find(r => r.id === roleId)?.label || roleId;
}

/* eslint-disable no-unused-vars */
interface RoleSelectorProps {
  selectedRole: string;
  onSelect: (roleId: string) => void;
}
/* eslint-enable no-unused-vars */

export function RoleSelector({ selectedRole, onSelect }: RoleSelectorProps) {
  return (
    <div
      className='grid grid-cols-2 gap-2 sm:gap-3'
      role='radiogroup'
      aria-label='Select your role'
    >
      {ROLES.map(roleOption => {
        const Icon = roleOption.icon;
        const isSelected = selectedRole === roleOption.id;
        return (
          <button
            key={roleOption.id}
            type='button'
            role='radio'
            onClick={() => onSelect(roleOption.id)}
            aria-checked={isSelected}
            className={cn(
              'hover:border-primary/60 hover:bg-primary/5 focus:ring-primary rounded-xl border-2 p-3 text-left transition-all focus:ring-2 focus:outline-none sm:p-4',
              isSelected ? 'border-primary bg-primary/5' : 'border-border',
            )}
          >
            <Icon className='text-primary mb-1.5 h-5 w-5 sm:h-6 sm:w-6' aria-hidden='true' />
            <div className='text-foreground text-sm font-semibold'>{roleOption.label}</div>
            <div className='text-muted-foreground mt-0.5 hidden text-xs sm:block'>
              {roleOption.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}
