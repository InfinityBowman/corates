import { AiOutlineInfoCircle } from 'solid-icons/ai';

export default function EarlyAccessBanner() {
  return (
    <div class='bg-linear-to-r from-blue-600 to-blue-700 text-white py-3 px-6'>
      <div class='max-w-6xl mx-auto flex items-center justify-center gap-3 text-center'>
        <AiOutlineInfoCircle class='w-5 h-5 shrink-0' />
        <p class='text-sm md:text-base'>
          <span class='font-semibold'>
            CoRATES is in early access. We’re actively building and welcome your feedback.
          </span>
        </p>
      </div>
    </div>
  );
}
