import { urls } from '~/lib/config';

export default function CTA() {
  return (
    <section class='max-w-6xl mx-auto px-6 py-16 md:py-24'>
      <div class='bg-linear-to-br from-blue-700 to-blue-700/90 rounded-3xl p-8 md:p-16 text-center'>
        <h2 class='text-3xl md:text-4xl font-bold text-white mb-4'>
          Ready to streamline your evidence appraisal?
        </h2>
        <p class='text-white/80 text-lg mb-8 max-w-2xl mx-auto'>
          Start your first appraisal in minutes. No credit card required.
        </p>
        <div class='flex flex-col sm:flex-row gap-4 justify-center'>
          <a
            href={urls.checklist()}
            class='inline-flex items-center justify-center gap-2 bg-white text-blue-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700/5 transition-colors'
          >
            Start an Appraisal
          </a>
          <a
            href={urls.signUp()}
            class='inline-flex items-center justify-center gap-2 bg-blue-700/80 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700/60 transition-colors border border-white/20'
          >
            Create Free Account
          </a>
        </div>
      </div>
    </section>
  );
}
