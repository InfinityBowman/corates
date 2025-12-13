import { useNavigate } from '@solidjs/router';
import { FiHome, FiFileText } from 'solid-icons/fi';
import { LANDING_URL } from '@config/api.js';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div class='min-h-screen bg-blue-50 flex items-center justify-center px-6 py-12'>
      <div class='max-w-md w-full text-center'>
        <div class='mb-8'>
          <h1 class='text-9xl font-bold text-blue-600 mb-4'>404</h1>
          <h2 class='text-2xl font-semibold text-gray-900 mb-2'>Page Not Found</h2>
          <p class='text-gray-600'>
            Sorry, we couldn't find the page you're looking for. It might have been moved or
            deleted.
          </p>
        </div>

        <div class='space-y-3'>
          <button
            onClick={() => navigate('/dashboard')}
            class='w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm'
          >
            <FiHome class='w-5 h-5' />
            Go to Dashboard
          </button>

          <div class='flex gap-3'>
            <button
              onClick={() => navigate('/checklist')}
              class='flex-1 inline-flex items-center justify-center gap-2 bg-white text-gray-700 px-4 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors border border-gray-200'
            >
              <FiFileText class='w-5 h-5' />
              Start Appraisal
            </button>
          </div>
        </div>

        <p class='mt-8 text-sm text-gray-500'>
          Need help?{' '}
          <a
            href={LANDING_URL}
            class='text-blue-600 hover:text-blue-700 font-medium hover:underline'
          >
            Return to home
          </a>
        </p>
      </div>
    </div>
  );
}
