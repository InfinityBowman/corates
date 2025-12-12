import { FaSolidArrowRight } from 'solid-icons/fa';
import { urls } from '~/lib/config';

export default function CTA() {
  return (
    <section class='max-w-6xl mx-auto px-6 py-16'>
      <div class='bg-blue-700 rounded-2xl p-8 md:p-12 text-center'>
        <h2 class='text-2xl md:text-3xl font-bold text-white mb-4'>
          Ready to streamline your evidence appraisal process?
        </h2>
        <p class='text-blue-100 mb-8 max-w-2xl mx-auto'>
          Join a growing community of researchers who use CoRATES to streamline their
          evidence appraisal workflows and improve efficiency and transparency throughout
          the process.
        </p>
        <a
          href={urls.signUp()}
          rel='external'
          class='inline-flex items-center justify-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors'
        >
          Get Started
          <FaSolidArrowRight class='w-5 h-5' />
        </a>
      </div>
    </section>
  );
}
