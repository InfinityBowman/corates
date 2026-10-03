/** What a non-owner sees on a workspace settings page, which is owner-only for now. */

import { LockIcon } from 'lucide-react';
import { SettingsPage, SettingsSection, SettingsRow } from '@/components/settings/primitives';

export function OwnerOnlyNotice({ title }: { title: string }) {
  return (
    <SettingsPage title={title}>
      <SettingsSection>
        <SettingsRow
          media={<LockIcon className='text-muted-foreground size-4' />}
          label='Only the workspace owner can see this page'
          description='Ask the owner of this workspace if something here needs to change.'
        />
      </SettingsSection>
    </SettingsPage>
  );
}
