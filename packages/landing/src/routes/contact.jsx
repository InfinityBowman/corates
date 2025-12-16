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
        <main class='py-16 sm:py-24'>
          <div class='max-w-6xl mx-auto px-6'>
            {/* Hero Section */}
            <div class='text-center mb-16'>
              <h1 class='text-4xl sm:text-5xl font-bold text-gray-900 mb-4'>Get in Touch</h1>
              <p class='text-xl text-gray-600 max-w-2xl mx-auto'>
                Have questions about CoRATES? We would love to hear from you. Send us a message and
                we will respond as soon as possible.
              </p>
            </div>

            <div class='grid lg:grid-cols-2 gap-12 lg:gap-16'>
              {/* Contact Information */}
              <div class='space-y-8'>
                <div>
                  <h2 class='text-2xl font-semibold text-gray-900 mb-6'>We are here to help</h2>
                  <p class='text-gray-600 mb-8'>
                    Whether you have questions about our platform, need technical support, or want
                    to discuss partnership opportunities, our team is ready to assist you.
                  </p>
                </div>

                <div class='space-y-6'>
                  <div class='flex items-start gap-4'>
                    <div class='shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center'>
                      <FiMail class='w-6 h-6 text-blue-600' />
                    </div>
                    <div>
                      <h3 class='font-semibold text-gray-900 mb-1'>Send Us a Message</h3>
                      <p class='text-gray-500 mt-1'>We try to respond within 24 hours</p>
                    </div>
                  </div>

                  <div class='flex items-start gap-4'>
                    <div class='shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center'>
                      <FiMessageSquare class='w-6 h-6 text-blue-600' />
                    </div>
                    <div>
                      <h3 class='font-semibold text-gray-900 mb-1'>Feedback Welcome</h3>
                      <p class='text-gray-500'>
                        Your feedback helps us improve CoRATES for everyone.
                      </p>
                    </div>
                  </div>
                </div>

                {/* TODO FAQ */}
              </div>

              {/* Contact Form */}
              <div class='bg-white rounded-2xl shadow-lg border border-gray-100 p-8'>
                <h2 class='text-xl font-semibold text-gray-900 mb-6'>Send us a message</h2>
                <form onSubmit={handleSubmit} class='space-y-6'>
                  <div>
                    <label for='name' class='block text-sm font-medium text-gray-700 mb-2'>
                      Your Name
                    </label>
                    <div class='relative'>
                      <FiUser class='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                      <input
                        type='text'
                        id='name'
                        name='name'
                        required
                        class='w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-shadow'
                        placeholder='John Doe'
                      />
                    </div>
                  </div>

                  <div>
                    <label for='email' class='block text-sm font-medium text-gray-700 mb-2'>
                      Email Address
                    </label>
                    <div class='relative'>
                      <FiMail class='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                      <input
                        type='email'
                        id='email'
                        name='email'
                        required
                        class='w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-shadow'
                        placeholder='you@example.com'
                      />
                    </div>
                  </div>

                  <div>
                    <label for='subject' class='block text-sm font-medium text-gray-700 mb-2'>
                      Subject
                    </label>
                    <input
                      type='text'
                      id='subject'
                      name='subject'
                      class='w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-shadow'
                      placeholder='What is this about?'
                    />
                  </div>

                  <div>
                    <label for='message' class='block text-sm font-medium text-gray-700 mb-2'>
                      Message
                    </label>
                    <textarea
                      id='message'
                      name='message'
                      required
                      rows='5'
                      class='w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-shadow resize-none'
                      placeholder='Tell us how we can help...'
                    />
                  </div>

                  <button
                    type='submit'
                    disabled={formState() === 'sending'}
                    class='w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {formState() === 'sending' ?
                      <>
                        <FiLoader class='w-5 h-5 animate-spin' />
                        Sending...
                      </>
                    : <>
                        <FiSend class='w-5 h-5' />
                        Send Message
                      </>
                    }
                  </button>

                  {formState() === 'sent' && (
                    <p class='text-center text-green-600 text-sm'>
                      Your message has been sent successfully. We will get back to you soon!
                    </p>
                  )}

                  {formState() === 'error' && (
                    <div class='flex items-center justify-center gap-2 text-red-600 text-sm'>
                      <FiAlertCircle class='w-4 h-4' />
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
