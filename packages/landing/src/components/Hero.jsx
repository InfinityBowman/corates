import { AiOutlineArrowRight } from 'solid-icons/ai';
import { urls } from '~/lib/config';

export default function Hero() {
  return (
    <section class='relative overflow-hidden'>
      <div class='max-w-6xl mx-auto px-6 py-16 md:py-24 text-center'>
        <h1 class='text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight max-w-3xl mx-auto'>
          <span class='text-blue-600'>Co</span>llaborative{' '}
          <span class='text-blue-600'>R</span>
          esearch <span class='text-blue-600'>A</span>ppraisal
          <span class='text-blue-600'> T</span>ool for
          <span class='text-blue-600'> E</span>vidence{' '}
          <span class='text-blue-600'>S</span>ynthesis
        </h1>

        <p class='text-lg text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto'>
          Streamline the entire quality and risk-of-bias appraisal process with intuitive
          workflows, real-time collaboration, automatic scoring, and clear visual
          summaries, creating greater transparency and efficiency at every step.
        </p>

        <div class='flex flex-col sm:flex-row gap-4 justify-center'>
          <a
            href={urls.signUp()}
            rel='external'
            class='inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm'
          >
            Get Started
            <AiOutlineArrowRight class='w-5 h-5' />
          </a>
          <a
            href={urls.signIn()}
            rel='external'
            class='inline-flex items-center justify-center gap-2 bg-white text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors border border-gray-200'
          >
            Sign In
          </a>
        </div>

        <p class='mt-6 text-sm text-gray-500'>
          Want to try it first?{' '}
          <a
            href={urls.checklist()}
            class='text-blue-600 hover:text-blue-700 font-medium hover:underline'
            rel='external'
          >
            Start an appraisal
          </a>
        </p>
      </div>

      {/* Background blur */}
      <div class='absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-linear-to-b from-blue-50/50 to-transparent rounded-full blur-3xl -z-10' />
    </section>
  );
}
