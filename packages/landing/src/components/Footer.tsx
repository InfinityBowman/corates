import { Link } from '@tanstack/react-router';
import { BiCopyright } from 'react-icons/bi';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className='border-t border-gray-200 bg-gray-50'>
      <div className='mx-auto max-w-6xl px-6 py-12'>
        <div className='mb-8 grid gap-8 md:grid-cols-4'>
          {/* Brand */}
          <div className='md:col-span-1'>
            <Link to='/' className='text-xl font-bold text-blue-700'>
              CoRATES
            </Link>
            <p className='mt-2 text-sm text-gray-500'>
              Collaborative Research Appraisal Tool for Evidence Synthesis
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className='mb-3 font-semibold text-gray-900'>Product</h4>
            <ul className='space-y-2 text-sm'>
              <li>
                <Link to='/pricing' className='text-gray-500 transition-colors hover:text-gray-700'>
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  to='/'
                  hash='features'
                  className='text-gray-500 transition-colors hover:text-gray-700'
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  to='/resources'
                  className='text-gray-500 transition-colors hover:text-gray-700'
                >
                  Resources
                </Link>
              </li>
              <li>
                <Link
                  to='/checklist'
                  className='text-gray-500 transition-colors hover:text-gray-700'
                >
                  Try Appraisal
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className='mb-3 font-semibold text-gray-900'>Company</h4>
            <ul className='space-y-2 text-sm'>
              <li>
                <Link to='/about' className='text-gray-500 transition-colors hover:text-gray-700'>
                  About
                </Link>
              </li>
              <li>
                <Link to='/contact' className='text-gray-500 transition-colors hover:text-gray-700'>
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className='mb-3 font-semibold text-gray-900'>Legal</h4>
            <ul className='space-y-2 text-sm'>
              <li>
                <Link to='/privacy' className='text-gray-500 transition-colors hover:text-gray-700'>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to='/terms' className='text-gray-500 transition-colors hover:text-gray-700'>
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  to='/security'
                  className='text-gray-500 transition-colors hover:text-gray-700'
                >
                  Security
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className='flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 sm:flex-row'>
          <p className='inline-flex items-center gap-1 text-sm text-gray-400'>
            <BiCopyright className='h-4 w-4' />
            {year} Syntch LLC. All rights reserved.
          </p>
          <div className='flex gap-4'>
            <Link
              to='/signin'
              className='text-sm text-gray-500 transition-colors hover:text-gray-700'
            >
              Sign In
            </Link>
            <Link
              to='/signup'
              className='text-sm font-medium text-blue-700 transition-colors hover:text-blue-700/90'
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
