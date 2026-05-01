import { useSyncExternalStore, useEffect, lazy, Suspense } from 'react';
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import appCss from '../styles.css?url';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { captureException } from '@/config/sentry';
import { TriangleAlertIcon, RefreshCwIcon } from 'lucide-react';

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
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://plausible.jacobmaynard.dev https://apis.google.com",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob:${import.meta.env.DEV ? ' http://localhost:*' : ''}`,
      import.meta.env.DEV ?
        "connect-src 'self' http://localhost:* ws://localhost:* https://api.crossref.org https://eutils.ncbi.nlm.nih.gov https://api.unpaywall.org https://plausible.jacobmaynard.dev https://*.ingest.us.sentry.io"
      : "connect-src 'self' wss://corates.org https://api.crossref.org https://eutils.ncbi.nlm.nih.gov https://api.unpaywall.org https://plausible.jacobmaynard.dev https://*.ingest.us.sentry.io",
      "worker-src 'self' blob:",
      "font-src 'self'",
      'frame-src https://docs.google.com',
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join('; '),
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
      {
        src: 'https://plausible.jacobmaynard.dev/js/pa-FwZkTF3ReuZ7O5WTRKBr_.js',
        async: true,
      },
      {
        children:
          'window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()',
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
  useEffect(() => {
    captureException(error, { component: 'RootError', action: 'render' });
  }, [error]);

  const message =
    import.meta.env.DEV ? error.message : 'An unexpected error occurred. Please try refreshing.';

  return (
    <div className='flex min-h-[50vh] items-center justify-center p-8'>
      <div className='border-border bg-card w-full max-w-sm rounded-xl border p-6 text-center shadow-sm'>
        <div className='bg-destructive/10 mx-auto mb-4 flex size-12 items-center justify-center rounded-full'>
          <TriangleAlertIcon className='text-destructive size-6' />
        </div>
        <h3 className='text-foreground mb-1 text-base font-semibold'>Something went wrong</h3>
        <p className='text-muted-foreground mb-5 text-sm'>{message}</p>
        <button
          onClick={reset}
          className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
        >
          <RefreshCwIcon className='size-3.5' />
          Try again
        </button>
      </div>
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
