/**
 * AdminSection - Section grouping component with header
 *
 * Provides consistent section structure with title, optional description,
 * and optional CTA slot. Based on Polar's Section pattern.
 *
 * @example
 * <AdminSection title="Users">
 *   <UserTable />
 * </AdminSection>
 *
 * <AdminSection
 *   title="Organizations"
 *   description="Manage all organizations in the system"
 *   cta={<Button>Add Organization</Button>}
 * >
 *   <OrgList />
 * </AdminSection>
 */

import { Show } from 'solid-js';

/**
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {string} [props.description] - Optional description text
 * @param {JSX.Element} [props.cta] - Optional action button/element
 * @param {boolean} [props.compact] - Use compact spacing (gap-4 instead of gap-6)
 * @param {string} [props.class] - Additional CSS classes
 * @param {JSX.Element} props.children - Section content
 */
export function AdminSection(props) {
  return (
    <div class={`flex flex-col ${props.compact ? 'gap-4' : 'gap-6'} ${props.class || ''}`}>
      <div class='flex flex-col gap-1'>
        <div class='flex items-center justify-between'>
          <h2 class='text-foreground text-lg font-medium'>{props.title}</h2>
          <Show when={props.cta}>{props.cta}</Show>
        </div>
        <Show when={props.description}>
          <p class='text-muted-foreground text-sm'>{props.description}</p>
        </Show>
      </div>
      {props.children}
    </div>
  );
}

export default AdminSection;
