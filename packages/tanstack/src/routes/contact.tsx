import { createFileRoute } from '@tanstack/solid-router'
import { createSignal } from 'solid-js'
import { FiMail, FiSend, FiUser, FiMessageSquare, FiLoader, FiAlertCircle } from 'solid-icons/fi'
import Navbar from '@components/landing/Navbar'
import Footer from '@components/landing/Footer'
import { config } from '@lib/landing/config'

export const Route = createFileRoute('/contact')({
  prerender: true,
  head: () => {
    const pageUrl = `${config.appUrl}/contact`
    const title = 'Contact Us - CoRATES'
    const description =
      'Get in touch with the CoRATES team. We would love to hear from you about questions, feedback, or partnership opportunities.'
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
  component: Contact,
})

function Contact() {
  const [formState, setFormState] = createSignal('idle')
  const [errorMessage, setErrorMessage] = createSignal('')

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setFormState('sending')
    setErrorMessage('')

    const formData = new FormData(e.target as HTMLFormElement)
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      subject: formData.get('subject'),
      message: formData.get('message'),
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Failed to send message')
      }

      setFormState('sent')
      ;(e.target as HTMLFormElement).reset()
    } catch (err) {
      console.error('Contact form error:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setFormState('error')
    }
  }

  return (
    <div class='min-h-screen bg-linear-to-b from-blue-50 to-white'>
      <Navbar />
      <main class='py-16 sm:py-24'>
        <div class='mx-auto max-w-6xl px-6'>
          <div class='mb-16 text-center'>
            <h1 class='mb-4 text-4xl font-bold text-gray-900 sm:text-5xl'>Get in Touch</h1>
            <p class='mx-auto max-w-2xl text-xl text-gray-600'>
              Have questions about CoRATES? We would love to hear from you. Send us a message and we
              will respond as soon as possible.
            </p>
          </div>

          <div class='grid gap-12 lg:grid-cols-2 lg:gap-16'>
            <div class='space-y-8'>
              <div>
                <h2 class='mb-6 text-2xl font-semibold text-gray-900'>We are here to help</h2>
                <p class='mb-8 text-gray-600'>
                  Whether you have questions about our platform, need technical support, want to
                  provide feedback, or discuss partnership opportunities, our team is ready to assist
                  you. If you would like early access to the platform, please fill out the form below
                  with 'Early Access Request' as the subject.
                </p>
              </div>
            </div>

            <div class='rounded-2xl border border-gray-100 bg-white p-8 shadow-lg'>
              <h2 class='mb-6 text-xl font-semibold text-gray-900'>Send us a message</h2>
              <form onSubmit={handleSubmit} class='space-y-6'>
                <div>
                  <label for='name' class='mb-2 block text-sm font-medium text-gray-700'>
                    Your Name
                  </label>
                  <div class='relative'>
                    <FiUser class='absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400' />
                    <input
                      type='text'
                      id='name'
                      name='name'
                      required
                      class='w-full rounded-lg border border-gray-200 py-3 pr-4 pl-10 transition-shadow focus:border-transparent focus:ring-2 focus:ring-blue-600 focus:outline-none'
                      placeholder='John Doe'
                    />
                  </div>
                </div>

                <div>
                  <label for='email' class='mb-2 block text-sm font-medium text-gray-700'>
                    Email Address
                  </label>
                  <div class='relative'>
                    <FiMail class='absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400' />
                    <input
                      type='email'
                      id='email'
                      name='email'
                      required
                      class='w-full rounded-lg border border-gray-200 py-3 pr-4 pl-10 transition-shadow focus:border-transparent focus:ring-2 focus:ring-blue-600 focus:outline-none'
                      placeholder='you@example.com'
                    />
                  </div>
                </div>

                <div>
                  <label for='subject' class='mb-2 block text-sm font-medium text-gray-700'>
                    Subject
                  </label>
                  <input
                    type='text'
                    id='subject'
                    name='subject'
                    class='w-full rounded-lg border border-gray-200 px-4 py-3 transition-shadow focus:border-transparent focus:ring-2 focus:ring-blue-600 focus:outline-none'
                    placeholder='What is this about?'
                  />
                </div>

                <div>
                  <label for='message' class='mb-2 block text-sm font-medium text-gray-700'>
                    Message
                  </label>
                  <textarea
                    id='message'
                    name='message'
                    required
                    rows={5}
                    class='w-full resize-none rounded-lg border border-gray-200 px-4 py-3 transition-shadow focus:border-transparent focus:ring-2 focus:ring-blue-600 focus:outline-none'
                    placeholder='Tell us how we can help...'
                  />
                </div>

                <button
                  type='submit'
                  disabled={formState() === 'sending'}
                  class='flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {formState() === 'sending' ? (
                    <>
                      <FiLoader class='h-5 w-5 animate-spin' />
                      Sending...
                    </>
                  ) : (
                    <>
                      <FiSend class='h-5 w-5' />
                      Send Message
                    </>
                  )}
                </button>

                {formState() === 'sent' && (
                  <p class='text-center text-sm text-green-600'>
                    Your message has been sent successfully. We will get back to you soon!
                  </p>
                )}

                {formState() === 'error' && (
                  <div class='flex items-center justify-center gap-2 text-sm text-red-600'>
                    <FiAlertCircle class='h-4 w-4' />
                    <p>{errorMessage()}</p>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
