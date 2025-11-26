/**
 * Test email route handler (development only)
 */

import { createEmailService } from '../auth/email.js';
import { jsonResponse, errorResponse } from '../middleware/cors.js';

/**
 * Handle test email endpoint
 * POST /api/test-email
 */
export async function handleTestEmail(request, env) {
  try {
    const { email, type } = await request.json();

    if (!email) {
      return errorResponse('Email address required', 400, request);
    }

    const emailService = createEmailService(env);
    let result;

    switch (type) {
      case 'verification':
        result = await emailService.sendEmailVerification(
          email,
          'http://localhost:5173/auth/verify-email?token=test-token-12345',
          'Test User',
        );
        break;
      case 'password-reset':
        result = await emailService.sendPasswordReset(
          email,
          'http://localhost:5173/auth/reset-password?token=test-token-12345',
          'Test User',
        );
        break;
      default:
        result = await emailService.sendEmail({
          to: email,
          subject: 'Test Email from CoRATES',
          html: '<h1>Test Email Success!</h1><p>This is a test email from your CoRATES application. If you received this, your email configuration is working correctly!</p>',
          text: 'Test Email Success!\n\nThis is a test email from your CoRATES application. If you received this, your email configuration is working correctly!',
        });
    }

    return jsonResponse(
      {
        success: true,
        result,
        message: `Test email sent to ${email}`,
        environment: env.ENVIRONMENT,
        realEmailSending: env.SEND_EMAILS_IN_DEV === 'true' || env.ENVIRONMENT === 'production',
      },
      {},
      request,
    );
  } catch (error) {
    console.error('Test email error:', error);
    return errorResponse('Failed to send test email: ' + error.message, 500, request);
  }
}
