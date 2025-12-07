import { urls } from '~/lib/config';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer class='border-t border-gray-200 bg-gray-50'>
      <div class='max-w-6xl mx-auto px-6 py-12'>
        <div class='grid md:grid-cols-4 gap-8 mb-8'>
          {/* Brand */}
          <div class='md:col-span-1'>
            <a href='/' class='text-xl font-bold text-blue-700'>
              CoRATES
            </a>
            <p class='text-sm text-gray-500 mt-2'>
              Collaborative Research Appraisal Tool for Evidence Synthesis
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 class='font-semibold text-gray-900 mb-3'>Product</h4>
            <ul class='space-y-2 text-sm'>
              <li>
                <a href='/#features' class='text-gray-500 hover:text-gray-700 transition-colors'>
                  Features
                </a>
              </li>
              <li>
                <a
                  href={urls.checklist()}
                  class='text-gray-500 hover:text-gray-700 transition-colors'
                >
                  Try Appraisal
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 class='font-semibold text-gray-900 mb-3'>Company</h4>
            <ul class='space-y-2 text-sm'>
              <li>
                <a href='/about' class='text-gray-500 hover:text-gray-700 transition-colors'>
                  About
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 class='font-semibold text-gray-900 mb-3'>Legal</h4>
            <ul class='space-y-2 text-sm'>
              <li>
                <a href='/privacy' class='text-gray-500 hover:text-gray-700 transition-colors'>
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href='/terms' class='text-gray-500 hover:text-gray-700 transition-colors'>
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div class='border-t border-gray-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4'>
          <p class='text-gray-400 text-sm'>{year} CoRATES. All rights reserved.</p>
          <div class='flex gap-4'>
            <a
              href={urls.signIn()}
              class='text-sm text-gray-500 hover:text-gray-700 transition-colors'
            >
              Sign In
            </a>
            <a
              href={urls.signUp()}
              class='text-sm text-blue-700 hover:text-blue-700/90 font-medium transition-colors'
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
