import { urls } from '../lib/config'

export default function Hero() {
  return (
    <section className="relative max-h-screen min-h-screen overflow-hidden">
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 pt-8 pb-0 sm:px-6 md:pt-14">
        <div className="mb-2 w-full max-w-4xl">
          <div className="mb-6 flex items-center justify-center gap-4">
            <h1 className="m-0 text-center text-3xl leading-tight font-extrabold tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
              <span className="text-blue-700">Co</span>llaborative{' '}
              <span className="text-blue-700">R</span>
              esearch <span className="text-blue-700">A</span>ppraisal
              <span className="text-blue-700"> T</span>ool for
              <span className="text-blue-700"> E</span>
              vidence <span className="text-blue-700">S</span>ynthesis
            </h1>
          </div>
          <p className="mx-auto mb-8 max-w-3xl text-center text-lg leading-tight text-gray-600 sm:text-xl">
            Streamline the quality and risk-of-bias appraisal process with
            intuitive workflows, real-time collaboration, and automation that
            improve transparency and efficiency at every stage.
          </p>
          <div className="mb-2 flex flex-col justify-center gap-4 sm:flex-row sm:gap-12">
            <a
              href={urls.checklist()}
              rel="external"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-base font-semibold text-white shadow-md shadow-blue-600/20 transition-colors hover:bg-blue-500 sm:w-auto"
            >
              Start an Appraisal
            </a>
            <a
              href={urls.signUp()}
              rel="external"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-base font-semibold text-white shadow-md shadow-blue-600/20 transition-colors hover:bg-blue-500 sm:w-auto"
            >
              Start a Review Project
            </a>
          </div>
        </div>
      </div>
      {/* Product Screenshot: full width, bottom, angled */}
      <div className="flex w-full justify-center px-4 sm:px-6 md:translate-x-10">
        <div className="relative w-full max-w-5xl opacity-80">
          <div className="mt-0 mb-0 transform-[perspective(900px)_rotateX(10deg)_rotateZ(-6deg)_rotateY(6deg)] overflow-hidden rounded-2xl border border-gray-200 bg-linear-to-br from-gray-100 to-gray-50 shadow-2xl md:transform-[perspective(1200px)_rotateX(14deg)_rotateZ(-10deg)_rotateY(8deg)]">
            <div className="flex aspect-16/7 items-center justify-center p-1 sm:p-2">
              <div className="text-center">
                <div
                  className="flex h-full w-full flex-col rounded-xl border border-gray-200 bg-gray-50 shadow-lg"
                  style={{ boxShadow: '0 6px 32px 0 rgba(0,0,0,0.10)' }}
                >
                  {/* Browser top bar */}
                  <div className="flex items-center rounded-t-xl border-b border-gray-200 bg-gray-100 px-2 py-1 sm:px-4 sm:py-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400 sm:h-3 sm:w-3" />
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400 sm:h-3 sm:w-3" />
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400 sm:h-3 sm:w-3" />
                    </div>
                    <div className="mx-4 flex-1">
                      <div className="text-2xs mx-auto max-w-50 truncate rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-gray-500 sm:max-w-[320px] sm:px-3 sm:py-1 sm:text-xs">
                        corates.org/dashboard
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-1 items-center justify-center overflow-hidden rounded-b-xl bg-white">
                    <picture>
                      <source srcSet="/product.webp" type="image/webp" />
                      <img
                        src="/product.png"
                        alt="CoRATES product screenshot"
                        className="h-full w-full object-cover"
                        width="2524"
                        height="1770"
                        fetchPriority="high"
                        decoding="async"
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
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -z-10 h-250 w-250 -translate-x-1/2 rounded-full bg-linear-to-b from-blue-700/5 to-transparent blur-3xl" />
      <div className="absolute top-1/2 right-0 -z-10 h-125 w-125 rounded-full bg-linear-to-l from-blue-700/5 to-transparent blur-3xl" />
    </section>
  )
}
