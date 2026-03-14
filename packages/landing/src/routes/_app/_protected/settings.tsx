import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/_protected/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="mt-2 text-gray-600">Settings placeholder - migration in progress</p>
    </div>
  );
}
