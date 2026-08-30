import { CloudIcon } from 'lucide-react';
import { GoogleDriveSettings } from './GoogleDriveSettings';
import { SettingsPage, SettingsSection } from './primitives';

export function IntegrationsSettings() {
  return (
    <SettingsPage title='Integrations' description='Services CoRATES can pull documents from.'>
      <SettingsSection
        icon={CloudIcon}
        title='Cloud storage'
        description='Import PDFs into a project without downloading them first.'
      >
        <GoogleDriveSettings />
      </SettingsSection>
    </SettingsPage>
  );
}
