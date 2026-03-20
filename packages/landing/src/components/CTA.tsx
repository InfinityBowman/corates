import { FaArrowRight } from 'react-icons/fa6';
import { Link } from '@tanstack/react-router';

export default function CTA() {
  return (
    <section className='mx-auto max-w-6xl px-6 py-16'>
      <div className='rounded-2xl bg-blue-700 p-8 text-center md:p-12'>
        <h2 className='mb-4 text-2xl font-bold text-white md:text-3xl'>
          Ready to streamline your evidence appraisal process?
        </h2>
        <p className='mx-auto mb-8 max-w-2xl text-blue-100'>
          Join a growing community of researchers who use CoRATES to streamline their evidence
          appraisal workflows and improve efficiency and transparency throughout the process.
        </p>
        <Link
          to='/signup'
          className='inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-blue-600 transition-colors hover:bg-blue-100'
        >
          Get Started
          <FaArrowRight className='h-5 w-5' />
        </Link>
      </div>
    </section>
  );
}
