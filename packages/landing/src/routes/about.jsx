import { Title, Meta, Link } from '@solidjs/meta';
import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';
import AboutHero from '~/components/about/AboutHero';
import WhatIsCoRATES from '~/components/about/WhatIsCoRATES';
import WhoIsCoRATESFor from '~/components/about/WhoIsCoRATESFor';
import HowDidCoRATESStart from '~/components/about/HowDidCoRATESStart';
import WhoDevelopedCoRATES from '~/components/about/WhoDevelopedCoRATES';
import CTA from '~/components/CTA';
import { config } from '~/lib/config';

export default function About() {
  const pageUrl = `${config.appUrl}/about`;
  const title = 'About CoRATES - Our Story and Team';
  const description =
    'Learn about CoRATES, developed by a research synthesis expert and software engineer to support rigorous evidence appraisal.';

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
      <div class='min-h-screen bg-linear-to-b from-blue-50 to-white'>
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
    </>
  );
}
