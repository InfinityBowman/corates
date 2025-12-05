import { Title, Meta } from '@solidjs/meta';
import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';

export default function PrivacyPolicy() {
  return (
    <>
      <Title>Privacy Policy - CoRATES</Title>
      <Meta
        name='description'
        content='Privacy Policy for CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis'
      />

      <div class='min-h-screen flex flex-col'>
        <Navbar />

        <main class='flex-1 py-12'>
          <div class='max-w-3xl mx-auto px-6'>
            <h1 class='text-3xl font-bold text-gray-900 mb-8'>Privacy Policy</h1>

            <div class='prose prose-gray max-w-none'>
              <p class='text-gray-600 mb-6'>Last updated: December 4, 2025</p>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>1. Introduction</h2>
                <p class='text-gray-700 mb-4'>
                  CoRATES ("we," "our," or "us") is committed to protecting your privacy. This
                  Privacy Policy explains how we collect, use, disclose, and safeguard your
                  information when you use our web application for collaborative research appraisal
                  and evidence synthesis.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>2. Information We Collect</h2>

                <h3 class='text-lg font-medium text-gray-900 mb-2'>Account Information</h3>
                <p class='text-gray-700 mb-4'>
                  When you create an account, we collect your email address, name, and password
                  (stored securely using industry-standard hashing).
                </p>

                <h3 class='text-lg font-medium text-gray-900 mb-2'>Project Data</h3>
                <p class='text-gray-700 mb-4'>
                  We store the research projects, studies, checklists, and assessments you create
                  within the application. This data is associated with your account and any
                  collaborators you invite.
                </p>

                <h3 class='text-lg font-medium text-gray-900 mb-2'>Uploaded Files</h3>
                <p class='text-gray-700 mb-4'>
                  If you upload PDF documents or import files from Google Drive, we store these
                  files securely to enable your research workflows.
                </p>

                <h3 class='text-lg font-medium text-gray-900 mb-2'>Third-Party Connections</h3>
                <p class='text-gray-700 mb-4'>
                  If you connect your Google account, we receive access tokens that allow us to
                  access your Google Drive files on your behalf. We only request read-only access
                  and only access files you explicitly select.
                </p>

                <h3 class='text-lg font-medium text-gray-900 mb-2'>Usage Information</h3>
                <p class='text-gray-700 mb-4'>
                  We may collect information about how you use the application, including log data,
                  device information, and analytics to improve our services.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>
                  3. How We Use Your Information
                </h2>
                <ul class='list-disc list-inside text-gray-700 space-y-2'>
                  <li>To provide and maintain our service</li>
                  <li>To authenticate your identity and manage your account</li>
                  <li>To enable collaboration with other users you invite</li>
                  <li>To send you important notifications about your account or projects</li>
                  <li>To respond to your inquiries and provide support</li>
                  <li>To improve and optimize our application</li>
                  <li>To comply with legal obligations</li>
                </ul>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>4. Data Sharing</h2>
                <p class='text-gray-700 mb-4'>
                  We do not sell your personal information. We may share your information only in
                  the following circumstances:
                </p>
                <ul class='list-disc list-inside text-gray-700 space-y-2'>
                  <li>
                    <strong>With collaborators:</strong> Project data is shared with users you
                    explicitly invite to collaborate
                  </li>
                  <li>
                    <strong>Service providers:</strong> We use third-party services (e.g., cloud
                    hosting, email delivery) that process data on our behalf
                  </li>
                  <li>
                    <strong>Legal requirements:</strong> When required by law or to protect our
                    rights
                  </li>
                </ul>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>5. Data Security</h2>
                <p class='text-gray-700 mb-4'>
                  We implement appropriate technical and organizational measures to protect your
                  data, including:
                </p>
                <ul class='list-disc list-inside text-gray-700 space-y-2'>
                  <li>Encryption of data in transit (HTTPS/TLS)</li>
                  <li>Secure password hashing</li>
                  <li>Access controls and authentication</li>
                  <li>Regular security assessments</li>
                </ul>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>6. Data Retention</h2>
                <p class='text-gray-700 mb-4'>
                  We retain your data for as long as your account is active or as needed to provide
                  services. You may request deletion of your account and associated data at any
                  time.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>7. Your Rights</h2>
                <p class='text-gray-700 mb-4'>
                  Depending on your location, you may have the right to:
                </p>
                <ul class='list-disc list-inside text-gray-700 space-y-2'>
                  <li>Access your personal data</li>
                  <li>Correct inaccurate data</li>
                  <li>Request deletion of your data</li>
                  <li>Export your data</li>
                  <li>Withdraw consent for optional processing</li>
                </ul>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>8. Third-Party Services</h2>
                <p class='text-gray-700 mb-4'>Our application integrates with:</p>
                <ul class='list-disc list-inside text-gray-700 space-y-2'>
                  <li>
                    <strong>Google OAuth/Drive:</strong> For account authentication and file import
                    (subject to Google's Privacy Policy)
                  </li>
                  <li>
                    <strong>Cloudflare:</strong> For hosting and security services
                  </li>
                </ul>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>9. Changes to This Policy</h2>
                <p class='text-gray-700 mb-4'>
                  We may update this Privacy Policy from time to time. We will notify you of any
                  significant changes by posting the new policy on this page and updating the "Last
                  updated" date.
                </p>
              </section>

              <section class='mb-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-4'>10. Contact Us</h2>
                <p class='text-gray-700 mb-4'>
                  If you have questions about this Privacy Policy or our data practices, please
                  contact us at:
                </p>
                <p class='text-gray-700'>
                  <a href='mailto:privacy@corates.org' class='text-blue-600 hover:text-blue-700'>
                    privacy@corates.org
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
