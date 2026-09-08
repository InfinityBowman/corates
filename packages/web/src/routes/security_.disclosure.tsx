import { createFileRoute, Link } from '@tanstack/react-router';
import { AlertCircleIcon, ShieldCheckIcon, ClockIcon, ListChecksIcon } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { config } from '@/lib/config';

const pageUrl = `${config.appUrl}/security/disclosure`;
const title = 'Vulnerability Disclosure Policy - CoRATES';
const description =
  'How to report a security vulnerability in CoRATES: what is in scope, what to expect from us, and the safe harbor we extend to good-faith research.';

export const Route = createFileRoute('/security_/disclosure')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  }),
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: pageUrl },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    links: [{ rel: 'canonical', href: pageUrl }],
  }),
  component: DisclosurePage,
});

const contact = 'support@corates.org';

function Section({
  icon,
  heading,
  children,
}: {
  icon: React.ReactNode;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className='border-t border-gray-200 pt-8'>
      <div className='flex items-start gap-4'>
        <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
          {icon}
        </div>
        <div className='min-w-0 flex-1'>
          <h2 className='mb-3 text-xl font-semibold text-gray-900'>{heading}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}

function DisclosurePage() {
  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />

      <main className='flex-1 bg-white'>
        <div className='mx-auto max-w-4xl px-6 py-16'>
          <div className='mb-12'>
            <h1 className='mb-4 text-3xl font-bold text-gray-900'>
              Vulnerability Disclosure Policy
            </h1>
            <p className='text-lg text-gray-600'>
              If you have found a security vulnerability in CoRATES, we want to hear about it. This
              page explains what to report, how, and what you can expect from us. It is also linked
              from{' '}
              <a
                href='/.well-known/security.txt'
                className='font-medium text-blue-600 hover:text-blue-700'
              >
                /.well-known/security.txt
              </a>
              .
            </p>
          </div>

          <div className='flex flex-col gap-10'>
            <Section
              icon={<AlertCircleIcon className='size-5 text-blue-600' />}
              heading='How to report'
            >
              <p className='mb-4 text-gray-600'>
                Email{' '}
                <a
                  href={`mailto:${contact}`}
                  className='font-medium text-blue-600 hover:text-blue-700'
                >
                  {contact}
                </a>{' '}
                with a description of the issue, the steps or request sequence needed to reproduce
                it, the impact you believe it has, and any suggested fix. Do not open a public
                GitHub issue for security reports.
              </p>
              <p className='text-gray-600'>
                Please do not access, modify, or download data that is not your own beyond what is
                needed to demonstrate the issue. If you encounter another user&apos;s data, stop and
                report it.
              </p>
            </Section>

            <Section icon={<ListChecksIcon className='size-5 text-blue-600' />} heading='Scope'>
              <p className='mb-3 text-gray-600'>In scope:</p>
              <ul className='mb-4 ml-6 flex list-outside list-disc flex-col gap-1 text-gray-600'>
                <li>corates.org, including the web application and every /api endpoint</li>
                <li>Real-time synchronization and collaboration services</li>
                <li>PDF upload, storage, and rendering</li>
                <li>
                  Authentication, sessions, and access control between projects and workspaces
                </li>
              </ul>
              <p className='mb-3 text-gray-600'>Out of scope:</p>
              <ul className='ml-6 flex list-outside list-disc flex-col gap-1 text-gray-600'>
                <li>
                  Denial of service, load testing, or automated scanning that degrades the service
                </li>
                <li>Social engineering or phishing of CoRATES users or staff</li>
                <li>
                  Vulnerabilities in third-party services we use (Cloudflare, Stripe, Postmark,
                  Google, ORCID); report those to the vendor
                </li>
                <li>Reports from automated tools without a demonstrated impact</li>
                <li>Missing security headers or best-practice findings with no exploit path</li>
              </ul>
            </Section>

            <Section icon={<ClockIcon className='size-5 text-blue-600' />} heading='What to expect'>
              <ul className='ml-6 flex list-outside list-disc flex-col gap-1 text-gray-600'>
                <li>Acknowledgement of your report within 48 hours</li>
                <li>An initial assessment and expected timeline within 7 days</li>
                <li>Updates as we investigate, and notice when the issue is fixed</li>
                <li>
                  Public credit in our security acknowledgements if you would like it, once the fix
                  is deployed
                </li>
              </ul>
              <p className='mt-4 text-gray-600'>
                We ask that you give us 90 days from your report before publishing details, or until
                a fix is deployed if that is sooner. If we need longer for a complex issue, we will
                tell you why.
              </p>
            </Section>

            <Section
              icon={<ShieldCheckIcon className='size-5 text-blue-600' />}
              heading='Safe harbor'
            >
              <p className='mb-4 text-gray-600'>
                We consider security research conducted in good faith and consistent with this
                policy to be authorized. We will not pursue or support legal action against you for
                it, and if a third party initiates action, we will make it known that your research
                was conducted under this policy.
              </p>
              <p className='text-gray-600'>
                Good faith means you act within scope, avoid privacy violations and service
                disruption, do not exploit an issue beyond what is needed to demonstrate it, and
                report promptly. If you are unsure whether something is covered, ask us first at{' '}
                <a
                  href={`mailto:${contact}`}
                  className='font-medium text-blue-600 hover:text-blue-700'
                >
                  {contact}
                </a>
                .
              </p>
            </Section>

            <div className='border-t border-gray-200 pt-8 text-gray-600'>
              For how we protect data day to day, see the{' '}
              <Link to='/security' className='font-medium text-blue-600 hover:text-blue-700'>
                security overview
              </Link>
              .
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
