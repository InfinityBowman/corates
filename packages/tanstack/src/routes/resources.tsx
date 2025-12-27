import { createFileRoute } from '@tanstack/solid-router'
import { HiOutlineDocumentText } from 'solid-icons/hi'
import { AiOutlineCheckCircle } from 'solid-icons/ai'
import { FiExternalLink, FiAlertCircle, FiAlertTriangle } from 'solid-icons/fi'
import Navbar from '@components/landing/Navbar'
import Footer from '@components/landing/Footer'
import { config } from '@lib/landing/config'

export const Route = createFileRoute('/resources')({
  prerender: true,
  head: () => {
    const pageUrl = `${config.appUrl}/resources`
    const title = 'Resources - CoRATES'
    const description =
      'Learn about AMSTAR 2 and other appraisal tools supported by CoRATES, including scoring guidance and links to official documentation.'
    return {
      title,
      meta: [
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: pageUrl },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
      ],
      links: [{ rel: 'canonical', href: pageUrl }],
    }
  },
  component: Resources,
})

function Resources() {
  return (
    <div class='flex min-h-screen flex-col'>
      <Navbar />

      <main class='flex-1 py-16'>
        <div class='mx-auto max-w-3xl px-6'>
          <h1 class='mb-2 text-4xl font-bold text-gray-900'>Resources</h1>
          <p class='mb-8 text-gray-500'>Appraisal tools and guidance</p>

          <div class='space-y-8 leading-relaxed text-gray-700'>
            {/* AMSTAR 2 Section */}
            <div>
              <h2 class='mb-4 text-2xl font-semibold text-gray-900'>AMSTAR 2</h2>
              <p class='mb-6 text-gray-600'>
                The AMSTAR 2 (A MeaSurement Tool to Assess systematic Reviews) is a critical
                appraisal tool used to assess the methodological quality and risk of bias of
                systematic reviews of interventions, including reviews that incorporate randomized
                and non-randomized studies. It evaluates 16 domains and supports judgments about
                confidence in a review's findings (high to critically low), helping users
                determine how much trust to place in review results.
              </p>
            </div>

            {/* Best Used For */}
            <div class='rounded-lg bg-gray-50 p-6'>
              <div class='flex items-start gap-4'>
                <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
                  <HiOutlineDocumentText class='h-5 w-5 text-blue-600' />
                </div>
                <div>
                  <h2 class='mb-2 text-lg font-semibold text-gray-900'>Best used for</h2>
                  <p class='text-gray-600'>Appraising systematic reviews of interventions.</p>
                </div>
              </div>
            </div>

            {/* Links Section */}
            <div class='rounded-lg bg-gray-50 p-6'>
              <div class='flex items-start gap-4'>
                <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
                  <FiExternalLink class='h-5 w-5 text-blue-600' />
                </div>
                <div class='flex-1'>
                  <h2 class='mb-4 text-lg font-semibold text-gray-900'>Reference Documents</h2>
                  <ul class='space-y-3 text-gray-600'>
                    <li>
                      <a
                        href='https://www.bmj.com/content/358/bmj.j4008'
                        target='_blank'
                        rel='external noopener noreferrer'
                        class='inline-flex items-center gap-2 font-medium text-blue-600 hover:text-blue-700'
                      >
                        AMSTAR 2 paper
                        <FiExternalLink class='h-4 w-4' />
                      </a>
                    </li>
                    <li>
                      <a
                        href='https://www.bmj.com/highwire/filestream/951408/field_highwire_adjunct_files/1/sheb036104.ww1.pdf'
                        target='_blank'
                        rel='external noopener noreferrer'
                        class='inline-flex items-center gap-2 font-medium text-blue-600 hover:text-blue-700'
                      >
                        AMSTAR 2 Guidance document
                        <FiExternalLink class='h-4 w-4' />
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Scoring Section */}
            <div class='border-t border-gray-200 pt-8'>
              <h2 class='mb-4 text-xl font-semibold text-gray-900'>Scoring</h2>
              <p class='mb-6 text-gray-600'>
                CoRATES automatically generates the overall score using decision rules that follow
                the scoring guidance published in the AMSTAR 2 paper, ensuring consistency with
                the tool's intended interpretation.
              </p>

              {/* Confidence Levels Box */}
              <div class='grid gap-4'>
                {/* High */}
                <div class='rounded-lg border border-green-200 bg-green-50 p-6'>
                  <div class='flex items-start gap-4'>
                    <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100'>
                      <AiOutlineCheckCircle class='h-5 w-5 text-green-600' />
                    </div>
                    <div>
                      <h3 class='mb-2 text-lg font-semibold text-gray-900'>High</h3>
                      <p class='text-gray-600'>
                        No or one non-critical weakness: the systematic review provides an
                        accurate and comprehensive summary of the results of the available studies
                        that address the question of interest.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Moderate */}
                <div class='rounded-lg border border-yellow-200 bg-yellow-50 p-6'>
                  <div class='flex items-start gap-4'>
                    <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-100'>
                      <FiAlertCircle class='h-5 w-5 text-yellow-600' />
                    </div>
                    <div>
                      <h3 class='mb-2 text-lg font-semibold text-gray-900'>Moderate</h3>
                      <p class='mb-2 text-gray-600'>
                        More than one non-critical weakness*: the systematic review has more than
                        one weakness but no critical flaws. It may provide an accurate summary of
                        the results of the available studies that were included in the review.
                      </p>
                      <p class='text-sm text-gray-500 italic'>
                        *Multiple non-critical weaknesses may diminish confidence in the review
                        and it may be appropriate to move the overall appraisal down from moderate
                        to low confidence.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Low */}
                <div class='rounded-lg border border-orange-200 bg-orange-50 p-6'>
                  <div class='flex items-start gap-4'>
                    <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100'>
                      <FiAlertTriangle class='h-5 w-5 text-orange-600' />
                    </div>
                    <div>
                      <h3 class='mb-2 text-lg font-semibold text-gray-900'>Low</h3>
                      <p class='text-gray-600'>
                        One critical flaw with or without non-critical weaknesses: the review has
                        a critical flaw and may not provide an accurate and comprehensive summary
                        of the available studies that address the question of interest.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Critically Low */}
                <div class='rounded-lg border border-red-200 bg-red-50 p-6'>
                  <div class='flex items-start gap-4'>
                    <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100'>
                      <FiAlertCircle class='h-5 w-5 text-red-600' />
                    </div>
                    <div>
                      <h3 class='mb-2 text-lg font-semibold text-gray-900'>Critically Low</h3>
                      <p class='text-gray-600'>
                        More than one critical flaw with or without non-critical weaknesses: the
                        review has more than one critical flaw and should not be relied on to
                        provide an accurate and comprehensive summary of the available studies.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
