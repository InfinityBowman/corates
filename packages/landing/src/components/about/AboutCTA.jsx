import { AiOutlineArrowRight } from 'solid-icons/ai';
import { urls } from '~/lib/config';

export default function AboutCTA() {
  return (
    <section class='max-w-5xl mx-auto px-6 py-16'>
      <div class='bg-blue-700 rounded-2xl p-8 md:p-12 text-center'>
        <h2 class='text-2xl md:text-3xl font-bold text-white mb-4'>Ready to get started?</h2>
        <p class='text-blue-700/20 mb-8 max-w-2xl mx-auto'>
          Try CoRATES for free and see how it can streamline your evidence appraisal workflow.
        </p>
        <a
          href={urls.signUp()}
          class='inline-flex items-center justify-center gap-2 bg-white text-blue-700 px-6 py-3 rounded-lg font-medium hover:bg-blue-700/5 transition-colors'
        >
          Get Started
          <AiOutlineArrowRight class='w-5 h-5' />
        </a>
      </div>
    </section>
  );
}
