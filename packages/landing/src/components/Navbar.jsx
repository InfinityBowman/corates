import { Show } from 'solid-js';
import { urls } from '~/lib/config';
import { useAuth } from '~/lib/auth';

export default function Navbar() {
  const { isLoggedIn } = useAuth();

  return (
    <nav class='bg-white border-b border-gray-100' aria-label='Primary'>
      <div class='flex items-center justify-between max-w-6xl mx-auto px-6 py-4'>
        <div class='flex items-center gap-8'>
          <a
            href='/'
            class='inline-flex items-center gap-2 text-xl font-bold text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded'
          >
            <img
              src='/icon.png'
              alt=''
              aria-hidden='true'
              class='h-6 w-6 rounded-sm'
              width='24'
              height='24'
            />
            CoRATES
          </a>
          <a
            href='/about'
            class='hidden sm:inline-flex text-gray-600 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded'
          >
            About
          </a>
        </div>
        <div class='flex gap-3'>
          <Show
            when={isLoggedIn()}
            fallback={
              <>
                <a
                  href={urls.signIn()}
                  rel='external'
                  class='hidden sm:inline-flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2'
                >
                  Sign In
                </a>
                <a
                  href={urls.signUp()}
                  rel='external'
                  class='inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2'
                >
                  Sign Up
                </a>
              </>
            }
          >
            <a
              href={urls.dashboard()}
              rel='external'
              class='inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2'
            >
              Open App
            </a>
          </Show>
        </div>
      </div>
    </nav>
  );
}
