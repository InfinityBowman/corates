import { useNavigate } from '@solidjs/router';
import { FiHome, FiFileText } from 'solid-icons/fi';
import { LANDING_URL } from '@config/api.js';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div class='flex min-h-screen items-center justify-center bg-blue-50 px-6 py-12'>
      <div class='w-full max-w-md text-center'>
        <div class='mb-8'>
          <h1 class='mb-4 text-9xl font-bold text-blue-600'>404</h1>
          <h2 class='mb-2 text-2xl font-semibold text-gray-900'>Page Not Found</h2>
          <p class='text-gray-600'>
            Sorry, we couldn't find the page you're looking for. It might have been moved or
            deleted.
          </p>
        </div>

        <div class='space-y-3'>
          <button
            onClick={() => navigate('/dashboard')}
            class='inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-blue-700'
          >
            <FiHome class='h-5 w-5' />
            Go to Dashboard
          </button>

          <div class='flex gap-3'>
            <button
              onClick={() => navigate('/checklist')}
              class='inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50'
            >
              <FiFileText class='h-5 w-5' />
              Start Appraisal
            </button>
          </div>
        </div>

        <p class='mt-8 text-sm text-gray-500'>
          Need help?{' '}
          <a
            href={LANDING_URL}
            class='font-medium text-blue-600 hover:text-blue-700 hover:underline'
          >
            Return to home
          </a>
        </p>
      </div>
    </div>
  );
}
