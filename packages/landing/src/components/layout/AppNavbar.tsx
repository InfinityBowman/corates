/**
 * App Navbar - top navigation bar for authenticated app routes
 * Shows logo, dashboard link, admin link (if admin), user menu, offline badge
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { FiMenu, FiWifiOff, FiX } from 'react-icons/fi';
import { ChevronDownIcon } from 'lucide-react';
import { useAuthStore, selectUser, selectIsAuthLoading } from '@/stores/authStore';
import { useAdminStore } from '@/stores/adminStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppNavbarProps {
  mobileSidebarOpen?: boolean;
  toggleMobileSidebar?: () => void;
}

export function AppNavbar({ mobileSidebarOpen, toggleMobileSidebar }: AppNavbarProps) {
  const user = useAuthStore(selectUser);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);
  const signout = useAuthStore(s => s.signout);
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();

  const isAdmin = useAdminStore(s => s.isAdmin);
  const isAdminChecked = useAdminStore(s => s.isAdminChecked);
  const checkAdminStatus = useAdminStore(s => s.checkAdminStatus);
  const showAdminMenu = isAdmin && isAdminChecked;

  // Anti-flash: read cached name from localStorage so it shows while session loads
  const [storedName] = useState(() => localStorage.getItem('userName'));
  const isLikelyLoggedIn = !!storedName;

  // Sync user name to localStorage for anti-flash on next load
  useEffect(() => {
    if (user) {
      localStorage.setItem('userName', user.name || '');
    } else if (!isAuthLoading) {
      localStorage.removeItem('userName');
    }
  }, [user, isAuthLoading]);

  // Check admin status on mount
  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  async function handleSignOut() {
    try {
      await signout();
      navigate({ to: '/dashboard', replace: true });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }

  const showUser = user || (isAuthLoading && isLikelyLoggedIn);
  const displayName = user?.name || storedName || 'Loading...';

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between bg-gradient-to-r from-blue-700 to-blue-500 px-4 py-2 text-white shadow-lg">
      <div className="flex items-center space-x-3">
        {/* Mobile sidebar toggle */}
        {toggleMobileSidebar && (
          <button
            className="-ml-1.5 rounded-full border border-blue-200 bg-white/80 p-1.5 text-blue-700 shadow transition-all duration-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
            onClick={toggleMobileSidebar}
            aria-label={mobileSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {mobileSidebarOpen ? <FiX className="h-4 w-4" /> : <FiMenu className="h-4 w-4" />}
          </button>
        )}

        {/* Logo */}
        <a
          href="/"
          className="inline-flex items-center gap-2 text-base font-extrabold tracking-tight drop-shadow sm:text-lg"
        >
          <div className="flex items-center justify-center rounded bg-white p-0.5">
            <img src="/logo.svg" alt="CoRATES Logo" aria-hidden="true" className="h-5 w-5 rounded-sm" width="20" height="20" />
          </div>
          CoRATES
        </a>

        {/* Offline indicator */}
        {!isOnline && (
          <div className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-1 text-xs text-white">
            <FiWifiOff className="h-3 w-3" />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4 text-2xs sm:text-xs">
        <Link to="/dashboard" className="flex h-9 items-center rounded px-2 font-medium transition hover:bg-blue-600">
          Dashboard
        </Link>

        {showAdminMenu && (
          <Link to={'/admin' as string} className="flex h-9 items-center rounded px-2 font-medium transition hover:bg-blue-600">
            Admin
          </Link>
        )}

        {showUser ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-9 items-center space-x-2 rounded px-2 font-medium transition hover:bg-blue-600">
                <Avatar className="h-6 w-6" size="sm">
                  {user?.image ? (
                    <AvatarImage src={user.image} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="bg-white/20 text-xs text-white">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block">{displayName}</span>
                <ChevronDownIcon className="h-3 w-3" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>
                <div className="font-medium">{user?.name || 'User'}</div>
                <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={'/settings/profile' as string}>Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <Link to="/signin" className="flex h-9 items-center rounded px-2 font-medium transition hover:bg-blue-600">
              Sign In
            </Link>
            <Link to="/signup" className="flex h-9 items-center rounded px-2 font-medium transition hover:bg-blue-600">
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
