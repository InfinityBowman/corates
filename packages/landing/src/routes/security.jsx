import { Title, Meta, Link } from '@solidjs/meta';
import { FiShield, FiLock, FiServer, FiUsers, FiAlertCircle, FiMail } from 'solid-icons/fi';
import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';
import { config } from '~/lib/config';

export default function Security() {
  const pageUrl = `${config.appUrl}/security`;
  const title = 'Security - CoRATES';
  const description =
    'Learn about the security measures CoRATES implements to protect your research data and ensure the integrity of your evidence synthesis work.';

  return (
    <>
      <Title>{title}</Title>
      <Meta name='description' content={description} />
      <Link rel='canonical' href={pageUrl} />
      <Meta property='og:title' content={title} />
      <Meta property='og:description' content={description} />
      <Meta property='og:url' content={pageUrl} />
      <Meta name='twitter:title' content={title} />
      <Meta name='twitter:description' content={description} />

      <div class='min-h-screen flex flex-col'>
        <Navbar />

        <main class='flex-1 py-16'>
          <div class='max-w-3xl mx-auto px-6'>
            <h1 class='text-4xl font-bold text-gray-900 mb-2'>Security</h1>
            <p class='text-gray-500 mb-8'>How we protect your research data</p>

            <div class='text-gray-700 leading-relaxed space-y-8'>
              <p>
                At CoRATES, we understand that your research data is valuable and sensitive. We are
                committed to implementing robust security measures to protect your information and
                ensure the integrity of your evidence synthesis work.
              </p>

              {/* Security Features */}
              <div class='grid gap-6'>
                <div class='bg-gray-50 rounded-lg p-6'>
                  <div class='flex items-start gap-4'>
                    <div class='shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center'>
                      <FiLock class='w-5 h-5 text-blue-600' />
                    </div>
                    <div>
                      <h2 class='text-lg font-semibold text-gray-900 mb-2'>Encryption</h2>
                      <p class='text-gray-600'>
                        All data transmitted between your browser and our servers is encrypted using
                        TLS (Transport Layer Security). Data at rest, including uploaded PDFs and
                        application data, is encrypted using industry-standard encryption
                        (AES-256-GCM) provided by our infrastructure providers.
                      </p>
                    </div>
                  </div>
                </div>

                <div class='bg-gray-50 rounded-lg p-6'>
                  <div class='flex items-start gap-4'>
                    <div class='shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center'>
                      <FiShield class='w-5 h-5 text-blue-600' />
                    </div>
                    <div>
                      <h2 class='text-lg font-semibold text-gray-900 mb-2'>Authentication</h2>
                      <p class='text-gray-600'>
                        We support multiple secure authentication methods including OAuth (Google,
                        ORCID), passwordless login via email, and two-factor authentication (2FA)
                        for enhanced account security.
                      </p>
                    </div>
                  </div>
                </div>
                <div class='bg-gray-50 rounded-lg p-6'>
                  <div class='flex items-start gap-4'>
                    <div class='shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center'>
                      <FiAlertCircle class='w-5 h-5 text-blue-600' />
                    </div>
                    <div>
                      <h2 class='text-lg font-semibold text-gray-900 mb-2'>Abuse Prevention</h2>
                      <p class='text-gray-600'>
                        We apply rate limiting to sensitive endpoints (such as sign-in,
                        registration, password resets, and email flows) to reduce brute-force
                        attempts and automated abuse.
                      </p>
                    </div>
                  </div>
                </div>

                <div class='bg-gray-50 rounded-lg p-6'>
                  <div class='flex items-start gap-4'>
                    <div class='shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center'>
                      <FiServer class='w-5 h-5 text-blue-600' />
                    </div>
                    <div>
                      <h2 class='text-lg font-semibold text-gray-900 mb-2'>Infrastructure</h2>
                      <p class='text-gray-600'>
                        CoRATES is hosted on Cloudflare's global network, providing enterprise-grade
                        security, DDoS protection, and a Web Application Firewall (WAF) to protect
                        against common web vulnerabilities.
                      </p>
                    </div>
                  </div>
                </div>

                <div class='bg-gray-50 rounded-lg p-6'>
                  <div class='flex items-start gap-4'>
                    <div class='shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center'>
                      <FiUsers class='w-5 h-5 text-blue-600' />
                    </div>
                    <div>
                      <h2 class='text-lg font-semibold text-gray-900 mb-2'>Access Control</h2>
                      <p class='text-gray-600'>
                        Project-level access controls ensure that only authorized team members can
                        view and edit your research data. You control who has access to your
                        projects and can revoke access at any time. You retain full ownership of
                        your research data. CoRATES does not sell or share your data with third
                        parties.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Responsible Disclosure */}
              <div class='border-t border-gray-200 pt-8'>
                <div class='flex items-start gap-4'>
                  <div class='shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center'>
                    <FiAlertCircle class='w-5 h-5 text-amber-600' />
                  </div>
                  <div>
                    <h2 class='text-xl font-semibold text-gray-900 mb-3'>Responsible Disclosure</h2>
                    <p class='text-gray-600 mb-4'>
                      We take security vulnerabilities seriously. If you believe you have found a
                      security vulnerability in CoRATES, we encourage you to report it to us
                      responsibly. We will not pursue legal action against researchers who report
                      vulnerabilities responsibly and in good faith.
                    </p>
                    <p class='text-gray-600 mb-4'>
                      Please send details of the vulnerability to{' '}
                      <a
                        href='mailto:contact@corates.org'
                        class='text-blue-600 hover:text-blue-700 font-medium'
                      >
                        contact@corates.org
                      </a>
                      . Include as much information as possible, such as:
                    </p>
                    <ul class='list-disc list-outside ml-6 space-y-1 text-gray-600 mb-4'>
                      <li>A description of the vulnerability</li>
                      <li>Steps to reproduce the issue</li>
                      <li>Potential impact of the vulnerability</li>
                      <li>Any suggestions for remediation</li>
                    </ul>
                    <p class='text-gray-600'>
                      We will acknowledge receipt of your report within 48 hours and will work with
                      you to understand and address the issue promptly. We ask that you give us
                      reasonable time to investigate and mitigate the vulnerability before making
                      any information public.
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div class='border-t border-gray-200 pt-8'>
                <div class='flex items-start gap-4'>
                  <div class='shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center'>
                    <FiMail class='w-5 h-5 text-blue-600' />
                  </div>
                  <div>
                    <h2 class='text-xl font-semibold text-gray-900 mb-3'>Security Questions</h2>
                    <p class='text-gray-600'>
                      If you have any questions about our security practices or would like more
                      information, please contact us at{' '}
                      <a
                        href='mailto:contact@corates.org'
                        class='text-blue-600 hover:text-blue-700 font-medium'
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
    </>
  );
}
