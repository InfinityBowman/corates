import { Title, Meta } from '@solidjs/meta';
import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';

export default function TermsOfService() {
  return (
    <>
      <Title>Terms of Service - CoRATES</Title>
      <Meta
        name='description'
        content='Terms of Service for CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis'
      />

      <div class='min-h-screen flex flex-col'>
        <Navbar />

        <main class='flex-1 py-12'>
          <div class='max-w-3xl mx-auto px-6'>
            <h1 class='text-3xl font-bold text-gray-900 mb-8'>Terms of Service</h1>

            <div class='prose prose-gray max-w-none'>
              <p class='text-gray-600 mb-6'>Last updated: December 4, 2025</p>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>1. Acceptance of Terms</h2>
                <p class='text-gray-700 mb-4'>
                  By accessing or using CoRATES ("the Service"), you agree to be bound by these
                  Terms of Service. If you do not agree to these terms, please do not use the
                  Service.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>2. Description of Service</h2>
                <p class='text-gray-700 mb-4'>
                  CoRATES is a collaborative research appraisal tool designed for evidence
                  synthesis. The Service allows users to create projects, manage studies, complete
                  quality assessment checklists (such as AMSTAR 2), collaborate with team members,
                  and organize research materials.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>3. User Accounts</h2>
                <p class='text-gray-700 mb-4'>To use the Service, you must:</p>
                <ul class='list-disc list-inside text-gray-700 space-y-2 mb-4'>
                  <li>Create an account with accurate and complete information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Promptly notify us of any unauthorized access</li>
                  <li>Be at least 18 years old or have parental consent</li>
                </ul>
                <p class='text-gray-700'>
                  You are responsible for all activities that occur under your account.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>4. Acceptable Use</h2>
                <p class='text-gray-700 mb-4'>You agree not to:</p>
                <ul class='list-disc list-inside text-gray-700 space-y-2'>
                  <li>Use the Service for any unlawful purpose</li>
                  <li>Upload malicious content, viruses, or harmful code</li>
                  <li>Attempt to gain unauthorized access to any part of the Service</li>
                  <li>Interfere with or disrupt the Service or servers</li>
                  <li>Impersonate any person or entity</li>
                  <li>Use automated systems to access the Service without permission</li>
                  <li>Violate the intellectual property rights of others</li>
                </ul>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>5. User Content</h2>
                <p class='text-gray-700 mb-4'>
                  You retain ownership of the content you create and upload to the Service,
                  including projects, studies, assessments, and documents. By using the Service, you
                  grant us a limited license to store, process, and display your content as
                  necessary to provide the Service.
                </p>
                <p class='text-gray-700 mb-4'>You are responsible for ensuring that:</p>
                <ul class='list-disc list-inside text-gray-700 space-y-2'>
                  <li>You have the right to upload any content you submit</li>
                  <li>Your content does not violate any laws or third-party rights</li>
                  <li>Shared content is appropriate for your collaborators</li>
                </ul>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>6. Collaboration</h2>
                <p class='text-gray-700 mb-4'>
                  The Service allows you to invite collaborators to your projects. When you invite
                  someone:
                </p>
                <ul class='list-disc list-inside text-gray-700 space-y-2'>
                  <li>They will have access to the project and its contents</li>
                  <li>You are responsible for managing access permissions</li>
                  <li>Collaborators must also agree to these Terms of Service</li>
                </ul>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>
                  7. Third-Party Integrations
                </h2>
                <p class='text-gray-700 mb-4'>
                  The Service may integrate with third-party services such as Google Drive. Your use
                  of these integrations is subject to the respective third party's terms of service
                  and privacy policies.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>8. Intellectual Property</h2>
                <p class='text-gray-700 mb-4'>
                  The Service, including its design, features, and code, is owned by CoRATES and
                  protected by intellectual property laws. You may not copy, modify, distribute, or
                  create derivative works without our permission.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>
                  9. Disclaimer of Warranties
                </h2>
                <p class='text-gray-700 mb-4'>
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
                  EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED,
                  ERROR-FREE, OR SECURE.
                </p>
                <p class='text-gray-700'>
                  The Service is a tool to assist with research quality assessment. It does not
                  replace professional judgment, and users are responsible for verifying the
                  accuracy of their assessments.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>
                  10. Limitation of Liability
                </h2>
                <p class='text-gray-700 mb-4'>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, CORATES SHALL NOT BE LIABLE FOR ANY
                  INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM
                  YOUR USE OF THE SERVICE.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>11. Termination</h2>
                <p class='text-gray-700 mb-4'>
                  We may suspend or terminate your access to the Service at any time for violation
                  of these terms or for any other reason. You may also delete your account at any
                  time.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>12. Changes to Terms</h2>
                <p class='text-gray-700 mb-4'>
                  We may modify these Terms of Service at any time. We will notify users of
                  significant changes. Continued use of the Service after changes constitutes
                  acceptance of the new terms.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>13. Governing Law</h2>
                <p class='text-gray-700 mb-4'>
                  These terms shall be governed by and construed in accordance with applicable laws,
                  without regard to conflict of law principles.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>14. Contact</h2>
                <p class='text-gray-700 mb-4'>
                  For questions about these Terms of Service, please contact us at:
                </p>
                <p class='text-gray-700'>
                  <a href='mailto:legal@corates.org' class='text-blue-600 hover:text-blue-700'>
                    legal@corates.org
                  </a>
                </p>
              </section>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
