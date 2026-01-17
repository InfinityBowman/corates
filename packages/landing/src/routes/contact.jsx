import { Title, Meta, Link } from '@solidjs/meta';
import { createSignal } from 'solid-js';
import { FiMail, FiSend, FiUser, FiMessageSquare, FiLoader, FiAlertCircle } from 'solid-icons/fi';
import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';
import { config } from '~/lib/config';

export default function Contact() {
  const pageUrl = `${config.appUrl}/contact`;
  const title = 'Contact Us - CoRATES';
  const description =
    'Get in touch with the CoRATES team. We would love to hear from you about questions, feedback, or partnership opportunities.';

  const [formState, setFormState] = createSignal('idle'); // idle, sending, sent, error
  const [errorMessage, setErrorMessage] = createSignal('');

  const handleSubmit = async e => {
    e.preventDefault();
    setFormState('sending');
    setErrorMessage('');

    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      subject: formData.get('subject'),
      message: formData.get('message'),
    };

    try {
      const response = await fetch(`${config.apiUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to send message');
      }

      setFormState('sent');
      e.target.reset();
    } catch (err) {
      console.error('Contact form error:', err);
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
      setFormState('error');
    }
  };

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
      <div class='min-h-screen bg-linear-to-b from-blue-50 to-white'>
        <Navbar />
        <main class='flex-1 py-12'>
          <div class='mx-auto max-w-6xl px-6'>
            {/* Hero Section */}
            <div class='mb-16 text-center'>
              <h1 class='mb-4 text-4xl font-bold text-gray-900 sm:text-5xl'>Get in Touch</h1>
              <p class='mx-auto max-w-2xl text-xl text-gray-600'>
                Have questions about CoRATES? We would love to hear from you. Send us a message and
                we will respond as soon as possible.
              </p>
            </div>

            <div class='grid gap-12 lg:grid-cols-2 lg:gap-16'>
              {/* Contact Information */}
              <div class='space-y-8'>
                <div>
                  <h2 class='mb-6 text-2xl font-semibold text-gray-900'>We are here to help</h2>
                  <p class='mb-8 text-gray-600'>
                    Whether you have questions about our platform, need technical support, want to
                    provide feedback, or discuss partnership opportunities, our team is ready to
                    assist you. If you would like early access to the platform, please fill out the
                    form below with 'Early Access Request' as the subject.
                  </p>
                </div>

                <div class='space-y-6'>
                  <div class='flex items-start gap-4'>
                    <div class='flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
                      <FiMail class='h-6 w-6 text-blue-600' />
                    </div>
                    <div>
                      <h3 class='mb-1 font-semibold text-gray-900'>Send Us a Message</h3>
                      <p class='mt-1 text-gray-500'>We try to respond within 24 hours</p>
                    </div>
                  </div>

                  <div class='flex items-start gap-4'>
                    <div class='flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
                      <FiMessageSquare class='h-6 w-6 text-blue-600' />
                    </div>
                    <div>
                      <h3 class='mb-1 font-semibold text-gray-900'>Feedback Welcome</h3>
                      <p class='text-gray-500'>
                        Your feedback helps us improve CoRATES for everyone.
                      </p>
                    </div>
                  </div>
                </div>

                {/* TODO FAQ */}
              </div>

              {/* Contact Form */}
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
                      rows='5'
                      class='w-full resize-none rounded-lg border border-gray-200 px-4 py-3 transition-shadow focus:border-transparent focus:ring-2 focus:ring-blue-600 focus:outline-none'
                      placeholder='Tell us how we can help...'
                    />
                  </div>

                  <button
                    type='submit'
                    disabled={formState() === 'sending'}
                    class='flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    {formState() === 'sending' ?
                      <>
                        <FiLoader class='h-5 w-5 animate-spin' />
                        Sending...
                      </>
                    : <>
                        <FiSend class='h-5 w-5' />
                        Send Message
                      </>
                    }
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
    </>
  );
}
