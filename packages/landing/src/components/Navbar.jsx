import { onMount, Show } from 'solid-js';
import { urls } from '~/lib/config';
import { checkSession, useAuth } from '~/lib/auth';

export default function Navbar() {
  const { isLoggedIn, isLoading } = useAuth();

  onMount(() => {
    checkSession();
  });

  return (
    <nav class='bg-white border-b border-gray-100'>
      <div class='flex items-center justify-between max-w-6xl mx-auto px-6 py-4'>
        <div class='flex items-center gap-8'>
          <a href='/' class='text-xl font-bold text-blue-600'>
            CoRATES
          </a>
          <a
            href='/about'
            class='hidden sm:inline-flex text-gray-600 hover:text-gray-900 transition-colors'
          >
            About
          </a>
        </div>
        <div class='flex gap-3'>
          <Show when={!isLoading()}>
            <Show
              when={isLoggedIn()}
              fallback={
                <>
                  <a
                    href={urls.signIn()}
                    rel='external'
                    class='hidden sm:inline-flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors'
                  >
                    Sign In
                  </a>
                  <a
                    href={urls.signUp()}
                    rel='external'
                    class='inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm'
                  >
                    Sign Up
                  </a>
                </>
              }
            >
              <a
                href={urls.dashboard()}
                rel='external'
                class='inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm'
              >
                Open App
              </a>
            </Show>
          </Show>
        </div>
      </div>
    </nav>
  );
}
