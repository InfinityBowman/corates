import { Title, Meta } from '@solidjs/meta';
import Hero from '~/components/Hero';
import Features from '~/components/Features';
import WhyChoose from '~/components/WhyChoose';
import HowItWorks from '~/components/HowItWorks';
import Audience from '~/components/Audience';
import CTA from '~/components/CTA';
import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';

export default function Home() {
  return (
    <>
      <Title>CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis</Title>
      <Meta
        name='description'
        content='CoRATES streamlines quality and risk-of-bias appraisal with intuitive workflows, real-time collaboration, automatic scoring, and clear visual summaries for evidence synthesis.'
      />
      <div class='min-h-screen bg-linear-to-b from-gray-50 to-white'>
        <Navbar />
        <main>
          <Hero />
          <Features />
          <WhyChoose />
          <HowItWorks />
          <Audience />
          <CTA />
        </main>
        <Footer />
      </div>
    </>
  );
}
