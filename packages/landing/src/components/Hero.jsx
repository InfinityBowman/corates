import { urls } from '~/lib/config';

export default function Hero() {
  return (
    <section class='relative overflow-hidden min-h-screen max-h-screen'>
      <div class='max-w-7xl mx-auto px-4 sm:px-6 pt-8 md:pt-14 pb-0 flex flex-col items-center'>
        <div class='w-full max-w-4xl mb-2'>
          <div class='flex items-center justify-center gap-4 mb-6'>
            {/* <img
              src='/icon.png'
              alt='CoRATES logo'
              class='w-24 h-24 absolute left-60 rounded-md'
            /> */}
            <h1 class='text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight text-center m-0'>
              <span class='text-blue-700'>Co</span>llaborative{' '}
              <span class='text-blue-700'>R</span>
              esearch <span class='text-blue-700'>A</span>ppraisal
              <span class='text-blue-700'> T</span>ool for
              <span class='text-blue-700'> E</span>
              vidence <span class='text-blue-700'>S</span>ynthesis
            </h1>
          </div>
          <p class='text-lg sm:text-xl text-gray-600 mb-8 max-w-3xl leading-tight text-center mx-auto'>
            Streamline the entire quality and risk-of-bias appraisal process with
            intuitive workflows, real-time collaboration, and automation, creating greater
            transparency and efficiency at every step.
          </p>
          <div class='flex flex-col sm:flex-row gap-4 sm:gap-12 mb-2 justify-center'>
            <a
              href={urls.checklist()}
              rel='external'
              class='inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold text-base hover:bg-blue-500 transition-colors shadow-md shadow-blue-600/20 w-full sm:w-auto'
            >
              Start an Appraisal
            </a>
            <a
              href={urls.signUp()}
              rel='external'
              class='inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold text-base hover:bg-blue-500 transition-colors shadow-md shadow-blue-600/20 w-full sm:w-auto'
            >
              Start a Review Project
            </a>
          </div>
        </div>
      </div>
      {/* Product Screenshot Placeholder: full width, bottom, angled */}
      <div class='w-full flex justify-center px-4 sm:px-6 md:translate-x-10'>
        <div class='relative w-full max-w-5xl opacity-80'>
          <div class='bg-linear-to-br from-gray-100 to-gray-50 rounded-2xl border border-gray-200 shadow-2xl overflow-hidden mb-0 mt-0 transform-[perspective(900px)_rotateX(10deg)_rotateZ(-6deg)_rotateY(6deg)] md:transform-[perspective(1200px)_rotateX(14deg)_rotateZ(-10deg)_rotateY(8deg)]'>
            <div class='aspect-16/7 flex items-center justify-center p-1 sm:p-2'>
              <div class='text-center'>
                <div
                  class='bg-gray-50 border border-gray-200 rounded-xl shadow-lg w-full h-full flex flex-col'
                  style={{ 'box-shadow': '0 6px 32px 0 rgba(0,0,0,0.10)' }}
                >
                  {/* Browser top bar */}
                  <div class='flex items-center px-2 py-1 sm:px-4 sm:py-2 border-b border-gray-200 bg-gray-100 rounded-t-xl'>
                    <div class='flex items-center gap-2'>
                      <span class='w-3 h-3 rounded-full bg-red-400 inline-block' />
                      <span class='w-3 h-3 rounded-full bg-yellow-400 inline-block' />
                      <span class='w-3 h-3 rounded-full bg-green-400 inline-block' />
                    </div>
                    <div class='flex-1 mx-4'>
                      <div class='bg-white border border-gray-300 rounded-md px-3 py-1 text-xs text-gray-500 truncate max-w-[200px] sm:max-w-[320px] mx-auto'>
                        corates.org/dashboard
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
      <div class='absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-linear-to-b from-blue-700/5 to-transparent rounded-full blur-3xl -z-10' />
      <div class='absolute top-1/2 right-0 w-[500px] h-[500px] bg-linear-to-l from-blue-700/5 to-transparent rounded-full blur-3xl -z-10' />
    </section>
  );
}
