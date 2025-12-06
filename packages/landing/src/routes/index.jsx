import { Title, Meta } from '@solidjs/meta';
import Hero from '~/components/Hero';
import TrustLogos from '~/components/TrustLogos';
import Stats from '~/components/Stats';
import FeatureShowcase from '~/components/FeatureShowcase';
import HowItWorks from '~/components/HowItWorks';
import SupportedTools from '~/components/SupportedTools';
import Testimonials from '~/components/Testimonials';
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
      <div class='min-h-screen bg-white'>
        <Navbar />
        <main>
          <Hero />
          <TrustLogos />
          <Stats />
          <FeatureShowcase />
          <HowItWorks />
          <SupportedTools />
          <Testimonials />
          <CTA />
        </main>
        <Footer />
      </div>
    </>
  );
}
