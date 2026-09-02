import { ProfileForm } from './ProfileForm';
import { DeleteAccountSection } from './DeleteAccountSection';
import { SettingsPage } from './primitives';

export function ProfileSettings() {
  return (
    <SettingsPage title='Profile' description='Your name, photo, and academic affiliation.'>
      <ProfileForm />
      <DeleteAccountSection />
    </SettingsPage>
  );
}
