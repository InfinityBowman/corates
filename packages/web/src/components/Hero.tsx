import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

import HeroWavesCanvas from './HeroWavesCanvas';

export default function Hero() {
  return (
    <section className='relative isolate max-h-screen min-h-screen overflow-hidden border-b border-gray-200/80'>
      <div className='mx-auto flex max-w-7xl flex-col items-center px-4 pt-8 pb-0 sm:px-6 md:pt-14'>
        <div className='mb-2 w-full max-w-4xl'>
          <div className='mb-6 flex items-center justify-center gap-4'>
            <h1 className='m-0 text-center text-3xl leading-tight font-extrabold tracking-tight text-gray-900 sm:text-4xl md:text-5xl'>
              <span className='text-blue-700'>Co</span>llaborative{' '}
              <span className='text-blue-700'>R</span>
              esearch <span className='text-blue-700'>A</span>ppraisal
              <span className='text-blue-700'> T</span>ool for
              <span className='text-blue-700'> E</span>
              vidence <span className='text-blue-700'>S</span>ynthesis
            </h1>
          </div>
          <p className='mx-auto mb-8 max-w-3xl text-center text-lg leading-tight text-gray-600 sm:text-xl'>
            Streamline the quality and risk-of-bias appraisal process with intuitive workflows,
            real-time collaboration, and automation that improve transparency and efficiency at
            every stage.
          </p>
          <div className='mb-2 flex flex-col justify-center gap-4 sm:flex-row sm:gap-6'>
            <Link
              to='/checklist'
              className='group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-blue-700 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto'
            >
              Start an Appraisal
              <ArrowRight className='size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Link>
            <Link
              to='/signup'
              className='inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-base font-semibold text-gray-800 shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto'
            >
              Start a Review Project
            </Link>
          </div>
        </div>
      </div>
      {/* Product Screenshot: full width, bottom, angled */}
      <div className='flex w-full justify-start px-4 sm:justify-center sm:px-6 md:translate-x-10'>
        <div className='relative w-[150%] max-w-none shrink-0 sm:w-full sm:max-w-5xl sm:shrink'>
          <div className='mt-0 mb-0 transform-[perspective(900px)_rotateX(10deg)_rotateZ(-6deg)_rotateY(6deg)] overflow-hidden rounded-2xl border border-gray-200 bg-linear-to-br from-gray-100 to-gray-50 shadow-2xl md:transform-[perspective(1200px)_rotateX(14deg)_rotateZ(-10deg)_rotateY(8deg)]'>
            <div className='flex aspect-16/7 items-center justify-center p-0.5 sm:p-1'>
              <div className='text-center'>
                <div
                  className='flex h-full w-full flex-col rounded-xl border border-gray-200 bg-gray-50 shadow-lg'
                  style={{ boxShadow: '0 6px 32px 0 rgba(0,0,0,0.10)' }}
                >
                  {/* Browser top bar */}
                  <div className='flex items-center rounded-t-xl border-b border-gray-200 bg-gray-100 px-1.5 py-0.5 sm:px-3 sm:py-1'>
                    <div className='flex items-center gap-1.5 sm:gap-2'>
                      <span className='inline-block size-2 rounded-full bg-red-400 sm:size-2.5' />
                      <span className='inline-block size-2 rounded-full bg-yellow-400 sm:size-2.5' />
                      <span className='inline-block size-2 rounded-full bg-green-400 sm:size-2.5' />
                    </div>
                    <div className='mx-4 flex-1'>
                      <div className='text-2xs mx-auto max-w-50 truncate rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-gray-500 sm:max-w-[320px] sm:px-3 sm:py-1 sm:text-xs'>
                        corates.org/dashboard
                      </div>
                    </div>
                  </div>
                  <div className='flex flex-1 items-center justify-center overflow-hidden rounded-b-xl bg-white'>
                    <picture>
                      <source srcSet='/product.webp' type='image/webp' />
                      <img
                        src='/product.png'
                        alt='CoRATES product screenshot'
                        className='h-full w-full object-cover'
                        width='2524'
                        height='1770'
                        fetchPriority='high'
                        decoding='async'
                        style={{ display: 'block' }}
                      />
                    </picture>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Bottom fade: dissolve the ribbon canvas and angled screenshot into the
          page background so the section boundary reads as a soft fade into the
          divider line rather than a hard clip. */}
      <div className='pointer-events-none absolute inset-x-0 bottom-0 z-10 h-56 bg-linear-to-b from-transparent to-white' />
      {/* Background decoration */}
      <div className='absolute top-0 left-1/2 -z-10 size-250 -translate-x-1/2 rounded-full bg-linear-to-b from-blue-700/5 to-transparent blur-3xl' />
      <div className='absolute top-1/2 right-0 -z-10 size-125 rounded-full bg-linear-to-l from-blue-700/5 to-transparent blur-3xl' />
      <HeroWavesCanvas settings={{ rotate: -15, edgeFade: 0.22 }} />
    </section>
  );
}
