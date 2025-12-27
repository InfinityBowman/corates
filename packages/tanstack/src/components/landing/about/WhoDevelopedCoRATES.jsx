export default function WhoDevelopedCoRATES() {
  return (
    <section class="mx-auto max-w-5xl px-6 py-20">
      <div class="mb-12 text-center">
        <h2 class="mb-4 text-2xl font-bold text-gray-900 md:text-3xl">
          Who Developed CoRATES?
        </h2>
        <p class="mx-auto max-w-3xl leading-relaxed text-gray-600">
          CoRATES was developed through a collaboration between an evidence
          synthesis expert and a software engineer who recognized the need to
          modernize and streamline the workflow of study appraisal in research
          synthesis. Our continued development focuses on pairing practical,
          user-centered features with thoughtful design to enhance both the
          rigor and the efficiency of the evidence appraisal process.
        </p>
      </div>

      <div class="grid gap-8 md:grid-cols-2">
        {/* Brandy */}
        <div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <div class="mb-6 flex flex-col items-center text-center">
            <img
              src="/brandy.jpg"
              alt="Brandy Maynard"
              class="mb-4 h-28 w-28 rounded-full object-cover ring-4 ring-blue-50"
            />
            <h3 class="text-xl font-semibold text-gray-900">Brandy Maynard</h3>
            <p class="mt-1 text-sm font-medium text-blue-600">
              Research Synthesis Expert
            </p>
          </div>
          <div class="space-y-4 text-sm leading-relaxed text-gray-600">
            <p>
              Brandy is a research synthesist with extensive expertise in
              systematic review methodology and evidence appraisal. She
              completed her first systematic review as a{' '}
              <a
                href="https://www.campbellcollaboration.org"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-700 hover:underline"
              >
                Campbell Collaboration
              </a>{' '}
              review during her PhD, reflecting her commitment to rigorous and
              transparent methods from the very beginning of her career. She has
              been actively involved with the Campbell Collaboration for over 15
              years as an author and currently serves as Co-Chair and Editor of
              the Social Welfare Coordinating Group.
            </p>
            <p>
              Over her career, Brandy has authored more than 30 systematic
              reviews and overviews, regularly teaches systematic review
              methods, supervises doctoral students conducting evidence
              syntheses, and supports research teams in developing high-quality,
              methodologically sound reviews. Her firsthand experience with the
              practical challenges of managing the study appraisal process
              shaped the vision for CoRATES and directly informed its emphasis
              on usability and methodological rigor.
            </p>
            <p>
              While CoRATES is a project Brandy is deeply passionate about, she
              spends most of her time at{' '}
              <a
                href="https://www.slu.edu/social-work/faculty/maynard-brandy.php"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-700 hover:underline"
              >
                Saint Louis University
              </a>
              , where she serves as a Professor and Associate Dean for Academic
              Affairs in the School of Social Work.
            </p>
          </div>
        </div>

        {/* Jacob */}
        <div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <div class="mb-6 flex flex-col items-center text-center">
            <img
              src="/jacob.jpeg"
              alt="Jacob Maynard"
              class="mb-4 h-28 w-28 rounded-full object-cover ring-4 ring-blue-50"
            />
            <h3 class="text-xl font-semibold text-gray-900">Jacob Maynard</h3>
            <p class="mt-1 text-sm font-medium text-blue-600">
              Software Engineer & Data Scientist
            </p>
          </div>
          <div class="space-y-4 text-sm leading-relaxed text-gray-600">
            <p>
              Jacob is a software engineer and data scientist who focuses on
              designing clear, intuitive, and scalable software. With strengths
              in systems architecture, user interface design, and data
              visualization, he enjoys building tools that solve practical
              problems for real users.
            </p>
            <p>
              His early work visualizing risk-of-bias data for an overview of
              reviews sparked his interest in research synthesis processes, and
              he brings a strong commitment to creating thoughtful, high-quality
              user experiences.
            </p>
            <p>
              As the technical lead for CoRATES, Jacob built the platform from
              the ground up, translating methodological requirements into a
              modern, collaborative system.
            </p>
            <p>
              His software engineering expertise and attention to research
              workflows are central to the platform's design and user
              experience.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
