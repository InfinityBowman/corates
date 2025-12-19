import { A } from '@solidjs/router';
import { useBetterAuth } from '@/api/betterAuthStore.js';
import { HiOutlineClipboardDocumentCheck } from 'solid-icons/hi';
import { AiOutlineUsergroupAdd, AiOutlineCloudSync, AiOutlineArrowRight } from 'solid-icons/ai';
import { BsClipboardCheck } from 'solid-icons/bs';

function FeatureCard(props) {
  return (
    <div class='rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md'>
      <div class='mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50'>
        {props.icon}
      </div>
      <h3 class='mb-2 text-lg font-semibold text-gray-900'>{props.title}</h3>
      <p class='text-sm leading-relaxed text-gray-600'>{props.description}</p>
    </div>
  );
}

export default function HomePage() {
  const { isLoggedIn, authLoading } = useBetterAuth();

  return (
    <div class='min-h-screen bg-linear-to-b from-gray-50 to-white'>
      {/* Hero Section */}
      <section class='relative overflow-hidden'>
        <div class='mx-auto max-w-6xl px-6 py-16 md:py-24'>
          <div class='mx-auto max-w-3xl text-center'>
            <div class='mb-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700'>
              <BsClipboardCheck class='h-4 w-4' />
              <span>Evidence Synthesis Quality Assessment</span>
            </div>

            <h1 class='mb-6 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl'>
              Collaborative Research Appraisal Tool for
              <span class='text-blue-600'> Evidence Synthesis</span>
            </h1>

            <p class='mb-8 text-lg leading-relaxed text-gray-600'>
              CoRATES streamlines AMSTAR-2 assessments with real-time collaboration, offline
              support, and seamless PDF annotation. Work together with your team to evaluate
              systematic review quality.
            </p>

            <div class='flex flex-col justify-center gap-4 sm:flex-row'>
              {authLoading() ?
                <div class='h-12 w-40 animate-pulse rounded-lg bg-gray-100' />
              : isLoggedIn() ?
                <A
                  href='/dashboard'
                  class='inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-blue-700'
                >
                  Go to Dashboard
                  <AiOutlineArrowRight class='h-5 w-5' />
                </A>
              : <>
                  <A
                    href='/signup'
                    class='inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-blue-700'
                  >
                    Get Started
                    <AiOutlineArrowRight class='h-5 w-5' />
                  </A>
                  <A
                    href='/signin'
                    class='inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50'
                  >
                    Sign In
                  </A>
                </>
              }
            </div>

            {/* Quick access to try without account */}
            <p class='mt-6 text-sm text-gray-500'>
              Want to try it first?{' '}
              <A href='/checklist' class='font-medium text-blue-600 hover:text-blue-700'>
                Start a local checklist
              </A>
            </p>
          </div>
        </div>

        {/* Background decoration */}
        <div class='absolute top-0 left-1/2 -z-10 h-200 w-200 -translate-x-1/2 rounded-full bg-linear-to-b from-blue-50/50 to-transparent blur-3xl' />
      </section>

      {/* Features Section */}
      <section class='mx-auto max-w-6xl px-6 py-16'>
        <div class='mb-12 text-center'>
          <h2 class='mb-4 text-2xl font-bold text-gray-900 md:text-3xl'>
            Everything you need to support rigorous study appraisal
          </h2>
          <p class='mx-auto max-w-2xl text-gray-600'>
            Built specifically for researchers who need to appraise study quality and risk of bias
            in evidence reviews
          </p>
        </div>

        <div class='grid gap-6 md:grid-cols-3'>
          <FeatureCard
            icon={<HiOutlineClipboardDocumentCheck class='h-6 w-6 text-blue-600' />}
            title='AMSTAR-2 Checklists'
            description='Complete implementation of the AMSTAR-2 assessment tool with all 16 items and detailed signaling questions.'
          />
          <FeatureCard
            icon={<AiOutlineUsergroupAdd class='h-6 w-6 text-blue-600' />}
            title='Real-time Collaboration'
            description='Work simultaneously with team members. Changes sync instantly across all devices with conflict-free merging.'
          />
          <FeatureCard
            icon={<AiOutlineCloudSync class='h-6 w-6 text-blue-600' />}
            title='Offline Support'
            description="Keep working without internet. Your progress saves locally and syncs automatically when you're back online."
          />
        </div>
      </section>

      {/* How It Works Section */}
      <section class='border-y border-gray-100 bg-gray-50'>
        <div class='mx-auto max-w-6xl px-6 py-16'>
          <div class='mb-12 text-center'>
            <h2 class='mb-4 text-2xl font-bold text-gray-900 md:text-3xl'>
              Simple workflow, powerful results
            </h2>
          </div>

          <div class='grid gap-8 md:grid-cols-3'>
            <div class='text-center'>
              <div class='mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white'>
                1
              </div>
              <h3 class='mb-2 font-semibold text-gray-900'>Create a Project</h3>
              <p class='text-sm text-gray-600'>
                Set up a project for your systematic review and invite team members to collaborate.
              </p>
            </div>
            <div class='text-center'>
              <div class='mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white'>
                2
              </div>
              <h3 class='mb-2 font-semibold text-gray-900'>Add Studies</h3>
              <p class='text-sm text-gray-600'>
                Upload PDFs and create checklists for each study you need to assess.
              </p>
            </div>
            <div class='text-center'>
              <div class='mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white'>
                3
              </div>
              <h3 class='mb-2 font-semibold text-gray-900'>Assess Together</h3>
              <p class='text-sm text-gray-600'>
                Complete AMSTAR-2 assessments collaboratively with real-time updates and PDF
                annotation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section class='mx-auto max-w-6xl px-6 py-16'>
        <div class='rounded-2xl bg-blue-600 p-8 text-center md:p-12'>
          <h2 class='mb-4 text-2xl font-bold text-white md:text-3xl'>
            Ready to streamline your systematic reviews?
          </h2>
          <p class='mx-auto mb-8 max-w-2xl text-blue-100'>
            Join researchers who are using CoRATES to collaborate more efficiently on quality
            assessments.
          </p>
          {authLoading() ?
            <div class='mx-auto h-12 w-40 animate-pulse rounded-lg bg-blue-500' />
          : isLoggedIn() ?
            <A
              href='/dashboard'
              class='inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-blue-600 transition-colors hover:bg-blue-50'
            >
              Go to Dashboard
              <AiOutlineArrowRight class='h-5 w-5' />
            </A>
          : <A
              href='/signup'
              class='inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-blue-600 transition-colors hover:bg-blue-50'
            >
              Get Started
              <AiOutlineArrowRight class='h-5 w-5' />
            </A>
          }
        </div>
      </section>

      {/* Footer */}
      <footer class='border-t border-gray-100 py-8'>
        <div class='mx-auto max-w-6xl px-6'>
          <div class='flex flex-col items-center justify-between gap-4 sm:flex-row'>
            <p class='text-sm text-gray-500'>
              CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis
            </p>
            <div class='flex gap-6 text-sm'>
              <a
                href='https://corates.org/privacy'
                target='_blank'
                rel='noopener noreferrer'
                class='text-gray-500 transition-colors hover:text-gray-700'
              >
                Privacy
              </a>
              <a
                href='https://corates.org/terms'
                target='_blank'
                rel='noopener noreferrer'
                class='text-gray-500 transition-colors hover:text-gray-700'
              >
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
