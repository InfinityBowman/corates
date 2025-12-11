import { urls } from '~/lib/config';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer class='border-t border-gray-100 py-8'>
      <div class='max-w-6xl mx-auto px-6'>
        <div class='flex flex-col sm:flex-row items-center justify-between gap-4'>
          <p class='text-gray-500 text-sm'>
            {year} CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis
          </p>
          <div class='flex gap-6 text-sm'>
            <a href='/about' class='text-gray-500 hover:text-gray-700 transition-colors'>
              About
            </a>
            <a
              href='/privacy'
              class='text-gray-500 hover:text-gray-700 transition-colors'
            >
              Privacy
            </a>
            <a href='/terms' class='text-gray-500 hover:text-gray-700 transition-colors'>
              Terms
            </a>
            <a
              href={urls.signIn()}
              rel='external'
              class='text-gray-500 hover:text-gray-700 transition-colors'
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
