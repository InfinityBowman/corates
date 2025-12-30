import { Title, Meta, Link } from '@solidjs/meta';
import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';
import { config } from '~/lib/config';

export default function TermsOfService() {
  const pageUrl = `${config.appUrl}/terms`;
  const title = 'Terms of Service - CoRATES';
  const description =
    'Terms of Service for CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis';

  return (
    <>
      <Title>{title}</Title>
      <Meta name='description' content={description} />
      <Link rel='canonical' href={pageUrl} />
      <Meta property='og:title' content={title} />
      <Meta property='og:description' content={description} />
      <Meta property='og:url' content={pageUrl} />
      <Meta name='twitter:title' content={title} />
      <Meta name='twitter:description' content={description} />

      <div class='flex min-h-screen flex-col'>
        <Navbar />

        <main class='flex-1 py-16'>
          <div class='mx-auto max-w-3xl px-6'>
            <h1 class='mb-2 text-4xl font-bold text-gray-900'>Terms of Service</h1>
            <p class='mb-12 text-gray-500'>Effective date: December 5, 2025</p>

            <div class='space-y-6 leading-relaxed text-gray-700'>
              <p>
                THESE TERMS OF SERVICE (the "Agreement") GOVERN CUSTOMER'S RECEIPT, ACCESS TO AND
                USE OF THE SERVICE (AS DEFINED BELOW) PROVIDED BY SYNTCH LLC, doing business as
                CoRATES ("Syntch LLC" or "we"). IN ACCEPTING THIS AGREEMENT BY (A) PURCHASING ACCESS
                TO THE SERVICE THROUGH AN ONLINE ORDERING PROCESS THAT REFERENCES THIS AGREEMENT,
                (B) SIGNING UP FOR A FREE ACCESS PLAN FOR THE SERVICE THROUGH A SCREEN THAT
                REFERENCES THIS AGREEMENT, OR (C) CLICKING A BOX INDICATING ACCEPTANCE, CUSTOMER
                AGREES TO BE BOUND BY ITS TERMS.
              </p>

              <p>
                THE INDIVIDUAL ACCEPTING THIS AGREEMENT DOES SO ON BEHALF OF A COMPANY OR OTHER
                LEGAL ENTITY ("Customer"); SUCH INDIVIDUAL REPRESENTS AND WARRANTS THAT THEY HAVE
                THE AUTHORITY TO BIND SUCH ENTITY TO THIS AGREEMENT. IF THE INDIVIDUAL ACCEPTING
                THIS AGREEMENT DOES NOT HAVE SUCH AUTHORITY, OR THE APPLICABLE ENTITY DOES NOT AGREE
                WITH THESE TERMS AND CONDITIONS, SUCH INDIVIDUAL MUST NOT ACCEPT THIS AGREEMENT AND
                MAY NOT USE OR RECEIVE THE SERVICE. CAPITALIZED TERMS HAVE THE DEFINITIONS SET FORTH
                HEREIN. THE PARTIES AGREE AS FOLLOWS:
              </p>

              <h2 class='pt-6 text-xl font-semibold text-gray-900'>1. The Service</h2>

              <p>
                <strong>1.1. Service Description.</strong> Syntch LLC, doing business as CoRATES, is
                the provider of a cloud-based collaborative research appraisal tool for evidence
                synthesis (the "Service"). The Service allows users to create projects, manage
                studies, complete quality assessment checklists (such as AMSTAR 2), collaborate with
                team members, and organize research materials. Anything Customer (including Users)
                posts, uploads, shares, stores, or otherwise provides through the Service is
                considered a "User Submission." Customer is solely responsible for all User
                Submissions it contributes to the Service. The Service may also include templates,
                help documents, and other documents or information that can assist Customer using
                the Service ("CoRATES Content"). Customer will not receive or have access to the
                code or software that underlies the Service (collectively the "Software") or receive
                a copy of the Software itself.
              </p>

              <p>
                <strong>1.2. Customer's Subscription.</strong> Subject to the terms of this
                Agreement, Customer may purchase a subscription to, and has the right to access and
                use, the Service as specified in one or more ordering screens agreed to by the
                parties through CoRATES's website that reference this Agreement and describe the
                business terms related to Customer's subscription ("Order(s)"). All subscriptions
                will be for the period described on the applicable Order ("Subscription Period").
                Use of and access to the Service is permitted only by individuals authorized by
                Customer and for Customer's own internal business purposes and not for the benefit
                of any third party ("Users").
              </p>

              <p>
                <strong>1.3. Ownership.</strong> Syntch LLC owns the Service, Software, CoRATES
                Content, Documentation, and anything else provided by Syntch LLC to Customer
                (collectively the "CoRATES Materials"). Syntch LLC retains all right, title and
                interest (including, without limitation, all patent, copyright, trademarks, trade
                secret and other intellectual property rights) in and to the CoRATES Materials, all
                related and underlying technology and any updates, enhancements, upgrades,
                modifications, patches, workarounds, and fixes thereto and all derivative works of
                or modifications to any of the foregoing. There are no implied licenses under this
                Agreement and any rights not expressly granted to Customer in this Agreement are
                expressly reserved by Syntch LLC.
              </p>

              <p>
                <strong>1.4. Permissions.</strong> The Service contains customizable settings
                allowing each User to give permission to other Users to perform various tasks within
                the Service ("Permissions"). It is solely Customer's responsibility to set and
                manage all Permissions, including which Users can set such Permissions. Accordingly,
                Syntch LLC will have no responsibility for managing Permissions and no liability for
                the Permissions set by Customer and its Users.
              </p>

              <h2 class='pt-6 text-xl font-semibold text-gray-900'>2. Restrictions</h2>

              <p>
                <strong>2.1. Customer's Responsibilities.</strong> Customer is responsible for all
                activity on its Users' accounts unless such activity is caused by a third party bad
                actor able to access Customer's account by exploiting vulnerabilities in the Service
                itself. Customer will ensure that its Users are aware of and bound by obligations
                and/or restrictions stated in this Agreement and Customer will be responsible for
                breach of any such obligation and/or restriction by a User.
              </p>

              <p>
                <strong>2.2. Use Restrictions.</strong> Customer agrees that it will not, and will
                not allow Users or third parties to, directly or indirectly (a) modify, translate,
                copy or create derivative works based on the Service, (b) reverse assemble, reverse
                compile, reverse engineer, decompile or otherwise attempt to discover the object
                code, source code, non-public APIs or underlying ideas or algorithms of the Service,
                except as and only to the extent this restriction is prohibited by law, (c) license,
                sublicense, sell, resell, rent, lease, transfer, assign, distribute, time share or
                otherwise commercially exploit or make the Service available to any third party, (d)
                remove or obscure any copyright, trademark or other proprietary notices, legends or
                CoRATES branding contained in or on the Service, (e) use the Service in any way that
                violates any applicable federal, state, local or international law or regulation,
                (f) attempt to gain unauthorized access to, interfere with, damage or disrupt any
                parts of the Service, including, without limitation, by introducing viruses and
                other harmful code, (g) use or access the Service to build or support products or
                services competitive to the Service, or (h) attempt to probe, scan, or test the
                vulnerability of the Service or any Syntch LLC system or networks.
              </p>

              <h2 class='pt-6 text-xl font-semibold text-gray-900'>3. Third-Party Applications</h2>

              <p>
                The Service may work together with third party products, services or applications
                that are not owned or controlled by Syntch LLC (e.g., ORCID, Google Drive)
                ("Third-Party Applications") and Customer, at its sole option, may choose to use
                such Third-Party Applications. Syntch LLC does not endorse such Third-Party
                Applications. Customer acknowledges and agrees that this Agreement does not apply to
                Customer's use of such Third-Party Applications and Customer may be required by the
                providers of such Third-Party Applications to enter into separate agreements for
                Customer's use. Syntch LLC expressly disclaims all representations and warranties
                relating to any Third-Party Applications. Customer's use of Third-Party Applications
                is at Customer's own risk.
              </p>

              <p>
                If Customer connects Google Drive, Customer authorizes Syntch LLC to access
                Customer's Google Drive files on a read-only basis solely to enable
                Customer-selected import of PDF documents into the Service. Any documents imported
                into the Service become User Submissions and will be stored and processed as
                described in this Agreement and the Privacy Policy.
              </p>

              <h2 class='pt-6 text-xl font-semibold text-gray-900'>4. Payment Obligations</h2>

              <p>
                <strong>4.1. Fees.</strong> Customer will pay for access to and use of the Service
                as set forth on the applicable Order ("Fees"). All Fees will be paid in the currency
                stated in the applicable Order or, if no currency is specified, U.S. dollars.
                Payment obligations are non-cancelable and, except as expressly stated in this
                Agreement, non-refundable. Syntch LLC may modify its Fees or introduce new fees in
                its sole discretion. Customer always has the right to choose not to renew its
                subscription if it does not agree with any new or revised Fees.
              </p>

              <p>
                <strong>4.2. Payment.</strong> Syntch LLC, either directly or through its
                third-party payment processor ("Payment Processor") will charge Customer for the
                Fees via credit card or other payment method, pursuant to the payment information
                provided by Customer to Syntch LLC. It is Customer's sole responsibility to provide
                Syntch LLC with current and up to date payment information; failure to provide such
                information may result in suspension of Customer's access to the Services.
              </p>

              <p>
                <strong>4.3. Taxes.</strong> Fees do not include any taxes, levies, duties or
                similar governmental assessments of any nature (collectively, "Taxes"). Customer is
                responsible for paying all Taxes associated with its purchases hereunder.
              </p>

              <p>
                <strong>4.4. Failure to Pay.</strong> If Customer fails to pay any Fees when due,
                Syntch LLC may suspend Customer's access to the Service pending payment of such
                overdue amounts.
              </p>

              <h2 class='pt-6 text-xl font-semibold text-gray-900'>5. Term and Termination</h2>

              <p>
                <strong>5.1. Agreement Term and Renewals.</strong> Subscriptions to access and use
                the Service commence on the start date stated on the applicable Order ("Subscription
                Start Date") and continue for the duration of the Subscription Period. Customer may
                choose not to renew its Subscription Period by notifying Syntch LLC or by modifying
                its subscription through Customer's account within the Service. This Agreement will
                become effective on the first day of the Subscription Period and remain effective
                for the duration of the Subscription Period stated on the Order along with any
                renewals.
              </p>

              <p>
                <strong>5.2. Termination.</strong> Either party may terminate this Agreement upon
                written notice to the other party if the other party materially breaches this
                Agreement and such breach is not cured within thirty (30) days after the breaching
                party's receipt of such notice. Syntch LLC may terminate Customer's access to any
                free version at any time upon notice to Customer.
              </p>

              <p>
                <strong>5.3. Effect of Termination.</strong> If Customer terminates this Agreement
                because of Syntch LLC's uncured breach, Syntch LLC will refund any unused, prepaid
                Fees for the remainder of the then-current Subscription Period. Upon any termination
                of this Agreement, all rights and licenses granted by Syntch LLC hereunder will
                immediately terminate; Customer will no longer have the right to access or use the
                Service. Within thirty (30) days of termination, upon Customer's request, Syntch LLC
                will delete Customer's User Information and User Submissions.
              </p>

              <p>
                <strong>5.4. Survival.</strong> Sections titled "Ownership", "Third-Party
                Applications", "Payment Obligations", "Term and Termination", "Warranty Disclaimer",
                "Limitation of Liability", "Confidentiality", "Data" and "General Terms" will
                survive any termination or expiration of this Agreement.
              </p>

              <h2 class='pt-6 text-xl font-semibold text-gray-900'>
                6. Warranties and Disclaimers
              </h2>

              <p>
                <strong>6.1. Warranties.</strong> Customer represents and warrants that all User
                Submissions submitted by Users follow all applicable laws, rules and regulations.
              </p>

              <p>
                <strong>6.2. Warranty Disclaimer.</strong> EXCEPT AS EXPRESSLY PROVIDED FOR HEREIN,
                THE SERVICES AND ALL RELATED COMPONENTS AND INFORMATION ARE PROVIDED ON AN "AS IS"
                AND "AS AVAILABLE" BASIS WITHOUT ANY WARRANTIES OF ANY KIND, AND SYNTCH LLC
                EXPRESSLY DISCLAIMS ANY AND ALL WARRANTIES, WHETHER EXPRESS OR IMPLIED, INCLUDING
                THE IMPLIED WARRANTIES OF MERCHANTABILITY, TITLE, FITNESS FOR A PARTICULAR PURPOSE,
                AND NON-INFRINGEMENT. CUSTOMER ACKNOWLEDGES THAT SYNTCH LLC DOES NOT WARRANT THAT
                THE SERVICES WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE. THE SERVICE IS A
                TOOL TO ASSIST WITH RESEARCH QUALITY ASSESSMENT AND DOES NOT REPLACE PROFESSIONAL
                JUDGMENT.
              </p>

              <h2 class='pt-6 text-xl font-semibold text-gray-900'>7. Limitation of Liability</h2>

              <p>
                NOTWITHSTANDING ANYTHING TO THE CONTRARY IN THIS AGREEMENT, SYNTCH LLC WILL NOT BE
                LIABLE WITH RESPECT TO ANY CAUSE RELATED TO OR ARISING OUT OF THIS AGREEMENT,
                WHETHER IN AN ACTION BASED ON A CONTRACT, TORT (INCLUDING NEGLIGENCE AND STRICT
                LIABILITY) OR ANY OTHER LEGAL THEORY, HOWEVER ARISING, FOR (A) INDIRECT, SPECIAL,
                INCIDENTAL OR CONSEQUENTIAL DAMAGES, (B) ANY DAMAGES BASED ON USE OR ACCESS,
                INTERRUPTION, DELAY OR INABILITY TO USE THE SERVICE, LOST REVENUES OR PROFITS,
                DELAYS, INTERRUPTION OR LOSS OF SERVICES, BUSINESS OR GOODWILL, LOSS OR CORRUPTION
                OF DATA, OR (C) ANY DAMAGES THAT IN THE AGGREGATE EXCEED THE TOTAL FEES PAID OR
                PAYABLE BY CUSTOMER FOR THE SERVICE DURING THE TWELVE (12) MONTH PERIOD IMMEDIATELY
                PRECEDING THE EVENT WHICH GIVES RISE TO SUCH DAMAGES.
              </p>

              <h2 class='pt-6 text-xl font-semibold text-gray-900'>8. Confidentiality</h2>

              <p>
                <strong>8.1. Definition.</strong> Each party (the "Receiving Party") understands
                that the other party (the "Disclosing Party") may disclose business, technical or
                financial information relating to the Disclosing Party's business that reasonably
                should be understood to be confidential given the nature of the information and the
                circumstances of disclosure ("Confidential Information"). Syntch LLC's Confidential
                Information includes non-public information regarding features, functionality, and
                performance of the Service. Customer's Confidential Information includes the User
                Information and User Submissions.
              </p>

              <p>
                <strong>8.2. Protection and Use.</strong> The Receiving Party will (a) protect the
                Disclosing Party's Confidential Information using the same degree of care used to
                protect its own confidential information of like importance, but in any case using
                no less than a reasonable degree of care, (b) limit access to the Confidential
                Information to those who need to know such information in connection with this
                Agreement, and (c) not use the Disclosing Party's Confidential Information for any
                purpose other than to fulfill its obligations under this Agreement.
              </p>

              <p>
                <strong>8.3. Feedback.</strong> Customer may from time to time provide suggestions,
                comments, or other feedback with respect to the Service ("Feedback"). Customer
                hereby grants to Syntch LLC a royalty-free, worldwide, perpetual, irrevocable, fully
                transferable and sublicensable right and license to use, disclose, reproduce,
                modify, create derivative works from, distribute, display, and otherwise exploit any
                Feedback as Syntch LLC sees fit, without obligation or restriction of any kind.
              </p>

              <h2 class='pt-6 text-xl font-semibold text-gray-900'>9. Data</h2>

              <p>
                <strong>9.1. User Information.</strong> Customer and its Users are required to
                provide information such as name, email address, and other account information
                ("User Information") upon logging into the Service. Customer grants Syntch LLC and
                its subcontractors the right to store, process and retrieve the User Information in
                connection with Customer's use of the Service.
              </p>

              <p>
                <strong>9.2. User Submissions.</strong> Customer grants Syntch LLC and its
                subcontractors a non-exclusive, worldwide, royalty-free, transferable right and
                license to use, process, and display User Submissions for the sole purpose of
                providing the Service to Customer. Except for the limited rights and licenses
                granted in this Agreement, Customer will own all right, title and interest in and to
                the User Submissions.
              </p>

              <p>
                <strong>9.3. Service Data.</strong> As Customer interacts with the Service, the
                Service collects data pertaining to the performance of the Service and measures of
                its operation ("Service Data"). Provided that the Service Data is aggregated and
                anonymized, and no User Information, User Submissions, or any other personal
                identifying information is revealed, Syntch LLC is free to use the Service Data in
                any manner.
              </p>

              <p>
                <strong>9.4. Data Protection.</strong> Syntch LLC has established and implemented
                reasonable information security practices regarding the protection of User
                Submissions and User Information. Notwithstanding the foregoing, Customer is
                responsible for maintaining appropriate security, protection and backup of its
                hardware, software, systems, information, and data.
              </p>

              <h2 class='pt-6 text-xl font-semibold text-gray-900'>10. General Terms</h2>

              <p>
                <strong>10.1. Force Majeure.</strong> Syntch LLC will not be liable by reason of any
                failure or delay in the performance of its obligations on account of events beyond
                its reasonable control, which may include failure by a third-party hosting provider,
                strikes, shortages, riots, fires, acts of God, war, terrorism, and governmental
                action.
              </p>

              <p>
                <strong>10.2. Changes.</strong> Customer acknowledges that the Service is an online,
                subscription-based product, and that to provide improved customer experience Syntch
                LLC may make changes to the Service, provided however Syntch LLC will not materially
                decrease the core functionality of the Service. Syntch LLC may also unilaterally
                modify the terms of this Agreement by notifying Customer at least thirty (30) days
                prior to such changes taking effect.
              </p>

              <p>
                <strong>10.3. Relationship of the Parties.</strong> The parties are independent
                contractors. This Agreement does not create a partnership, franchise, joint venture,
                agency, fiduciary, or employment relationship between the parties.
              </p>

              <p>
                <strong>10.4. No Third-Party Beneficiaries.</strong> There are no third-party
                beneficiaries to this Agreement; a person who is not a party to this Agreement may
                not enforce any of its terms under any applicable law.
              </p>

              <p>
                <strong>10.5. Communications.</strong> Notices under this Agreement will be provided
                by email. Notices to Syntch LLC must be sent to{' '}
                <a href='mailto:legal@corates.org' class='text-blue-600 hover:text-blue-700'>
                  legal@corates.org
                </a>
                . Notices to Customer will be sent to the email provided through the Service.
              </p>

              <p>
                <strong>10.6. Amendment and Waivers.</strong> No modification or amendment to this
                Agreement will be effective unless made in writing and accepted by an authorized
                representative of both parties. No failure or delay by either party in exercising
                any right under this Agreement will constitute a waiver of that right.
              </p>

              <p>
                <strong>10.7. Severability.</strong> This Agreement will be enforced to the fullest
                extent permitted under applicable law. If any provision of this Agreement is held by
                a court of competent jurisdiction to be contrary to law, the provision will be
                modified and interpreted so as best to accomplish the objectives of the original
                provision to the fullest extent permitted by law, and the remaining provisions will
                remain in effect.
              </p>

              <p>
                <strong>10.8. Assignment.</strong> Neither party will assign or delegate any of its
                rights or obligations hereunder, without the prior written consent of the other
                party. Notwithstanding the foregoing, Syntch LLC may assign this Agreement in its
                entirety, without the consent of Customer, in connection with a merger, acquisition,
                corporate reorganization, or sale of all or substantially all of Syntch LLC's
                assets.
              </p>

              <p>
                <strong>10.9. Governing Law and Venue.</strong> This Agreement, and any disputes
                arising out of or related hereto, will be governed exclusively by the internal laws
                of the State of Delaware, without regard to its conflicts of laws rules.
              </p>

              <p>
                <strong>10.10. Entire Agreement.</strong> This Agreement, including all referenced
                pages and Orders, if applicable, constitutes the entire agreement between the
                parties and supersedes all prior and contemporaneous agreements, proposals, or
                representations, written or oral, concerning its subject matter.
              </p>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
