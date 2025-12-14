import { Title, Meta, Link } from '@solidjs/meta';
import Hero from '~/components/Hero';
import Features from '~/components/Features';
// import WhyChoose from '~/components/WhyChoose';
import TrustLogos from '~/components/TrustLogos';
// import Stats from '~/components/Stats';
import FeatureShowcase from '~/components/FeatureShowcase';
import HowItWorks from '~/components/HowItWorks';
import SupportedTools from '~/components/SupportedTools';
// import Testimonials from '~/components/Testimonials';
import Audience from '~/components/Audience';
import CTA from '~/components/CTA';
import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';
import { config } from '~/lib/config';

export default function Home() {
  const pageUrl = `${config.appUrl}/`;
  const title = 'CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis';
  const description =
    'CoRATES streamlines quality and risk-of-bias appraisal with intuitive workflows, real-time collaboration, automatic scoring, and clear visual summaries for evidence synthesis.';

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
          <Hero />
          <TrustLogos />
          {/* <Stats /> */}
          <FeatureShowcase />
          <Features />
          {/* <WhyChoose /> */}
          <HowItWorks />
          <Audience />
          <SupportedTools />
          {/* <Testimonials /> */}
          <CTA />
        </main>
        <Footer />
      </div>
    </>
  );
}
