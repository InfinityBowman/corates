import { A } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { HiOutlineClipboardDocumentCheck } from 'solid-icons/hi';
import { AiOutlineUsergroupAdd, AiOutlineCloudSync, AiOutlineArrowRight } from 'solid-icons/ai';
import { BsClipboardCheck } from 'solid-icons/bs';

function FeatureCard(props) {
  return (
    <div class='bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow'>
      <div class='w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4'>
        {props.icon}
      </div>
      <h3 class='text-lg font-semibold text-gray-900 mb-2'>{props.title}</h3>
      <p class='text-gray-600 text-sm leading-relaxed'>{props.description}</p>
    </div>
  );
}

export default function HomePage() {
  const { isLoggedIn, authLoading } = useBetterAuth();

  return (
    <div class='min-h-screen bg-linear-to-b from-gray-50 to-white'>
      {/* Hero Section */}
      <section class='relative overflow-hidden'>
        <div class='max-w-6xl mx-auto px-6 py-16 md:py-24'>
          <div class='text-center max-w-3xl mx-auto'>
            <div class='inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6'>
              <BsClipboardCheck class='w-4 h-4' />
              <span>Evidence Synthesis Quality Assessment</span>
            </div>

            <h1 class='text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight'>
              Collaborative Research Appraisal Tool for
              <span class='text-blue-600'> Evidence Synthesis</span>
            </h1>

            <p class='text-lg text-gray-600 mb-8 leading-relaxed'>
              CoRATES streamlines AMSTAR-2 assessments with real-time collaboration, offline
              support, and seamless PDF annotation. Work together with your team to evaluate
              systematic review quality.
            </p>

            <div class='flex flex-col sm:flex-row gap-4 justify-center'>
              {authLoading() ?
                <div class='h-12 w-40 bg-gray-100 animate-pulse rounded-lg' />
              : isLoggedIn() ?
                <A
                  href='/dashboard'
                  class='inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm'
                >
                  Go to Dashboard
                  <AiOutlineArrowRight class='w-5 h-5' />
                </A>
              : <>
                  <A
                    href='/signup'
                    class='inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm'
                  >
                    Get Started Free
                    <AiOutlineArrowRight class='w-5 h-5' />
                  </A>
                  <A
                    href='/signin'
                    class='inline-flex items-center justify-center gap-2 bg-white text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors border border-gray-200'
                  >
                    Sign In
                  </A>
                </>
              }
            </div>

            {/* Quick access to try without account */}
            <p class='mt-6 text-sm text-gray-500'>
              Want to try it first?{' '}
              <A href='/checklist' class='text-blue-600 hover:text-blue-700 font-medium'>
                Start a local checklist
              </A>
            </p>
          </div>
        </div>

        {/* Background decoration */}
        <div class='absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-linear-to-b from-blue-50/50 to-transparent rounded-full blur-3xl -z-10' />
      </section>

      {/* Features Section */}
      <section class='max-w-6xl mx-auto px-6 py-16'>
        <div class='text-center mb-12'>
          <h2 class='text-2xl md:text-3xl font-bold text-gray-900 mb-4'>
            Everything you need for quality assessments
          </h2>
          <p class='text-gray-600 max-w-2xl mx-auto'>
            Built specifically for researchers conducting systematic reviews with the AMSTAR-2 tool.
          </p>
        </div>

        <div class='grid md:grid-cols-3 gap-6'>
          <FeatureCard
            icon={<HiOutlineClipboardDocumentCheck class='w-6 h-6 text-blue-600' />}
            title='AMSTAR-2 Checklists'
            description='Complete implementation of the AMSTAR-2 assessment tool with all 16 items and detailed signaling questions.'
          />
          <FeatureCard
            icon={<AiOutlineUsergroupAdd class='w-6 h-6 text-blue-600' />}
            title='Real-time Collaboration'
            description='Work simultaneously with team members. Changes sync instantly across all devices with conflict-free merging.'
          />
          <FeatureCard
            icon={<AiOutlineCloudSync class='w-6 h-6 text-blue-600' />}
            title='Offline Support'
            description="Keep working without internet. Your progress saves locally and syncs automatically when you're back online."
          />
        </div>
      </section>

      {/* How It Works Section */}
      <section class='bg-gray-50 border-y border-gray-100'>
        <div class='max-w-6xl mx-auto px-6 py-16'>
          <div class='text-center mb-12'>
            <h2 class='text-2xl md:text-3xl font-bold text-gray-900 mb-4'>
              Simple workflow, powerful results
            </h2>
          </div>

          <div class='grid md:grid-cols-3 gap-8'>
            <div class='text-center'>
              <div class='w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4'>
                1
              </div>
              <h3 class='font-semibold text-gray-900 mb-2'>Create a Project</h3>
              <p class='text-gray-600 text-sm'>
                Set up a project for your systematic review and invite team members to collaborate.
              </p>
            </div>
            <div class='text-center'>
              <div class='w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4'>
                2
              </div>
              <h3 class='font-semibold text-gray-900 mb-2'>Add Reviews</h3>
              <p class='text-gray-600 text-sm'>
                Upload PDFs and create checklists for each study you need to assess.
              </p>
            </div>
            <div class='text-center'>
              <div class='w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4'>
                3
              </div>
              <h3 class='font-semibold text-gray-900 mb-2'>Assess Together</h3>
              <p class='text-gray-600 text-sm'>
                Complete AMSTAR-2 assessments collaboratively with real-time updates and PDF
                annotation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section class='max-w-6xl mx-auto px-6 py-16'>
        <div class='bg-blue-600 rounded-2xl p-8 md:p-12 text-center'>
          <h2 class='text-2xl md:text-3xl font-bold text-white mb-4'>
            Ready to streamline your systematic reviews?
          </h2>
          <p class='text-blue-100 mb-8 max-w-2xl mx-auto'>
            Join researchers who are using CoRATES to collaborate more efficiently on quality
            assessments.
          </p>
          {authLoading() ?
            <div class='h-12 w-40 bg-blue-500 animate-pulse rounded-lg mx-auto' />
          : isLoggedIn() ?
            <A
              href='/dashboard'
              class='inline-flex items-center justify-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors'
            >
              Go to Dashboard
              <AiOutlineArrowRight class='w-5 h-5' />
            </A>
          : <A
              href='/signup'
              class='inline-flex items-center justify-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors'
            >
              Get Started Free
              <AiOutlineArrowRight class='w-5 h-5' />
            </A>
          }
        </div>
      </section>

      {/* Footer */}
      <footer class='border-t border-gray-100 py-8'>
        <div class='max-w-6xl mx-auto px-6 text-center text-gray-500 text-sm'>
          <p>CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis</p>
        </div>
      </footer>
    </div>
  );
}
