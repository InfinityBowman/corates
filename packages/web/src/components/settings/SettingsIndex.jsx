/**
 * SettingsIndex - Redirects to the default settings page (profile)
 */

import { Navigate } from '@solidjs/router';

export default function SettingsIndex() {
  return <Navigate href='/settings/profile' />;
}
