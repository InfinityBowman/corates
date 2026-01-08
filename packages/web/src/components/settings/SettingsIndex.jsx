/**
 * SettingsIndex - Redirects to the default settings page (general)
 */

import { Navigate } from '@solidjs/router';

export default function SettingsIndex() {
  return <Navigate href='/settings/general' />;
}
