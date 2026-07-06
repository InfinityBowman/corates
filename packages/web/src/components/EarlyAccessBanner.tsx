import { InfoIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';
import { useFeedbackStore } from '@/stores/feedbackStore';

export default function EarlyAccessBanner() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const openFeedback = useFeedbackStore(s => s.open);

  return (
    <div className='bg-linear-to-r from-blue-600 to-blue-700 px-6 py-3 text-white'>
      <div className='mx-auto flex max-w-6xl items-center justify-center gap-3 text-center'>
        <InfoIcon className='size-5 shrink-0' />
        <p className='text-sm md:text-base'>
          <span className='font-semibold'>
            CoRATES is in early access. We're actively building and{' '}
            {isLoggedIn ?
              <button
                type='button'
                onClick={openFeedback}
                className='cursor-pointer underline underline-offset-2 hover:text-blue-100'
              >
                welcome your feedback
              </button>
            : <Link
                to='/contact'
                className='underline underline-offset-2 hover:text-blue-100'
              >
                welcome your feedback
              </Link>
            }
            .
          </span>
        </p>
      </div>
    </div>
  );
}
