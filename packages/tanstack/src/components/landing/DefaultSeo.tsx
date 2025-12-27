import { config } from '@lib/landing/config'

/**
 * Default SEO meta tags for all pages
 * These are applied globally via the root route head configuration
 */
export function getDefaultSeoMeta() {
  const imageUrl = `${config.appUrl}/landing_preview.webp`

  return {
    meta: [
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'CoRATES' },
      { property: 'og:image', content: imageUrl },
      { property: 'og:image:alt', content: 'CoRATES product screenshot' },
      { property: 'og:image:width', content: '2524' },
      { property: 'og:image:height', content: '1770' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: imageUrl },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
    ],
  }
}
