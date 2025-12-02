import { Title, Meta } from '@solidjs/meta';
import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';
import AboutHero from '~/components/about/AboutHero';
import WhatIsCoRATES from '~/components/about/WhatIsCoRATES';
import WhoIsCoRATESFor from '~/components/about/WhoIsCoRATESFor';
import HowDidCoRATESStart from '~/components/about/HowDidCoRATESStart';
import WhoDevelopedCoRATES from '~/components/about/WhoDevelopedCoRATES';
import AboutCTA from '~/components/about/AboutCTA';

export default function About() {
  return (
    <>
      <Title>About CoRATES - Our Story and Team</Title>
      <Meta
        name='description'
        content='Learn about CoRATES, developed by a research synthesis expert and software engineer to support rigorous evidence appraisal.'
      />
      <div class='min-h-screen bg-linear-to-b from-blue-50 to-white'>
        <Navbar />
        <main>
          <AboutHero />
          <WhatIsCoRATES />
          <WhoIsCoRATESFor />
          <HowDidCoRATESStart />
          <WhoDevelopedCoRATES />
          <AboutCTA />
        </main>
        <Footer />
      </div>
    </>
  );
}
