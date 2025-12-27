import { createFileRoute } from '@tanstack/solid-router'
import Navbar from '@components/landing/Navbar'
import Footer from '@components/landing/Footer'
import { config } from '@lib/landing/config'

export const Route = createFileRoute('/privacy')({
  prerender: true,
  head: () => {
    const pageUrl = `${config.appUrl}/privacy`
    const title = 'Privacy Policy - CoRATES'
    const description =
      'Privacy Policy for CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis'
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
  component: PrivacyPolicy,
})

function PrivacyPolicy() {
  return (
    <div class="flex min-h-screen flex-col">
      <Navbar />

      <main class="flex-1 py-16">
        <div class="mx-auto max-w-3xl px-6">
          <h1 class="mb-2 text-4xl font-bold text-gray-900">Privacy Policy</h1>
          <p class="mb-8 text-gray-500">Effective date: December 5, 2025</p>

          <div class="space-y-6 leading-relaxed text-gray-700">
            <p>
              At CoRATES ("CoRATES"), we take your privacy seriously. Please
              read this Privacy Policy to learn how we treat your personal data.
              By using or accessing our Services in any manner, you acknowledge
              that you accept the practices and policies outlined below, and you
              hereby consent that we will collect, use and share your
              information as described in this Privacy Policy.
            </p>

            <p>
              Remember that your use of CoRATES's Services is at all times
              subject to our{' '}
              <a href="/terms" class="text-blue-600 hover:text-blue-700">
                Terms of Service
              </a>
              . Any terms we use in this Policy without defining them have the
              definitions given to them in the Terms of Service.
            </p>

            <p>
              If you have a disability, you may access this Privacy Policy in an
              alternative format by contacting{' '}
              <a
                href="mailto:privacy@corates.org"
                class="text-blue-600 hover:text-blue-700"
              >
                privacy@corates.org
              </a>
              .
            </p>

            {/* Table of Contents */}
            <div class="my-8 rounded-lg bg-gray-50 p-6">
              <h2 class="mb-4 text-lg font-semibold text-gray-900">
                Privacy Policy Table of Contents
              </h2>
              <ul class="space-y-2 text-gray-700">
                <li>
                  <a href="#what-this-covers" class="hover:text-blue-600">
                    What this Privacy Policy Covers
                  </a>
                </li>
                <li>
                  <a href="#personal-data" class="hover:text-blue-600">
                    Personal Data
                  </a>
                  <ul class="mt-1 ml-4 space-y-1 text-sm text-gray-600">
                    <li>Categories of Personal Data We Collect</li>
                    <li>Categories of Sources of Personal Data</li>
                    <li>Our Purposes for Collecting Personal Data</li>
                  </ul>
                </li>
                <li>
                  <a href="#how-we-share" class="hover:text-blue-600">
                    How We Share Your Personal Data
                  </a>
                </li>
                <li>
                  <a href="#tracking-tools" class="hover:text-blue-600">
                    Tracking Tools and Opt-Out
                  </a>
                </li>
                <li>
                  <a href="#data-security" class="hover:text-blue-600">
                    Data Security and Retention
                  </a>
                </li>
                <li>
                  <a href="#children" class="hover:text-blue-600">
                    Personal Data of Children
                  </a>
                </li>
                <li>
                  <a href="#state-rights" class="hover:text-blue-600">
                    State Law Privacy Rights
                  </a>
                </li>
                <li>
                  <a href="#eu-rights" class="hover:text-blue-600">
                    European Union Data Subject Rights
                  </a>
                </li>
                <li>
                  <a href="#changes" class="hover:text-blue-600">
                    Changes to this Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#contact" class="hover:text-blue-600">
                    Contact Information
                  </a>
                </li>
              </ul>
            </div>

            {/* What this Privacy Policy Covers */}
            <h2
              id="what-this-covers"
              class="pt-6 text-xl font-semibold text-gray-900"
            >
              What this Privacy Policy Covers
            </h2>

            <p>
              This Privacy Policy covers how we treat Personal Data that we
              gather when you access or use our Services. "Personal Data" means
              any information that identifies or relates to a particular
              individual and also includes information referred to as
              "personally identifiable information" or "personal information"
              under applicable data privacy laws, rules or regulations. This
              Privacy Policy does not cover the practices of companies we don't
              own or control or people we don't manage.
            </p>

            {/* Personal Data */}
            <h2
              id="personal-data"
              class="pt-6 text-xl font-semibold text-gray-900"
            >
              Personal Data
            </h2>

            <h3 class="pt-4 text-lg font-medium text-gray-900">
              Categories of Personal Data We Collect
            </h3>

            <p>
              This list details the categories of Personal Data that we collect
              and have collected over the past 12 months:
            </p>

            <div class="space-y-6">
              <div class="border-l-2 border-gray-200 pl-4">
                <h4 class="font-medium text-gray-900">
                  Profile or Contact Data
                </h4>
                <p class="mt-1 text-sm text-gray-600">
                  <strong>Examples:</strong> First and last name, email, ORCID
                  identifier, unique identifiers such as passwords
                </p>
                <p class="text-sm text-gray-600">
                  <strong>Third Parties We Share With:</strong> Service
                  Providers, Parties You Authorize
                </p>
              </div>

              <div class="border-l-2 border-gray-200 pl-4">
                <h4 class="font-medium text-gray-900">Payment Data</h4>
                <p class="mt-1 text-sm text-gray-600">
                  <strong>Examples:</strong> Payment card type, last 4 digits of
                  payment card, billing address, phone number, and email
                </p>
                <p class="text-sm text-gray-600">
                  <strong>Third Parties We Share With:</strong> Service
                  Providers (specifically our payment processing partner)
                </p>
              </div>

              <div class="border-l-2 border-gray-200 pl-4">
                <h4 class="font-medium text-gray-900">Device/IP Data</h4>
                <p class="mt-1 text-sm text-gray-600">
                  <strong>Examples:</strong> IP address, device ID, type of
                  device/operating system/browser used to access the Services
                </p>
                <p class="text-sm text-gray-600">
                  <strong>Third Parties We Share With:</strong> Service
                  Providers, Parties You Authorize
                </p>
              </div>

              <div class="border-l-2 border-gray-200 pl-4">
                <h4 class="font-medium text-gray-900">Web Analytics</h4>
                <p class="mt-1 text-sm text-gray-600">
                  <strong>Examples:</strong> Web page interactions, referring
                  webpage/source, statistics associated with the interaction
                  between device or browser and the Services
                </p>
                <p class="text-sm text-gray-600">
                  <strong>Third Parties We Share With:</strong> Service
                  Providers, Parties You Authorize
                </p>
              </div>

              <div class="border-l-2 border-gray-200 pl-4">
                <h4 class="font-medium text-gray-900">Research Project Data</h4>
                <p class="mt-1 text-sm text-gray-600">
                  <strong>Examples:</strong> Projects, studies, checklists,
                  assessments, and documents you create within the Service
                </p>
                <p class="text-sm text-gray-600">
                  <strong>Third Parties We Share With:</strong> Collaborators
                  you invite, Service Providers
                </p>
              </div>

              <div class="border-l-2 border-gray-200 pl-4">
                <h4 class="font-medium text-gray-900">
                  Other Identifying Information that You Voluntarily Choose to
                  Provide
                </h4>
                <p class="mt-1 text-sm text-gray-600">
                  <strong>Examples:</strong> Identifying information in emails
                  or letters you send us, uploaded PDF documents
                </p>
                <p class="text-sm text-gray-600">
                  <strong>Third Parties We Share With:</strong> Service
                  Providers, Parties You Authorize
                </p>
              </div>
            </div>

            <h3 class="pt-6 text-lg font-medium text-gray-900">
              Categories of Sources of Personal Data
            </h3>

            <p>
              We collect Personal Data about you from the following categories
              of sources:
            </p>

            <ul class="ml-6 list-outside list-disc space-y-2">
              <li>
                <strong>You</strong>
                <ul class="mt-1 ml-6 list-outside list-disc text-gray-600">
                  <li>When you provide such information directly to us</li>
                  <li>
                    When you create an account or use our interactive tools and
                    Services
                  </li>
                  <li>
                    When you voluntarily provide information in free-form text
                    boxes through the Services
                  </li>
                  <li>When you send us an email or otherwise contact us</li>
                  <li>
                    When you use the Services and such information is collected
                    automatically
                  </li>
                  <li>Through Cookies</li>
                </ul>
              </li>
              <li>
                <strong>Third Parties</strong>
                <ul class="mt-1 ml-6 list-outside list-disc text-gray-600">
                  <li>
                    Vendors (we may use analytics providers to analyze how you
                    interact with the Services)
                  </li>
                  <li>
                    Authentication providers (ORCID, Google) when you choose to
                    connect your accounts
                  </li>
                </ul>
              </li>
            </ul>

            <h3 class="pt-6 text-lg font-medium text-gray-900">
              Our Purposes for Collecting Personal Data
            </h3>

            <ul class="ml-6 list-outside list-disc space-y-2">
              <li>
                <strong>
                  Providing, Customizing and Improving the Services
                </strong>
                <ul class="mt-1 ml-6 list-outside list-disc text-gray-600">
                  <li>
                    Creating and managing your account or other user profiles
                  </li>
                  <li>Processing orders or other transactions; billing</li>
                  <li>
                    Providing you with the products, services or information you
                    request
                  </li>
                  <li>Providing support and assistance for the Services</li>
                  <li>
                    Improving the Services, including testing, research,
                    internal analytics and product development
                  </li>
                  <li>Doing fraud protection, security and debugging</li>
                </ul>
              </li>
              <li>
                <strong>Marketing the Services</strong>
                <ul class="mt-1 ml-6 list-outside list-disc text-gray-600">
                  <li>Marketing and selling the Services</li>
                </ul>
              </li>
              <li>
                <strong>Corresponding with You</strong>
                <ul class="mt-1 ml-6 list-outside list-disc text-gray-600">
                  <li>
                    Responding to correspondence that we receive from you,
                    contacting you when necessary or requested
                  </li>
                  <li>
                    Sending emails and other communications according to your
                    preferences or that display content that we think will
                    interest you
                  </li>
                </ul>
              </li>
              <li>
                <strong>
                  Meeting Legal Requirements and Enforcing Legal Terms
                </strong>
                <ul class="mt-1 ml-6 list-outside list-disc text-gray-600">
                  <li>
                    Fulfilling our legal obligations under applicable law,
                    regulation, court order or other legal process
                  </li>
                  <li>
                    Protecting the rights, property or safety of you, CoRATES or
                    another party
                  </li>
                  <li>Enforcing any agreements with you</li>
                  <li>Resolving disputes</li>
                </ul>
              </li>
            </ul>

            <p>
              We will not collect additional categories of Personal Data or use
              the Personal Data we collected for materially different, unrelated
              or incompatible purposes without providing you notice.
            </p>

            {/* How We Share Your Personal Data */}
            <h2
              id="how-we-share"
              class="pt-6 text-xl font-semibold text-gray-900"
            >
              How We Share Your Personal Data
            </h2>

            <p>
              We disclose your Personal Data to the categories of service
              providers and other parties listed in this section.
            </p>

            <ul class="ml-6 list-outside list-disc space-y-3">
              <li>
                <strong>Service Providers.</strong> These parties help us
                provide the Services or perform business functions on our
                behalf. They include:
                <ul class="mt-1 ml-6 list-outside list-disc text-gray-600">
                  <li>
                    Hosting, technology and communication providers (Cloudflare)
                  </li>
                  <li>Security and fraud prevention consultants</li>
                  <li>Analytics providers</li>
                  <li>Support and customer service vendors</li>
                  <li>Payment processors</li>
                </ul>
              </li>
              <li>
                <strong>Parties You Authorize, Access or Authenticate</strong>
                <ul class="mt-1 ml-6 list-outside list-disc text-gray-600">
                  <li>
                    Third parties you access through the services (ORCID, Google
                    Drive)
                  </li>
                  <li>Project collaborators you invite</li>
                </ul>
              </li>
            </ul>

            <h3 class="pt-4 text-lg font-medium text-gray-900">
              Legal Obligations
            </h3>

            <p>
              We may share any Personal Data that we collect with third parties
              in conjunction with any of the activities set forth under "Meeting
              Legal Requirements and Enforcing Legal Terms" above.
            </p>

            <h3 class="pt-4 text-lg font-medium text-gray-900">
              Business Transfers
            </h3>

            <p>
              All of your Personal Data that we collect may be transferred to a
              third party if we undergo a merger, acquisition, bankruptcy or
              other transaction in which that third party assumes control of our
              business. Should one of these events occur, we will make
              reasonable efforts to notify you before your information becomes
              subject to different privacy and security policies and practices.
            </p>

            <h3 class="pt-4 text-lg font-medium text-gray-900">
              Data that is Not Personal Data
            </h3>

            <p>
              We may create aggregated, de-identified or anonymized data from
              the Personal Data we collect, including by removing information
              that makes the data personally identifiable to a particular user.
              We may use such aggregated, de-identified or anonymized data and
              share it with third parties for our lawful business purposes,
              provided that we will not share such data in a manner that could
              identify you.
            </p>

            <h3 class="pt-4 text-lg font-medium text-gray-900">
              Google OAuth and Google Drive
            </h3>

            <p>
              If you choose to sign in with Google or connect your Google
              account to use Google Drive features, CoRATES will process certain
              information from your Google account to provide the Services.
            </p>

            <ul class="ml-6 list-outside list-disc space-y-2 text-gray-600">
              <li>
                <strong>Scopes requested.</strong> When you connect Google, we
                request standard OpenID Connect scopes (openid, email, profile)
                and Google Drive read-only access
                (https://www.googleapis.com/auth/drive.readonly) to enable you
                to select and import PDF files from your Google Drive.
              </li>
              <li>
                <strong>Tokens stored.</strong> When you connect Google, we
                store OAuth tokens (such as access tokens and, when provided by
                Google, refresh tokens) associated with your account so we can
                maintain the connection and retrieve a short-lived access token
                when needed (for example, for the Google Picker experience or
                when an access token expires).
              </li>
              <li>
                <strong>What we do with Drive data.</strong> When you initiate
                an import, we use the Google Drive API to fetch file metadata
                (for example file name, MIME type and size) and download the
                contents of the specific file you selected. We then copy that
                PDF into CoRATES storage (Cloudflare R2) so it can be attached
                to your project/study within the Service. We may store the
                Google Drive file ID and file name as part of import metadata to
                support the import and auditing.
              </li>
              <li>
                <strong>Disconnecting Google.</strong> If you disconnect Google,
                we remove the stored Google account link and tokens used to
                access Google APIs. Disconnecting Google does not automatically
                delete PDFs you previously imported into CoRATES; to remove
                those, you must delete them from within the Service (or delete
                your account, where applicable).
              </li>
            </ul>

            <p>
              CoRATES's use of information received from Google APIs will comply
              with the Google API Services User Data Policy, including the
              Limited Use requirements. In particular, we use Google Drive data
              only to provide the user-requested functionality (such as
              importing a selected PDF into your project) and do not use Google
              Drive data for advertising.
            </p>

            {/* Tracking Tools and Opt-Out */}
            <h2
              id="tracking-tools"
              class="pt-6 text-xl font-semibold text-gray-900"
            >
              Tracking Tools and Opt-Out
            </h2>

            <p>
              The Services use cookies and similar technologies such as pixel
              tags, web beacons, clear GIFs and JavaScript (collectively,
              "Cookies") to enable our servers to recognize your web browser,
              tell us how and when you visit and use our Services, analyze
              trends, learn about our user base and operate and improve our
              Services.
            </p>

            <p>We use the following types of Cookies:</p>

            <ul class="ml-6 list-outside list-disc space-y-2">
              <li>
                <strong>Essential Cookies.</strong> Essential Cookies are
                required for providing you with features or services that you
                have requested. For example, certain Cookies enable you to log
                into secure areas of our Services. Disabling these Cookies may
                make certain features and services unavailable.
              </li>
              <li>
                <strong>Functional Cookies.</strong> Functional Cookies are used
                to record your choices and settings regarding our Services,
                maintain your preferences over time and recognize you when you
                return to our Services.
              </li>
              <li>
                <strong>Performance/Analytical Cookies.</strong>{' '}
                Performance/Analytical Cookies allow us to understand how
                visitors use our Services by collecting information about the
                number of visitors, what pages visitors view, and how long
                visitors are viewing pages.
              </li>
            </ul>

            <p>
              You can decide whether or not to accept Cookies through your
              internet browser's settings. Most browsers have an option for
              turning off the Cookie feature, which will prevent your browser
              from accepting new Cookies. If you do this, however, you may have
              to manually adjust some preferences every time you visit our
              website and some of the Services and functionalities may not work.
            </p>

            {/* Data Security and Retention */}
            <h2
              id="data-security"
              class="pt-6 text-xl font-semibold text-gray-900"
            >
              Data Security and Retention
            </h2>

            <p>
              We seek to protect your Personal Data from unauthorized access,
              use and disclosure using appropriate physical, technical,
              organizational and administrative security measures based on the
              type of Personal Data and how we are processing that data. These
              measures include:
            </p>

            <ul class="ml-6 list-outside list-disc space-y-1">
              <li>Encryption of data in transit (HTTPS/TLS)</li>
              <li>Secure password hashing</li>
              <li>Access controls and authentication</li>
              <li>Regular security assessments</li>
            </ul>

            <p>
              You should also help protect your data by appropriately selecting
              and protecting your password and/or other sign-on mechanism;
              limiting access to your computer or device and browser; and
              signing off after you have finished accessing your account.
              Although we work to protect the security of your account and other
              data that we hold in our records, please be aware that no method
              of transmitting data over the internet or storing data is
              completely secure.
            </p>

            <p>
              We retain Personal Data about you for as long as you have an open
              account with us or as otherwise necessary to provide you with our
              Services. In some cases we retain Personal Data for longer, if
              doing so is necessary to comply with our legal obligations,
              resolve disputes or collect fees owed, or is otherwise permitted
              or required by applicable law, rule or regulation.
            </p>

            {/* Personal Data of Children */}
            <h2 id="children" class="pt-6 text-xl font-semibold text-gray-900">
              Personal Data of Children
            </h2>

            <p>
              As noted in the{' '}
              <a href="/terms" class="text-blue-600 hover:text-blue-700">
                Terms of Service
              </a>
              , we do not knowingly collect or solicit Personal Information from
              anyone under the age of 13. If you are under 13, please do not
              attempt to register for the Services or send any Personal
              Information about yourself to us. If we learn that we have
              collected Personal Information from a child under age 13, we will
              delete that information as quickly as possible. If you believe
              that a child under 13 may have provided us Personal Information,
              please contact us at{' '}
              <a
                href="mailto:privacy@corates.org"
                class="text-blue-600 hover:text-blue-700"
              >
                privacy@corates.org
              </a>
              .
            </p>

            {/* State Law Privacy Rights */}
            <h2
              id="state-rights"
              class="pt-6 text-xl font-semibold text-gray-900"
            >
              State Law Privacy Rights
            </h2>

            <h3 class="pt-4 text-lg font-medium text-gray-900">
              California Resident Rights
            </h3>

            <p>
              Under California Civil Code Sections 1798.83-1798.84, California
              residents are entitled to contact us to prevent disclosure of
              Personal Data to third parties for such third parties' direct
              marketing purposes; in order to submit such a request, please
              contact us at{' '}
              <a
                href="mailto:privacy@corates.org"
                class="text-blue-600 hover:text-blue-700"
              >
                privacy@corates.org
              </a>
              .
            </p>

            <h3 class="pt-4 text-lg font-medium text-gray-900">
              Nevada Resident Rights
            </h3>

            <p>
              If you are a resident of Nevada, you have the right to opt-out of
              the sale of certain Personal Data to third parties who intend to
              license or sell that Personal Data. You can exercise this right by
              contacting us at{' '}
              <a
                href="mailto:privacy@corates.org"
                class="text-blue-600 hover:text-blue-700"
              >
                privacy@corates.org
              </a>{' '}
              with the subject line "Nevada Do Not Sell Request" and providing
              us with your name and the email address associated with your
              account.
            </p>

            {/* European Union Data Subject Rights */}
            <h2 id="eu-rights" class="pt-6 text-xl font-semibold text-gray-900">
              European Union Data Subject Rights
            </h2>

            <h3 class="pt-4 text-lg font-medium text-gray-900">EU Residents</h3>

            <p>
              If you are a resident of the European Union ("EU"), United
              Kingdom, Lichtenstein, Norway or Iceland, you may have additional
              rights under the EU General Data Protection Regulation (the
              "GDPR") with respect to your Personal Data.
            </p>

            <p>
              For this section, we use the terms "Personal Data" and
              "processing" as they are defined in the GDPR, but "Personal Data"
              generally means information that can be used to individually
              identify a person, and "processing" generally covers actions that
              can be performed in connection with data such as collection, use,
              storage and disclosure. CoRATES will be the controller of your
              Personal Data processed in connection with the Services.
            </p>

            <h3 class="pt-4 text-lg font-medium text-gray-900">
              EU Data Subject Rights
            </h3>

            <p>
              You have certain rights with respect to your Personal Data,
              including those set forth below. For more information about these
              rights, or to submit a request, please email us at{' '}
              <a
                href="mailto:privacy@corates.org"
                class="text-blue-600 hover:text-blue-700"
              >
                privacy@corates.org
              </a>
              .
            </p>

            <ul class="ml-6 list-outside list-disc space-y-2">
              <li>
                <strong>Access:</strong> You can request more information about
                the Personal Data we hold about you and request a copy of such
                Personal Data.
              </li>
              <li>
                <strong>Rectification:</strong> If you believe that any Personal
                Data we are holding about you is incorrect or incomplete, you
                can request that we correct or supplement such data.
              </li>
              <li>
                <strong>Erasure:</strong> You can request that we erase some or
                all of your Personal Data from our systems.
              </li>
              <li>
                <strong>Withdrawal of Consent:</strong> If we are processing
                your Personal Data based on your consent, you have the right to
                withdraw your consent at any time.
              </li>
              <li>
                <strong>Portability:</strong> You can ask for a copy of your
                Personal Data in a machine-readable format.
              </li>
              <li>
                <strong>Objection:</strong> You can contact us to let us know
                that you object to the further use or disclosure of your
                Personal Data for certain purposes, such as for direct marketing
                purposes.
              </li>
              <li>
                <strong>Restriction of Processing:</strong> You can ask us to
                restrict further processing of your Personal Data.
              </li>
              <li>
                <strong>Right to File Complaint:</strong> You have the right to
                lodge a complaint about CoRATES's practices with respect to your
                Personal Data with the supervisory authority of your country or
                EU Member State.
              </li>
            </ul>

            <h3 class="pt-4 text-lg font-medium text-gray-900">
              Transfers of Personal Data
            </h3>

            <p>
              The Services are hosted and operated in the United States ("U.S.")
              through CoRATES and its service providers, and if you do not
              reside in the U.S., laws in the U.S. may differ from the laws
              where you reside. By using the Services, you acknowledge that any
              Personal Data about you, regardless of whether provided by you or
              obtained from a third party, is being provided to CoRATES in the
              U.S. and will be hosted on U.S. servers, and you authorize CoRATES
              to transfer, store and process your information to and in the
              U.S., and possibly other countries.
            </p>

            {/* Changes to this Privacy Policy */}
            <h2 id="changes" class="pt-6 text-xl font-semibold text-gray-900">
              Changes to this Privacy Policy
            </h2>

            <p>
              We're constantly trying to improve our Services, so we may need to
              change this Privacy Policy from time to time, but we will alert
              you to any such changes by placing a notice on the CoRATES
              website, by sending you an email and/or by some other means.
              Please note that if you've opted not to receive legal notice
              emails from us (or you haven't provided us with your email
              address), those legal notices will still govern your use of the
              Services, and you are still responsible for reading and
              understanding them. If you use the Services after any changes to
              the Privacy Policy have been posted, that means you agree to all
              of the changes.
            </p>

            {/* Contact Information */}
            <h2 id="contact" class="pt-6 text-xl font-semibold text-gray-900">
              Contact Information
            </h2>

            <p>
              If you have any questions or comments about this Privacy Policy,
              the ways in which we collect and use your Personal Data or your
              choices and rights regarding such collection and use, please do
              not hesitate to contact us at:
            </p>

            <p>
              Email:{' '}
              <a
                href="mailto:privacy@corates.org"
                class="text-blue-600 hover:text-blue-700"
              >
                privacy@corates.org
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
