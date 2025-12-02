import { Title, Meta } from '@solidjs/meta';
import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';
import { urls } from '~/lib/config';

export default function About() {
  return (
    <>
      <Title>About CoRATES - Our Story and Team</Title>
      <Meta
        name='description'
        content='Learn about CoRATES, developed by a research synthesis expert and software engineer to support rigorous evidence appraisal.'
      />
      <div class='min-h-screen bg-linear-to-b from-gray-50 to-white'>
        <Navbar />
        <main>
          {/* Hero Section */}
          <section class='max-w-4xl mx-auto px-6 py-16 md:py-24'>
            <h1 class='text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center'>
              About CoRATES
            </h1>
            <p class='text-lg text-gray-600 leading-relaxed text-center max-w-3xl mx-auto'>
              Developed by a research synthesis expert and a software engineer and data scientist,
              CoRATES combines methodological expertise with modern software engineering to support
              rigorous evidence appraisal.
            </p>
          </section>

          {/* Origin Story */}
          <section class='bg-gray-50 border-y border-gray-100'>
            <div class='max-w-4xl mx-auto px-6 py-16'>
              <h2 class='text-2xl font-bold text-gray-900 mb-6'>What is CoRATES?</h2>
              <div class='space-y-4 text-gray-600 leading-relaxed'>
                <p>
                  CoRATES is more than a checklist platform. It is an ecosystem built to support
                  high-quality and efficient study appraisal by bringing every part of the process
                  into one organized, interactive workspace. Instead of manually managing PDF or
                  Word checklists, tracking decisions across spreadsheets, emailing files back and
                  forth, and creating visualizations in statistical software, CoRATES automates
                  these steps within a single, integrated platform. What typically requires multiple
                  tools and extensive manual effort is handled seamlessly within CoRATES.
                </p>
                <p>
                  Beyond streamlining and automating the study appraisal process, CoRATES is
                  intentionally designed to strengthen rigor by embedding the practices that support
                  high-quality appraisal, including double coding, consensus processes, transparent
                  documentation, and consistent rule-based scoring.
                </p>
                <p>
                  Developed collaboratively by an expert in research synthesis and a software
                  engineer and data scientist, CoRATES integrates methodological expertise with
                  modern software design to support rigorous and trustworthy evidence synthesis.
                </p>
              </div>
            </div>
          </section>

          {/* Who It's For */}
          <section class='max-w-4xl mx-auto px-6 py-16'>
            <h2 class='text-2xl font-bold text-gray-900 mb-6'>Who CoRATES Is For</h2>
            <div class='space-y-4 text-gray-600 leading-relaxed'>
              <p>
                Whether you are part of a systematic review team, teaching research methods,
                completing a one-off appraisal, or learning the fundamentals of study quality
                assessment, CoRATES can help you complete evidence appraisal in a more efficient and
                effective way.
              </p>
              <p>
                CoRATES does not create new appraisal tools. Rather, it helps researchers use
                established and validated tools more effectively by providing intuitive workflows,
                guided checklists, support for double coding and consensus, automatic scoring, and
                clear visual summaries. Together, these features increase transparency and reduce
                the burden of managing information across paper and spreadsheets.
              </p>
              <p class='font-medium text-gray-900'>
                CoRATES is more than a checklist platform. It is an ecosystem built to support
                high-quality and efficient study appraisal at every level, from individual learners
                to professional review teams.
              </p>
            </div>
          </section>

          {/* Who We Are */}
          <section class='bg-gray-50 border-y border-gray-100'>
            <div class='max-w-4xl mx-auto px-6 py-16'>
              <h2 class='text-2xl font-bold text-gray-900 mb-6 text-center'>Who We Are</h2>
              <p class='text-gray-600 leading-relaxed text-center max-w-3xl mx-auto mb-12'>
                We are committed to developing a platform that not only addresses practical
                challenges, but also aligns with best practices to enhance the rigor and efficiency
                of evidence appraisal for research synthesis. By combining methodological expertise
                with modern software engineering, we designed a platform that makes study appraisal
                more organized, transparent, and reliable. Our shared goal is to build a platform
                grounded in rigor, supported by thoughtful design, and genuinely useful to
                researchers, students, clinicians, and teams.
              </p>

              <div class='grid md:grid-cols-2 gap-8'>
                {/* Brandy */}
                <div class='bg-white rounded-xl p-6 shadow-sm border border-gray-100'>
                  <h3 class='text-xl font-semibold text-gray-900 mb-4'>Brandy Maynard</h3>
                  <p class='text-sm text-blue-600 font-medium mb-4'>Research Synthesis Expert</p>
                  <div class='space-y-3 text-gray-600 text-sm leading-relaxed'>
                    <p>
                      Brandy is a research synthesist with extensive expertise in systematic review
                      methodology and evidence appraisal. She completed her first systematic review
                      as a Campbell Collaboration review during her PhD, reflecting her commitment
                      to rigorous and transparent methods from the very beginning of her career.
                    </p>
                    <p>
                      She has been actively involved with the Campbell Collaboration for over 15
                      years as an author and currently serves as Co-Chair and Editor of the Social
                      Welfare Coordinating Group.
                    </p>
                    <p>
                      Over her career, Brandy has authored more than 30 systematic reviews and
                      overviews, regularly teaches systematic review methods, supervises doctoral
                      students conducting evidence syntheses, and supports research teams in
                      developing high-quality, methodologically sound reviews.
                    </p>
                    <p>
                      Her firsthand experience with the practical challenges of managing the study
                      appraisal process shaped the vision for CoRATES and directly informed its
                      emphasis on usability and methodological rigor.
                    </p>
                  </div>
                </div>

                {/* Jacob */}
                <div class='bg-white rounded-xl p-6 shadow-sm border border-gray-100'>
                  <h3 class='text-xl font-semibold text-gray-900 mb-4'>Jacob Maynard</h3>
                  <p class='text-sm text-blue-600 font-medium mb-4'>
                    Software Engineer & Data Scientist
                  </p>
                  <div class='space-y-3 text-gray-600 text-sm leading-relaxed'>
                    <p>
                      Jacob is a software engineer and data scientist who focuses on designing
                      clear, intuitive, and scalable software. With strengths in systems
                      architecture, user interface design, and data visualization, he enjoys
                      building tools that solve practical problems for real users.
                    </p>
                    <p>
                      His early work visualizing risk-of-bias data for an overview of reviews
                      sparked his interest in research synthesis processes, and he brings a strong
                      commitment to creating thoughtful, high-quality user experiences.
                    </p>
                    <p>
                      As the technical lead for CoRATES, Jacob built the platform from the ground
                      up, translating methodological requirements into a modern, collaborative
                      system.
                    </p>
                    <p>
                      His software engineering expertise and attention to research workflows are
                      central to the platform's design and user experience.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section class='max-w-4xl mx-auto px-6 py-16 text-center'>
            <h2 class='text-2xl font-bold text-gray-900 mb-4'>Ready to get started?</h2>
            <p class='text-gray-600 mb-8'>
              Try CoRATES for free and see how it can streamline your evidence appraisal workflow.
            </p>
            <a
              href={urls.signUp()}
              class='inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors'
            >
              Get Started Free
            </a>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}
