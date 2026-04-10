import { UserIcon, BookIcon, BookOpenIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TITLE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'Dr.', label: 'Dr.' },
  { value: 'Prof.', label: 'Prof.' },
  { value: 'other', label: 'Other' },
];

interface RoleOption {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const ROLES: RoleOption[] = [
  {
    id: 'researcher',
    label: 'Researcher',
    description: 'Academic or professional',
    icon: BookOpenIcon,
  },
  { id: 'student', label: 'Student', description: 'Graduate or undergraduate', icon: BookIcon },
  { id: 'librarian', label: 'Librarian', description: 'Information specialist', icon: UsersIcon },
  { id: 'other', label: 'Other', description: 'Clinician, policy maker, etc.', icon: UserIcon },
];

export function getRoleLabel(roleId: string): string {
  return ROLES.find(r => r.id === roleId)?.label || roleId;
}

interface RoleSelectorProps {
  selectedRole: string;
  onSelect: (roleId: string) => void;
}

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
            <Icon className='text-primary mb-1.5 size-5 sm:size-6' aria-hidden='true' />
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
