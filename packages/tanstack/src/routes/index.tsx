import { createFileRoute } from '@tanstack/solid-router'
import Hero from '@components/landing/Hero'
import FeatureShowcase from '@components/landing/FeatureShowcase'
import HowItWorks from '@components/landing/HowItWorks'
import SupportedTools from '@components/landing/SupportedTools'
import Audience from '@components/landing/Audience'
import CTA from '@components/landing/CTA'
import Navbar from '@components/landing/Navbar'
import Footer from '@components/landing/Footer'
import { config } from '@lib/landing/config'

export const Route = createFileRoute('/')({
  prerender: true,
  head: () => {
    const pageUrl = `${config.appUrl}/`
    const title =
      'CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis'
    const description =
      'CoRATES streamlines quality and risk-of-bias appraisal with intuitive workflows, real-time collaboration, automatic scoring, and clear visual summaries for evidence synthesis.'
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
  component: () => (
    <div class="min-h-screen bg-linear-to-b from-blue-50 to-white">
      <Navbar />
      <main>
        <Hero />
        <FeatureShowcase />
        <HowItWorks />
        <Audience />
        <SupportedTools />
        <CTA />
      </main>
      <Footer />
    </div>
  ),
})
