import { urls } from '~/lib/landing/config'
import PrefetchLink from '~/components/landing/PrefetchLink'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer class="border-t border-gray-200 bg-gray-50">
      <div class="mx-auto max-w-6xl px-6 py-12">
        <div class="mb-8 grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div class="md:col-span-1">
            <PrefetchLink href="/" class="text-xl font-bold text-blue-700">
              CoRATES
            </PrefetchLink>
            <p class="mt-2 text-sm text-gray-500">
              Collaborative Research Appraisal Tool for Evidence Synthesis
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 class="mb-3 font-semibold text-gray-900">Product</h4>
            <ul class="space-y-2 text-sm">
              <li>
                <PrefetchLink
                  href="/pricing"
                  class="text-gray-500 transition-colors hover:text-gray-700"
                >
                  Pricing
                </PrefetchLink>
              </li>
              <li>
                <PrefetchLink
                  href="/#features"
                  class="text-gray-500 transition-colors hover:text-gray-700"
                >
                  Features
                </PrefetchLink>
              </li>
              <li>
                <PrefetchLink
                  href="/resources"
                  class="text-gray-500 transition-colors hover:text-gray-700"
                >
                  Resources
                </PrefetchLink>
              </li>
              <li>
                <a
                  href={urls.checklist()}
                  rel="external"
                  class="text-gray-500 transition-colors hover:text-gray-700"
                >
                  Try Appraisal
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 class="mb-3 font-semibold text-gray-900">Company</h4>
            <ul class="space-y-2 text-sm">
              <li>
                <PrefetchLink
                  href="/about"
                  class="text-gray-500 transition-colors hover:text-gray-700"
                >
                  About
                </PrefetchLink>
              </li>
              <li>
                <PrefetchLink
                  href="/contact"
                  class="text-gray-500 transition-colors hover:text-gray-700"
                >
                  Contact
                </PrefetchLink>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 class="mb-3 font-semibold text-gray-900">Legal</h4>
            <ul class="space-y-2 text-sm">
              <li>
                <PrefetchLink
                  href="/privacy"
                  class="text-gray-500 transition-colors hover:text-gray-700"
                >
                  Privacy Policy
                </PrefetchLink>
              </li>
              <li>
                <PrefetchLink
                  href="/terms"
                  class="text-gray-500 transition-colors hover:text-gray-700"
                >
                  Terms of Service
                </PrefetchLink>
              </li>
              <li>
                <PrefetchLink
                  href="/security"
                  class="text-gray-500 transition-colors hover:text-gray-700"
                >
                  Security
                </PrefetchLink>
              </li>
            </ul>
          </div>
        </div>

        <div class="flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 sm:flex-row">
          <p class="text-sm text-gray-400">
            {year} CoRATES. All rights reserved.
          </p>
          <div class="flex gap-4">
            <a
              href={urls.signIn()}
              rel="external"
              class="text-sm text-gray-500 transition-colors hover:text-gray-700"
            >
              Sign In
            </a>
            <a
              href={urls.signUp()}
              rel="external"
              class="text-sm font-medium text-blue-700 transition-colors hover:text-blue-700/90"
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
