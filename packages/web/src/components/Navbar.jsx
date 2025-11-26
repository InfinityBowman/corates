import { Show, createSignal, onMount, onCleanup } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useBetterAuth } from '../api/better-auth-store.js';

export default function Navbar() {
  const { isLoggedIn, user, signout, authLoading } = useBetterAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = createSignal(false);
  let userMenuRef;

  const handleSignOut = async () => {
    try {
      await signout();
      navigate('/signin');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // Close user menu when clicking outside
  onMount(() => {
    const handleClickOutside = event => {
      if (userMenuRef && !userMenuRef.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    onCleanup(() => {
      document.removeEventListener('mousedown', handleClickOutside);
    });
  });

  return (
    <nav class='bg-white border-b border-gray-200 px-6 py-3 shadow-sm'>
      <div class='flex items-center justify-between max-w-7xl mx-auto'>
        {/* Logo/Brand */}
        <div class='flex items-center space-x-4'>
          <A
            href='/dashboard'
            class='text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors'
          >
            CoRATES
          </A>
        </div>

        {/* Navigation Links */}
        <div class='hidden md:flex items-center space-x-6'>
          <Show when={!authLoading() && isLoggedIn()}>
            <A
              href='/dashboard'
              class='text-gray-600 hover:text-gray-900 transition-colors font-medium'
              activeClass='text-blue-600'
            >
              Dashboard
            </A>
            <A
              href='/checklist'
              class='text-gray-600 hover:text-gray-900 transition-colors font-medium'
              activeClass='text-blue-600'
            >
              Checklists
            </A>
          </Show>
        </div>

        {/* Auth Section */}
        <div class='flex items-center space-x-4'>
          <Show when={authLoading()}>
            <div class='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
          </Show>

          <Show when={!authLoading() && !isLoggedIn()}>
            <div class='flex items-center space-x-3'>
              <A
                href='/signin'
                class='text-gray-600 hover:text-gray-900 transition-colors px-3 py-2 rounded-md hover:bg-gray-100 font-medium'
              >
                Sign In
              </A>
              <A
                href='/signup'
                class='bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all font-medium shadow-md'
              >
                Sign Up
              </A>
            </div>
          </Show>

          <Show when={!authLoading() && isLoggedIn()}>
            <div class='relative' ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu())}
                class='flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors px-3 py-2 rounded-md hover:bg-gray-100'
              >
                <div class='w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium'>
                  {user()?.name?.charAt(0).toUpperCase() ||
                    user()?.email?.charAt(0).toUpperCase() ||
                    'U'}
                </div>
                <span class='hidden sm:block font-medium'>{user()?.name || user()?.email}</span>
                <svg
                  class={`w-4 h-4 transition-transform ${showUserMenu() ? 'rotate-180' : ''}`}
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    stroke-linecap='round'
                    stroke-linejoin='round'
                    stroke-width='2'
                    d='M19 9l-7 7-7-7'
                  />
                </svg>
              </button>

              <Show when={showUserMenu()}>
                <div class='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200'>
                  <div class='px-4 py-2 text-sm text-gray-700 border-b border-gray-200'>
                    <div class='font-medium'>{user()?.name || 'User'}</div>
                    <div class='text-gray-500 text-xs'>{user()?.email}</div>
                  </div>
                  <A
                    href='/profile'
                    class='block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                    onClick={() => setShowUserMenu(false)}
                  >
                    Profile
                  </A>
                  <A
                    href='/settings'
                    class='block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                    onClick={() => setShowUserMenu(false)}
                  >
                    Settings
                  </A>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleSignOut();
                    }}
                    class='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                  >
                    Sign Out
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <Show when={!authLoading() && isLoggedIn()}>
        <div class='md:hidden mt-3 pt-3 border-t border-gray-200'>
          <div class='flex flex-col space-y-2'>
            <A
              href='/dashboard'
              class='text-gray-600 hover:text-gray-900 transition-colors px-3 py-2 rounded-md hover:bg-gray-100 font-medium'
              activeClass='text-blue-600 bg-blue-50'
            >
              Dashboard
            </A>
            <A
              href='/checklist'
              class='text-gray-600 hover:text-gray-900 transition-colors px-3 py-2 rounded-md hover:bg-gray-100 font-medium'
              activeClass='text-blue-600 bg-blue-50'
            >
              Checklists
            </A>
          </div>
        </div>
      </Show>
    </nav>
  );
}
