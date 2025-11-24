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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
          margin: 20px;
        }
        .success-icon {
          font-size: 48px;
          color: #10B981;
          margin-bottom: 20px;
        }
        h1 {
          color: #1F2937;
          margin: 0 0 16px 0;
          font-size: 24px;
          font-weight: 600;
        }
        p {
          color: #6B7280;
          margin: 0 0 24px 0;
          line-height: 1.5;
        }
        .close-button {
          background: #667eea;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .close-button:hover {
          background: #5a67d8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="success-icon">✅</div>
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
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
          margin: 20px;
        }
        .error-icon {
          font-size: 48px;
          color: #EF4444;
          margin-bottom: 20px;
        }
        h1 {
          color: #1F2937;
          margin: 0 0 16px 0;
          font-size: 24px;
          font-weight: 600;
        }
        p {
          color: #6B7280;
          margin: 0 0 24px 0;
          line-height: 1.5;
        }
        .retry-link {
          color: #667eea;
          text-decoration: none;
          font-weight: 500;
        }
        .retry-link:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-icon">❌</div>
        <h1>Email Verification Failed</h1>
        <p>The verification link is invalid or has expired. Please try requesting a new verification email.</p>
        <p><a href="/" class="retry-link">Return to CoRATES</a></p>
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
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
          margin: 20px;
        }
        .error-icon {
          font-size: 48px;
          color: #EF4444;
          margin-bottom: 20px;
        }
        h1 {
          color: #1F2937;
          margin: 0 0 16px 0;
          font-size: 24px;
          font-weight: 600;
        }
        p {
          color: #6B7280;
          margin: 0 0 24px 0;
          line-height: 1.5;
        }
        .retry-link {
          color: #667eea;
          text-decoration: none;
          font-weight: 500;
        }
        .retry-link:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-icon">⚠️</div>
        <h1>Something Went Wrong</h1>
        <p>An error occurred while verifying your email. Please try again or contact support if the problem persists.</p>
        <p><a href="/" class="retry-link">Return to CoRATES</a></p>
      </div>
    </body>
    </html>
  `;
}
