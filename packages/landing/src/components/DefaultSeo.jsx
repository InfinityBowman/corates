import { Meta } from '@solidjs/meta';
import { config } from '~/lib/config';

const structuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Syntch LLC',
      alternateName: 'CoRATES',
      url: 'https://corates.org',
      logo: 'https://corates.org/web-app-manifest-512x512.png',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'support@corates.org',
        contactType: 'customer service',
      },
    },
    {
      '@type': 'WebApplication',
      name: 'CoRATES',
      url: 'https://corates.org',
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

export default function DefaultSeo() {
  const imageUrl = `${config.appUrl}/landing_preview.webp`;

  return (
    <>
      <Meta property='og:type' content='website' />
      <Meta property='og:site_name' content='CoRATES' />
      <Meta property='og:image' content={imageUrl} />
      <Meta property='og:image:alt' content='CoRATES product screenshot' />
      <Meta property='og:image:width' content='2524' />
      <Meta property='og:image:height' content='1770' />

      <Meta name='twitter:card' content='summary_large_image' />
      <Meta name='twitter:image' content={imageUrl} />

      <Meta name='robots' content='index,follow,max-image-preview:large' />

      {/* eslint-disable-next-line solid/no-innerhtml */}
      <script type='application/ld+json' innerHTML={structuredData} />
    </>
  );
}
