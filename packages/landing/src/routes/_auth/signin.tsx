import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/signin')({
  component: SignInPage,
});

function SignInPage() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
      <p className="mt-2 text-gray-600">Sign in placeholder - migration in progress</p>
    </div>
  );
}
