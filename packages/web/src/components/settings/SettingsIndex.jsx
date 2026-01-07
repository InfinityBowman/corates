/**
 * SettingsIndex - Redirects to the default settings page (billing)
 */

import { Navigate } from '@solidjs/router';

export default function SettingsIndex() {
  return <Navigate href='/settings/billing' />;
}
