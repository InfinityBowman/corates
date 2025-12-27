import { AiOutlineInfoCircle } from 'solid-icons/ai'

export default function EarlyAccessBanner() {
  return (
    <div class="bg-linear-to-r from-blue-600 to-blue-700 px-6 py-3 text-white">
      <div class="mx-auto flex max-w-6xl items-center justify-center gap-3 text-center">
        <AiOutlineInfoCircle class="h-5 w-5 shrink-0" />
        <p class="text-sm md:text-base">
          <span class="font-semibold">
            CoRATES is in early access. We’re actively building and welcome your
            feedback.
          </span>
        </p>
      </div>
    </div>
  )
}
