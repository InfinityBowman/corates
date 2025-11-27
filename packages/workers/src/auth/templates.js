/**
 * HTML templates for authentication pages
 */

export function getEmailVerificationSuccessPage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verified - CoRATES</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 0;
          background: #eff6ff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          padding: 48px;
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          text-align: center;
          max-width: 400px;
          margin: 20px;
          border: 1px solid #f3f4f6;
        }
        .icon-container {
          width: 64px;
          height: 64px;
          background: #dcfce7;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px auto;
        }
        .icon-container svg {
          width: 32px;
          height: 32px;
          color: #22c55e;
        }
        h1 {
          color: #111827;
          margin: 0 0 12px 0;
          font-size: 24px;
          font-weight: 700;
        }
        p {
          color: #6b7280;
          margin: 0 0 32px 0;
          line-height: 1.6;
          font-size: 15px;
        }
        .close-button {
          background: #2563eb;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .close-button:hover {
          transform: scale(1.02);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1>Email Verified Successfully!</h1>
        <p>Your email address has been verified. You can now close this page and continue using CoRATES.</p>
        <button class="close-button" onclick="window.close()">Close This Page</button>
      </div>
      <script>
        // Auto-close after 5 seconds if window.close() doesn't work
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            // If can't close, show a message
            document.querySelector('.close-button').textContent = 'You can close this page manually';
          }
        }, 5000);
      </script>
    </body>
    </html>
  `;
}

export function getEmailVerificationFailurePage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification Failed - CoRATES</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 0;
          background: #eff6ff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          padding: 48px;
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          text-align: center;
          max-width: 400px;
          margin: 20px;
          border: 1px solid #f3f4f6;
        }
        .icon-container {
          width: 64px;
          height: 64px;
          background: #fee2e2;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px auto;
        }
        .icon-container svg {
          width: 32px;
          height: 32px;
          color: #dc2626;
        }
        h1 {
          color: #111827;
          margin: 0 0 12px 0;
          font-size: 24px;
          font-weight: 700;
        }
        p {
          color: #6b7280;
          margin: 0 0 24px 0;
          line-height: 1.6;
          font-size: 15px;
        }
        .retry-link {
          display: inline-block;
          background: #2563eb;
          color: white;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          transition: all 0.2s;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .retry-link:hover {
          transform: scale(1.02);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1>Email Verification Failed</h1>
        <p>The verification link is invalid or has expired. Please try requesting a new verification email.</p>
        <a href="/" class="retry-link">Return to CoRATES</a>
      </div>
    </body>
    </html>
  `;
}

export function getEmailVerificationErrorPage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification Error - CoRATES</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 0;
          background: #eff6ff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          padding: 48px;
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          text-align: center;
          max-width: 400px;
          margin: 20px;
          border: 1px solid #f3f4f6;
        }
        .icon-container {
          width: 64px;
          height: 64px;
          background: #fef3c7;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px auto;
        }
        .icon-container svg {
          width: 32px;
          height: 32px;
          color: #d97706;
        }
        h1 {
          color: #111827;
          margin: 0 0 12px 0;
          font-size: 24px;
          font-weight: 700;
        }
        p {
          color: #6b7280;
          margin: 0 0 24px 0;
          line-height: 1.6;
          font-size: 15px;
        }
        .retry-link {
          display: inline-block;
          background: #2563eb;
          color: white;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          transition: all 0.2s;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .retry-link:hover {
          transform: scale(1.02);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1>Something Went Wrong</h1>
        <p>An error occurred while verifying your email. Please try again or contact support if the problem persists.</p>
        <a href="/" class="retry-link">Return to CoRATES</a>
      </div>
    </body>
    </html>
  `;
}
