import { createFileRoute } from '@tanstack/solid-router'
import {
  FiShield,
  FiLock,
  FiServer,
  FiUsers,
  FiAlertCircle,
  FiMail,
} from 'solid-icons/fi'
import Navbar from '@components/landing/Navbar'
import Footer from '@components/landing/Footer'
import { config } from '@lib/landing/config'

export const Route = createFileRoute('/security')({
  prerender: true,
  head: () => {
    const pageUrl = `${config.appUrl}/security`
    const title = 'Security - CoRATES'
    const description =
      'Learn about the security measures CoRATES implements to protect your research data and ensure the integrity of your evidence synthesis work.'
    return {
      title,
      meta: [
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: pageUrl },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
      ],
      links: [{ rel: 'canonical', href: pageUrl }],
    }
  },
  component: Security,
})

function Security() {
  return (
    <div class="flex min-h-screen flex-col">
      <Navbar />

      <main class="flex-1 py-16">
        <div class="mx-auto max-w-3xl px-6">
          <h1 class="mb-2 text-4xl font-bold text-gray-900">Security</h1>
          <p class="mb-8 text-gray-500">How we protect your research data</p>

          <div class="space-y-8 leading-relaxed text-gray-700">
            <p>
              At CoRATES, we understand that your research data is valuable and
              sensitive. We are committed to implementing robust security
              measures to protect your information and ensure the integrity of
              your evidence synthesis work.
            </p>

            {/* Security Features */}
            <div class="grid gap-6">
              <div class="rounded-lg bg-gray-50 p-6">
                <div class="flex items-start gap-4">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <FiLock class="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 class="mb-2 text-lg font-semibold text-gray-900">
                      Encryption
                    </h2>
                    <p class="text-gray-600">
                      All data transmitted between your browser and our servers
                      is encrypted using TLS (Transport Layer Security). Data at
                      rest, including uploaded PDFs and application data, is
                      encrypted using industry-standard encryption (AES-256-GCM)
                      provided by our infrastructure providers.
                    </p>
                  </div>
                </div>
              </div>

              <div class="rounded-lg bg-gray-50 p-6">
                <div class="flex items-start gap-4">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <FiShield class="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 class="mb-2 text-lg font-semibold text-gray-900">
                      Authentication
                    </h2>
                    <p class="text-gray-600">
                      We support multiple secure authentication methods
                      including OAuth (Google, ORCID), passwordless login via
                      email, and two-factor authentication (2FA) for enhanced
                      account security.
                    </p>
                  </div>
                </div>
              </div>
              <div class="rounded-lg bg-gray-50 p-6">
                <div class="flex items-start gap-4">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <FiAlertCircle class="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 class="mb-2 text-lg font-semibold text-gray-900">
                      Abuse Prevention
                    </h2>
                    <p class="text-gray-600">
                      We apply rate limiting to sensitive endpoints (such as
                      sign-in, registration, password resets, and email flows)
                      to reduce brute-force attempts and automated abuse.
                    </p>
                  </div>
                </div>
              </div>

              <div class="rounded-lg bg-gray-50 p-6">
                <div class="flex items-start gap-4">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <FiServer class="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 class="mb-2 text-lg font-semibold text-gray-900">
                      Infrastructure
                    </h2>
                    <p class="text-gray-600">
                      CoRATES is hosted on Cloudflare's global network,
                      providing enterprise-grade security, DDoS protection, and
                      a Web Application Firewall (WAF) to protect against common
                      web vulnerabilities.
                    </p>
                  </div>
                </div>
              </div>

              <div class="rounded-lg bg-gray-50 p-6">
                <div class="flex items-start gap-4">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <FiUsers class="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 class="mb-2 text-lg font-semibold text-gray-900">
                      Access Control
                    </h2>
                    <p class="text-gray-600">
                      Project-level access controls ensure that only authorized
                      team members can view and edit your research data. You
                      control who has access to your projects and can revoke
                      access at any time. You retain full ownership of your
                      research data. CoRATES does not sell or share your data
                      with third parties.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Responsible Disclosure */}
            <div class="border-t border-gray-200 pt-8">
              <div class="flex items-start gap-4">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <FiAlertCircle class="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 class="mb-3 text-xl font-semibold text-gray-900">
                    Responsible Disclosure
                  </h2>
                  <p class="mb-4 text-gray-600">
                    We take security vulnerabilities seriously. If you believe
                    you have found a security vulnerability in CoRATES, we
                    encourage you to report it to us responsibly. We will not
                    pursue legal action against researchers who report
                    vulnerabilities responsibly and in good faith.
                  </p>
                  <p class="mb-4 text-gray-600">
                    Please send details of the vulnerability to{' '}
                    <a
                      href="mailto:contact@corates.org"
                      class="font-medium text-blue-600 hover:text-blue-700"
                    >
                      contact@corates.org
                    </a>
                    . Include as much information as possible, such as:
                  </p>
                  <ul class="mb-4 ml-6 list-outside list-disc space-y-1 text-gray-600">
                    <li>A description of the vulnerability</li>
                    <li>Steps to reproduce the issue</li>
                    <li>Potential impact of the vulnerability</li>
                    <li>Any suggestions for remediation</li>
                  </ul>
                  <p class="text-gray-600">
                    We will acknowledge receipt of your report within 48 hours
                    and will work with you to understand and address the issue
                    promptly. We ask that you give us reasonable time to
                    investigate and mitigate the vulnerability before making any
                    information public.
                  </p>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div class="border-t border-gray-200 pt-8">
              <div class="flex items-start gap-4">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <FiMail class="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 class="mb-3 text-xl font-semibold text-gray-900">
                    Security Questions
                  </h2>
                  <p class="text-gray-600">
                    If you have any questions about our security practices or
                    would like more information, please contact us at{' '}
                    <a
                      href="mailto:contact@corates.org"
                      class="font-medium text-blue-600 hover:text-blue-700"
                    >
                      contact@corates.org
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
