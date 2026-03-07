import { createFileRoute } from '@tanstack/react-router'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AboutHero from '../components/about/AboutHero'
import WhatIsCoRATES from '../components/about/WhatIsCoRATES'
import WhoIsCoRATESFor from '../components/about/WhoIsCoRATESFor'
import HowDidCoRATESStart from '../components/about/HowDidCoRATESStart'
import WhoDevelopedCoRATES from '../components/about/WhoDevelopedCoRATES'
import CTA from '../components/CTA'
import { config } from '../lib/config'

const pageUrl = `${config.appUrl}/about`
const title = 'About CoRATES - Our Story and Team'
const description =
  'Learn about CoRATES, developed by a research synthesis expert and software engineer to support rigorous evidence appraisal.'

export const Route = createFileRoute('/about')({
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
  component: AboutPage,
})

function AboutPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-blue-50 to-white">
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
  )
}
