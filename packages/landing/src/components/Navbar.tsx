import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { FiMenu, FiX } from 'react-icons/fi';

import { useAuth } from '../lib/auth';
import EarlyAccessBanner from './EarlyAccessBanner';

const navLinks = [
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
];

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { isLoggedIn } = useAuth();

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
        <div className='space-y-1 px-6 py-6'>
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
            className='animate-stagger-item mt-4 space-y-3 border-t border-gray-200 pt-4'
            style={{ animationDelay: getDelay(navLinks.length) }}
          >
            {isLoggedIn ?
              <Link
                to='/dashboard'
                className='block w-full rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-center font-medium text-white shadow-sm transition-colors hover:bg-blue-700'
              >
                My Dashboard
              </Link>
            : <>
                <Link
                  to='/signin'
                  className='block w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-700 transition-colors hover:bg-gray-50'
                >
                  Sign In
                </Link>
                <Link
                  to='/signup'
                  className='bg-primary text-primary-foreground hover:bg-primary/90 block w-full rounded-lg border border-transparent px-4 py-3 text-center font-medium shadow-sm transition-colors'
                >
                  Sign Up
                </Link>
              </>
            }
          </div>
        </div>
      </div>
    </>
  );
}

export default function Navbar() {
  const { isLoggedIn, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen(prev => !prev);

  return (
    <>
      <nav
        className='sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm'
        aria-label='Primary'
      >
        <div className='mx-auto flex w-full items-center justify-between px-6 py-2'>
          <div className='flex items-center gap-8'>
            <Link
              to='/'
              className='inline-flex items-center gap-2 rounded text-xl font-bold text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none'
            >
              <img
                src='/logo.svg'
                alt='CoRATES Logo'
                aria-hidden='true'
                className='h-6 w-6 rounded-sm'
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
                <Link
                  to='/dashboard'
                  className='hidden items-center gap-2 rounded-lg border border-transparent bg-blue-600 px-4 py-1.5 text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex'
                >
                  My Dashboard
                </Link>
              </>
            : <>
                <Link
                  to='/signin'
                  className='focus-visible:ring-primary hidden items-center rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-gray-700 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex'
                >
                  Sign In
                </Link>
                <Link
                  to='/signup'
                  className='bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary hidden items-center gap-2 rounded-lg border border-transparent px-4 py-1.5 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex'
                >
                  Sign Up
                </Link>
              </>
            }

            {/* Mobile Menu Button */}
            <button
              type='button'
              className='inline-flex items-center justify-center rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none sm:hidden'
              onClick={toggleMobileMenu}
              aria-expanded={mobileMenuOpen}
              aria-controls='mobile-menu'
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ?
                <FiX className='h-6 w-6' />
              : <FiMenu className='h-6 w-6' />}
            </button>
          </div>
        </div>
      </nav>

      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <EarlyAccessBanner />
    </>
  );
}
