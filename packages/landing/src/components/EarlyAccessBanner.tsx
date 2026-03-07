import { AiOutlineInfoCircle } from 'react-icons/ai'

export default function EarlyAccessBanner() {
  return (
    <div className="bg-linear-to-r from-blue-600 to-blue-700 px-6 py-3 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 text-center">
        <AiOutlineInfoCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm md:text-base">
          <span className="font-semibold">
            CoRATES is in early access. We're actively building and welcome your feedback.
          </span>
        </p>
      </div>
    </div>
  )
}
