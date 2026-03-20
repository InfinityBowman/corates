import { useSyncExternalStore, lazy, Suspense } from 'react';
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import appCss from '../styles.css?url';
import type { ErrorComponentProps } from '@tanstack/react-router';

const LazyDevPanel =
  import.meta.env.VITE_DEV_PANEL === 'true' ?
    lazy(() => import('@/components/dev/DevPanel').then(m => ({ default: m.DevPanel })))
  : null;

const emptySubscribe = () => () => {};

/** Render children only on the client, never during SSR. */
function ClientOnly({ children }: { children: React.ReactNode }) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  return isClient ? children : null;
}

const SITE_URL = 'https://corates.org';
const IMAGE_URL = `${SITE_URL}/landing_preview.png`;

const structuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Syntch LLC',
      alternateName: 'CoRATES',
      url: SITE_URL,
      logo: `${SITE_URL}/web-app-manifest-512x512.png`,
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'support@corates.org',
        contactType: 'customer service',
      },
    },
    {
      '@type': 'WebApplication',
      name: 'CoRATES',
      url: SITE_URL,
      applicationCategory: 'EducationalApplication',
      applicationSubCategory: 'Research Tool',
      description:
        'Collaborative Research Appraisal Tool for Evidence Synthesis. Streamlines quality and risk-of-bias appraisal with real-time collaboration, automatic scoring, and visual summaries.',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern web browser',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free plan available',
      },
      provider: {
        '@type': 'Organization',
        name: 'Syntch LLC',
      },
    },
  ],
});

export const Route = createRootRoute({
  headers: () => ({
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        title: 'CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis',
      },
      {
        name: 'description',
        content:
          'CoRATES streamlines quality and risk-of-bias appraisal with intuitive workflows, real-time collaboration, automatic scoring, and clear visual summaries for evidence synthesis.',
      },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'CoRATES' },
      {
        property: 'og:title',
        content: 'CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis',
      },
      {
        property: 'og:description',
        content:
          'CoRATES streamlines quality and risk-of-bias appraisal with intuitive workflows, real-time collaboration, automatic scoring, and clear visual summaries for evidence synthesis.',
      },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:image', content: IMAGE_URL },
      { property: 'og:image:alt', content: 'CoRATES product screenshot' },
      { property: 'og:image:width', content: '2524' },
      { property: 'og:image:height', content: '1770' },
      { property: 'og:locale', content: 'en_US' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'theme-color', content: '#ffffff' },
      { name: 'twitter:image', content: IMAGE_URL },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      {
        rel: 'icon',
        href: '/favicon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
      },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'stylesheet', href: appCss },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: structuredData,
      },
    ],
  }),

  component: RootLayout,
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: RootError,
});

function NotFound() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center gap-4 text-center'>
      <h1 className='text-6xl font-bold tracking-tight text-blue-600'>404</h1>
      <p className='text-gray-600'>This page could not be found.</p>
      <Link
        to='/'
        className='mt-4 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
      >
        Back to home
      </Link>
    </div>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <head>
        <HeadContent />
      </head>
      <body className='min-h-screen bg-white text-gray-900 antialiased'>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootError({ error, reset }: ErrorComponentProps) {
  const message =
    import.meta.env.DEV ? error.message : 'An unexpected error occurred. Please try refreshing.';

  return (
    <div className='flex flex-col items-center justify-center gap-4 py-32 text-center'>
      <h1 className='text-4xl font-bold'>Something went wrong</h1>
      <p className='max-w-md text-gray-600'>{message}</p>
      <button
        onClick={reset}
        className='text-sm text-blue-600 underline underline-offset-4 hover:text-blue-700'
      >
        Try again
      </button>
    </div>
  );
}

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Outlet />
          <Toaster />
          {LazyDevPanel && (
            <ClientOnly>
              <Suspense>
                <LazyDevPanel />
              </Suspense>
            </ClientOnly>
          )}
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
