import { SignInMethodsSection } from './SignInMethodsSection';
import { SessionManagement } from './SessionManagement';
import { SettingsPage } from './primitives';

export function SecuritySettings() {
  return (
    <SettingsPage
      title='Security'
      description='Sign-in methods, two-factor authentication, and signed-in devices.'
    >
      <SignInMethodsSection />
      <SessionManagement />
    </SettingsPage>
  );
}
