import { useState } from 'react';
import { Link, useHydrated } from '@tanstack/react-router';
import { MenuIcon, XIcon } from 'lucide-react';

import { useAuthStore, selectIsLoggedIn, selectUser } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import EarlyAccessBanner from './EarlyAccessBanner';

const navLinks = [
  { href: '/about', label: 'About' },
  { href: '/resources', label: 'Resources' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
];

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);

  const getDelay = (index: number) => `${50 + index * 50}ms`;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className='animate-backdrop-fade fixed inset-0 z-40 bg-gray-900/20 backdrop-blur-sm sm:hidden'
        onClick={onClose}
        aria-hidden='true'
      />

      {/* Menu panel */}
      <div
        id='mobile-menu'
        className='animate-slide-down fixed top-16 right-0 left-0 z-50 border-b border-gray-200 bg-white/95 shadow-lg backdrop-blur-md sm:hidden'
      >
        <div className='flex flex-col gap-1 px-6 py-6'>
          {navLinks.map((link, index) => (
            <Link
              key={link.href}
              to={link.href}
              className='animate-stagger-item -mx-3 block rounded-lg px-3 py-3 text-lg text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600'
              style={{ animationDelay: getDelay(index) }}
              onClick={onClose}
            >
              {link.label}
            </Link>
          ))}
          <div
            className='animate-stagger-item mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4'
            style={{ animationDelay: getDelay(navLinks.length) }}
          >
            {isLoggedIn ?
              <Button asChild size='lg' className='w-full'>
                <Link to='/dashboard'>My Dashboard</Link>
              </Button>
            : <>
                <Button asChild variant='outline' size='lg' className='w-full'>
                  <Link to='/signin'>Sign In</Link>
                </Button>
                <Button asChild size='lg' className='w-full'>
                  <Link to='/signup'>Sign Up</Link>
                </Button>
              </>
            }
          </div>
        </div>
      </div>
    </>
  );
}

export default function Navbar() {
  // Gate auth-dependent rendering until hydration. cachedUser is read
  // synchronously by the store.
  const isHydrated = useHydrated();
  const isLoggedIn = useAuthStore(selectIsLoggedIn) && isHydrated;
  const user = useAuthStore(selectUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen(prev => !prev);

  return (
    <>
      <nav
        className='sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm'
        aria-label='Primary'
      >
        {/* Fixed h-16 so the mobile menu panel (fixed top-16) aligns flush with
            the navbar bottom instead of leaving a gap showing the banner behind */}
        <div className='mx-auto flex h-16 w-full items-center justify-between px-6'>
          <div className='flex items-center gap-8'>
            <Link
              to='/'
              className='inline-flex items-center gap-2 rounded text-xl font-bold text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none'
            >
              <img
                src='/logo.svg'
                alt='CoRATES Logo'
                aria-hidden='true'
                className='size-6 rounded-sm'
                width='24'
                height='24'
              />
              CoRATES
            </Link>
            {navLinks.map(link => (
              <Link
                key={link.href}
                to={link.href}
                className='hidden rounded text-gray-600 transition-colors hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex'
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className='flex items-center gap-3'>
            {isLoggedIn ?
              <>
                <span className='hidden sm:inline-flex'>
                  Welcome back, {user?.name || 'User'}!&nbsp;
                </span>
                <Button asChild className='hidden sm:inline-flex'>
                  <Link to='/dashboard'>My Dashboard</Link>
                </Button>
              </>
            : <>
                <Button asChild variant='outline' className='hidden sm:inline-flex'>
                  <Link to='/signin'>Sign In</Link>
                </Button>
                <Button asChild className='hidden sm:inline-flex'>
                  <Link to='/signup'>Sign Up</Link>
                </Button>
              </>
            }

            {/* Mobile Menu Button */}
            <Button
              variant='ghost'
              size='icon-lg'
              className='text-gray-600 hover:text-gray-900 sm:hidden'
              onClick={toggleMobileMenu}
              aria-expanded={mobileMenuOpen}
              aria-controls='mobile-menu'
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ?
                <XIcon className='size-6' />
              : <MenuIcon className='size-6' />}
            </Button>
          </div>
        </div>
      </nav>

      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <EarlyAccessBanner />
    </>
  );
}
