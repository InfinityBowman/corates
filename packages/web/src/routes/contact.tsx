import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  MailIcon,
  SendIcon,
  UserIcon,
  MessageSquareIcon,
  LoaderIcon,
  AlertCircleIcon,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { config } from '../lib/config';
import { submitContactForm } from '@/server/functions/contact.functions';

const pageUrl = `${config.appUrl}/contact`;
const title = 'Contact Us - CoRATES';
const description =
  'Get in touch with the CoRATES team. We would love to hear from you about questions, feedback, or partnership opportunities.';

export const Route = createFileRoute('/contact')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  }),
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: pageUrl },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    links: [{ rel: 'canonical', href: pageUrl }],
  }),
  component: ContactPage,
});

type FormState = 'idle' | 'sending' | 'sent' | 'error';

function ContactPage() {
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormState('sending');
    setErrorMessage('');

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      subject: formData.get('subject'),
      message: formData.get('message'),
    };

    try {
      await submitContactForm({
        data: {
          name: data.name as string,
          email: data.email as string,
          subject: (data.subject as string) || undefined,
          message: data.message as string,
        },
      });

      setFormState('sent');
      e.currentTarget.reset();
    } catch (err) {
      console.error('Contact form error:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
      setFormState('error');
    }
  };

  return (
    <div className='min-h-screen bg-linear-to-b from-blue-50 to-white'>
      <Navbar />
      <main className='flex-1 py-12'>
        <div className='mx-auto max-w-6xl px-6'>
          <div className='mb-16 text-center'>
            <h1 className='mb-4 text-4xl font-bold text-gray-900 sm:text-5xl'>Get in Touch</h1>
            <p className='mx-auto max-w-2xl text-xl text-gray-600'>
              Have questions about CoRATES? We would love to hear from you. Send us a message and we
              will respond as soon as possible.
            </p>
          </div>

          <div className='grid gap-12 lg:grid-cols-2 lg:gap-16'>
            <div className='flex flex-col gap-8'>
              <div>
                <h2 className='mb-6 text-2xl font-semibold text-gray-900'>We are here to help</h2>
                <p className='mb-8 text-gray-600'>
                  Whether you have questions about our platform, need technical support, want to
                  provide feedback, or discuss partnership opportunities, our team is ready to
                  assist you. If you would like early access to the platform, please fill out the
                  form below with 'Early Access Request' as the subject.
                </p>
              </div>

              <div className='flex flex-col gap-6'>
                <div className='flex items-start gap-4'>
                  <div className='flex size-12 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
                    <MailIcon className='size-6 text-blue-600' />
                  </div>
                  <div>
                    <h3 className='mb-1 font-semibold text-gray-900'>Send Us a Message</h3>
                    <p className='mt-1 text-gray-500'>We try to respond within 24 hours</p>
                  </div>
                </div>

                <div className='flex items-start gap-4'>
                  <div className='flex size-12 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
                    <MessageSquareIcon className='size-6 text-blue-600' />
                  </div>
                  <div>
                    <h3 className='mb-1 font-semibold text-gray-900'>Feedback Welcome</h3>
                    <p className='text-gray-500'>
                      Your feedback helps us improve CoRATES for everyone.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className='rounded-2xl border border-gray-100 bg-white p-8 shadow-lg'>
              <h2 className='mb-6 text-xl font-semibold text-gray-900'>Send us a message</h2>
              <form onSubmit={handleSubmit} className='flex flex-col gap-6'>
                <div>
                  <label htmlFor='name' className='mb-2 block text-sm font-medium text-gray-700'>
                    Your Name
                  </label>
                  <div className='relative'>
                    <UserIcon className='absolute top-1/2 left-3 size-5 -translate-y-1/2 text-gray-400' />
                    <input
                      type='text'
                      id='name'
                      name='name'
                      required
                      className='w-full rounded-lg border border-gray-200 py-3 pr-4 pl-10 transition-shadow focus:border-transparent focus:ring-2 focus:ring-blue-600 focus:outline-none'
                      placeholder='John Doe'
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor='email' className='mb-2 block text-sm font-medium text-gray-700'>
                    Email Address
                  </label>
                  <div className='relative'>
                    <MailIcon className='absolute top-1/2 left-3 size-5 -translate-y-1/2 text-gray-400' />
                    <input
                      type='email'
                      id='email'
                      name='email'
                      required
                      className='w-full rounded-lg border border-gray-200 py-3 pr-4 pl-10 transition-shadow focus:border-transparent focus:ring-2 focus:ring-blue-600 focus:outline-none'
                      placeholder='you@example.com'
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor='subject' className='mb-2 block text-sm font-medium text-gray-700'>
                    Subject
                  </label>
                  <input
                    type='text'
                    id='subject'
                    name='subject'
                    className='w-full rounded-lg border border-gray-200 px-4 py-3 transition-shadow focus:border-transparent focus:ring-2 focus:ring-blue-600 focus:outline-none'
                    placeholder='What is this about?'
                  />
                </div>

                <div>
                  <label htmlFor='message' className='mb-2 block text-sm font-medium text-gray-700'>
                    Message
                  </label>
                  <textarea
                    id='message'
                    name='message'
                    required
                    rows={5}
                    className='w-full resize-none rounded-lg border border-gray-200 px-4 py-3 transition-shadow focus:border-transparent focus:ring-2 focus:ring-blue-600 focus:outline-none'
                    placeholder='Tell us how we can help...'
                  />
                </div>

                <button
                  type='submit'
                  disabled={formState === 'sending'}
                  className='flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {formState === 'sending' ?
                    <>
                      <LoaderIcon className='size-5 animate-spin' />
                      Sending...
                    </>
                  : <>
                      <SendIcon className='size-5' />
                      Send Message
                    </>
                  }
                </button>

                {formState === 'sent' && (
                  <p className='text-center text-sm text-green-600'>
                    Your message has been sent successfully. We will get back to you soon!
                  </p>
                )}

                {formState === 'error' && (
                  <div className='flex items-center justify-center gap-2 text-sm text-red-600'>
                    <AlertCircleIcon className='size-4' />
                    <p>{errorMessage}</p>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
