import { ArrowRightIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export default function CTA() {
  return (
    <section className='mx-auto max-w-6xl px-6 py-16'>
      <div className='rounded-2xl bg-blue-700 p-8 text-center md:p-12'>
        <h2 className='mb-4 text-2xl font-bold text-white md:text-3xl'>
          Try it on the next study you have to appraise
        </h2>
        <p className='mx-auto mb-8 max-w-2xl text-blue-100'>
          A single appraisal is free and needs no account. When you are ready to bring in a second
          reviewer, a 14-day trial covers a full project with up to 10 collaborators.
        </p>
        <Link
          to='/signup'
          className='inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-blue-600 transition-colors hover:bg-blue-100'
        >
          Set Up a Review Project
          <ArrowRightIcon className='size-5' />
        </Link>
      </div>
    </section>
  );
}
