import { createSignal, onMount } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { authClient } from '@api/auth-client.js';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = createSignal('verifying');
  const [message, setMessage] = createSignal('');
  const navigate = useNavigate();

  onMount(async () => {
    const token = searchParams.token;
    if (!token) {
      setStatus('error');
      setMessage('No verification token found.');
      return;
    }

    try {
      // Better Auth handles verification via GET request to the endpoint
      // We need to make a request to the verification endpoint directly
      const response = await fetch(
        `${authClient.options.baseURL}/api/auth/verify-email?token=${token}`,
        {
          method: 'GET',
          credentials: 'include', // Important: include cookies for session
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.ok) {
        // Check if we got a session by calling getSession
        const session = await authClient.getSession();

        if (session.data?.user) {
          setStatus('success');
          setMessage('Email verified successfully! Redirecting...');
          setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
        } else {
          // Verification successful but not automatically signed in
          setStatus('success');
          setMessage('Email verified! Please sign in.');
          setTimeout(() => navigate('/signin', { replace: true }), 2000);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Verification failed' }));
        setStatus('error');
        setMessage(errorData.error || 'Verification failed.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setStatus('error');
      setMessage('Verification failed. Please try again.');
    }
  });

  return (
    <div class='min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100'>
      <div class='bg-white rounded-xl shadow-xl p-8 text-center max-w-md'>
        <h2 class='text-xl font-bold mb-4'>Verify Email</h2>
        {status() === 'verifying' && (
          <div>
            <div class='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4'></div>
            <p>Verifying your email...</p>
          </div>
        )}
        {status() === 'success' && <p class='text-green-600'>{message()}</p>}
        {status() === 'error' && (
          <div>
            <p class='text-red-600 mb-4'>{message()}</p>
            <button
              onClick={() => navigate('/signin')}
              class='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
            >
              Go to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
