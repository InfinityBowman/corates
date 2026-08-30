import { ProfileForm } from './ProfileForm';
import { DeleteAccountSection } from './DeleteAccountSection';
import { SettingsPage } from './primitives';

export function ProfileSettings() {
  return (
    <SettingsPage title='Profile' description='Manage your personal information.'>
      <ProfileForm />
      <DeleteAccountSection />
    </SettingsPage>
  );
}
