import { createFileRoute } from '@tanstack/solid-router'
import Navbar from '@components/landing/Navbar'
import Footer from '@components/landing/Footer'
import AboutHero from '@components/landing/about/AboutHero'
import WhatIsCoRATES from '@components/landing/about/WhatIsCoRATES'
import WhoIsCoRATESFor from '@components/landing/about/WhoIsCoRATESFor'
import HowDidCoRATESStart from '@components/landing/about/HowDidCoRATESStart'
import WhoDevelopedCoRATES from '@components/landing/about/WhoDevelopedCoRATES'
import CTA from '@components/landing/CTA'
import { config } from '@lib/landing/config'

export const Route = createFileRoute('/about')({
  prerender: true,
  head: () => {
    const pageUrl = `${config.appUrl}/about`
    const title = 'About CoRATES - Our Story and Team'
    const description =
      'Learn about CoRATES, developed by a research synthesis expert and software engineer to support rigorous evidence appraisal.'
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
        <AboutHero />
        <WhatIsCoRATES />
        <WhoIsCoRATESFor />
        <HowDidCoRATESStart />
        <WhoDevelopedCoRATES />
        <CTA />
      </main>
      <Footer />
    </div>
  ),
})
