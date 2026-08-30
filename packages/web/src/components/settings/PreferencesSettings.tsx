/** Notification and appearance choices. None of these persist yet. */

import { MailIcon, PaletteIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { SettingsPage, SettingsSection, SettingsRow } from './primitives';

function NotYet() {
  return (
    <>
      <Badge variant='info'>Coming soon</Badge>
      <Switch checked={false} disabled aria-label='Not yet available' />
    </>
  );
}

export function PreferencesSettings() {
  return (
    <SettingsPage
      title='Preferences'
      description='How CoRATES reaches you, and how it looks while you work.'
    >
      <SettingsSection
        icon={MailIcon}
        title='Email'
        description='These are in development. Until they ship, CoRATES only emails you about your account and your invitations.'
      >
        <SettingsRow
          label='Account updates'
          description='Billing changes, security alerts, and other account activity.'
        >
          <NotYet />
        </SettingsRow>
        <SettingsRow
          label='Project activity'
          description='When a collaborator changes a project you are part of.'
        >
          <NotYet />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection icon={PaletteIcon} title='Appearance'>
        <SettingsRow
          label='Dark theme'
          description='CoRATES currently follows a single light theme.'
        >
          <NotYet />
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  );
}
