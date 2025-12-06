import { urls } from '~/lib/config';

export default function Hero() {
  return (
    <section class='relative overflow-hidden min-h-screen'>
      <div class='max-w-7xl mx-auto px-6 pt-8 md:pt-14 pb-0 flex flex-col items-start'>
        <div class='w-full mb-2'>
          <h1 class='text-4xl md:text-6xl font-extrabold text-gray-900 mb-6 tracking-tight leading-tight'>
            CoRATES is a{' '}
            <span class='text-blue-600'>
              Collaborative Research Appraisal Tool for Evidence Synthesis
            </span>
          </h1>
          <p class='text-xl md:text-2xl text-gray-600 mb-8 leading-relaxed max-w-3xl'>
            Streamline quality and risk-of-bias appraisal with real-time collaboration, automatic
            scoring, and transparent workflows for systematic reviews.
          </p>
          <div class='flex flex-col sm:flex-row gap-3 mb-2'>
            <a
              href={urls.checklist()}
              class='inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold text-base hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20'
            >
              Start an Appraisal
            </a>
            <a
              href={urls.signUp()}
              class='inline-flex items-center justify-center gap-2 bg-white text-gray-700 px-6 py-3 rounded-lg font-semibold text-base hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm'
            >
              Start a Review Project
            </a>
          </div>
        </div>
      </div>
      {/* Product Screenshot Placeholder: full width, bottom, angled */}
      <div
        class='w-full flex justify-center absolute'
        style={{ bottom: 'auto', top: '44%', left: '80px' }}
      >
        <div class='relative w-full max-w-6xl px-4'>
          <div
            class='bg-linear-to-br from-gray-100 to-gray-50 rounded-2xl border border-gray-200 shadow-2xl overflow-hidden mb-0 mt-0'
            style={{
              transform: 'perspective(1200px) rotateX(14deg) rotateZ(-10deg) rotateY(8deg)',
            }}
          >
            <div class='aspect-16/7 flex items-center justify-center p-2'>
              <div class='text-center'>
                <div
                  class='bg-gray-50 border border-gray-200 rounded-xl shadow-lg w-full h-full flex flex-col'
                  style={{ 'box-shadow': '0 6px 32px 0 rgba(0,0,0,0.10)' }}
                >
                  {/* Browser top bar */}
                  <div class='flex items-center px-4 py-2 border-b border-gray-200 bg-gray-100 rounded-t-xl'>
                    <div class='flex items-center gap-2'>
                      <span class='w-3 h-3 rounded-full bg-red-400 inline-block' />
                      <span class='w-3 h-3 rounded-full bg-yellow-400 inline-block' />
                      <span class='w-3 h-3 rounded-full bg-green-400 inline-block' />
                    </div>
                    <div class='flex-1 mx-4'>
                      <div class='bg-white border border-gray-300 rounded-md px-3 py-1 text-xs text-gray-500 truncate max-w-[320px] mx-auto'>
                        app.corates
                      </div>
                    </div>
                  </div>
                  <div class='flex-1 flex items-center justify-center bg-white rounded-b-xl overflow-hidden'>
                    <img
                      src='/product.png'
                      alt='CoRATES product screenshot'
                      class='w-full h-full object-cover'
                      style={{ display: 'block' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Background decoration */}
      <div class='absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-linear-to-b from-blue-50/60 to-transparent rounded-full blur-3xl -z-10' />
      <div class='absolute top-1/2 right-0 w-[500px] h-[500px] bg-linear-to-l from-blue-50/40 to-transparent rounded-full blur-3xl -z-10' />
    </section>
  );
}
