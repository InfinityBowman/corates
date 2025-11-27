import { Show, createEffect } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { useBetterAuth } from '../api/better-auth-store.js';
import { BASEPATH } from '../Routes.jsx';
import { FiMenu } from 'solid-icons/fi';

function normalizePath(path) {
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

export default function Navbar(props) {
  const { user, signout, authLoading } = useBetterAuth();
  const location = useLocation();
  const isHome = () => normalizePath(location.pathname) === normalizePath(BASEPATH);

  // Read from localStorage on render to avoid layout shift on refresh
  const storedName = localStorage.getItem('userName');
  const isLikelyLoggedIn = !!storedName;

  createEffect(() => {
    if (user()) {
      localStorage.setItem('userName', user().name);
    } else {
      localStorage.removeItem('userName');
    }
  });

  return (
    <nav class='flex items-center justify-between bg-linear-to-r from-blue-700 to-blue-500 text-white px-4 py-2 shadow-lg'>
      <div class='flex items-center space-x-3'>
        {/* Sidebar toggle button */}
        <Show when={!isHome()}>
          <button
            class='-ml-1.5 bg-white/80 text-blue-700 p-1.5 rounded-full shadow hover:bg-white transition-all duration-200 border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400'
            onClick={props.toggleSidebar}
            aria-label='Toggle sidebar'
          >
            <Show
              when={!props.open}
              fallback={
                <svg fill='currentColor' class='w-4 h-4' viewBox='0 0 20 20'>
                  <path d='M3.5 3C3.77614 3 4 3.22386 4 3.5V16.5L3.99023 16.6006C3.94371 16.8286 3.74171 17 3.5 17C3.25829 17 3.05629 16.8286 3.00977 16.6006L3 16.5V3.5C3 3.22386 3.22386 3 3.5 3ZM11.2471 5.06836C11.4476 4.95058 11.7104 4.98547 11.8721 5.16504C12.0338 5.34471 12.0407 5.60979 11.9023 5.79688L11.835 5.87207L7.80371 9.5H16.5C16.7761 9.5 17 9.72386 17 10C17 10.2761 16.7761 10.5 16.5 10.5H7.80371L11.835 14.1279C12.0402 14.3127 12.0568 14.6297 11.8721 14.835C11.6873 15.0402 11.3703 15.0568 11.165 14.8721L6.16504 10.3721L6.09473 10.2939C6.03333 10.2093 6 10.1063 6 10C6 9.85828 6.05972 9.72275 6.16504 9.62793L11.165 5.12793L11.2471 5.06836Z' />
                </svg>
              }
            >
              <FiMenu class='w-4 h-4' />
            </Show>
          </button>
        </Show>
        <A href='/' class='font-extrabold text-base sm:text-lg tracking-tight drop-shadow'>
          CoRATES
        </A>
      </div>

      <div class='flex space-x-4 items-center text-2xs sm:text-xs'>
        <A href='/dashboard' class='hover:bg-blue-600 px-2 py-1.5 rounded transition font-medium'>
          Dashboard
        </A>
        <Show
          when={user()}
          fallback={
            isLikelyLoggedIn && authLoading() ?
              <>
                <span class='font-medium'>Hello, {storedName}</span>
                <button class='hover:bg-blue-600 px-2 py-1.5 rounded transition font-medium'>
                  Sign Out
                </button>
              </>
            : <>
                <A
                  href='/signin'
                  class='hover:bg-blue-600 px-2 py-1.5 rounded transition font-medium'
                >
                  Sign In
                </A>
                <A
                  href='/signup'
                  class='hover:bg-blue-600 px-2 py-1.5 rounded transition font-medium'
                >
                  Sign Up
                </A>
              </>
          }
        >
          <span class='font-medium'>Hello, {user().name}</span>
          <button
            onClick={async () => {
              await signout();
            }}
            class='hover:bg-blue-600 px-2 py-1.5 rounded transition font-medium'
          >
            Sign Out
          </button>
        </Show>
      </div>
    </nav>
  );
}
