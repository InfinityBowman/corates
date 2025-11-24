// Email HTML and text templates for BetterAuth

export function getVerificationEmailHtml({ name, subject, verificationUrl }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">Welcome to CoRATES!</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 18px; margin-bottom: 20px;">Hi ${name},</p>
        <p>Thank you for signing up for CoRATES! To complete your registration and verify your email address, please click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666; background: #e9e9e9; padding: 10px; border-radius: 5px;">${verificationUrl}</p>
        <p>This verification link will expire in 24 hours for security reasons.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">If you didn't create an account with CoRATES, you can safely ignore this email.</p>
        <p style="color: #666; font-size: 14px;">Best regards,<br>The CoRATES Team</p>
      </div>
    </body>
    </html>
  `;
}

export function getVerificationEmailText({ name, verificationUrl }) {
  return `
    Hi ${name},

    Thank you for signing up for CoRATES! To complete your registration and verify your email address, please visit this link:

    ${verificationUrl}

    This verification link will expire in 24 hours for security reasons.

    If you didn't create an account with CoRATES, you can safely ignore this email.

    Best regards,
    The CoRATES Team
  `;
}

export function getPasswordResetEmailHtml({ name, subject, resetUrl }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">Password Reset Request</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 18px; margin-bottom: 20px;">Hi ${name},</p>
        <p>We received a request to reset your password for your CoRATES account. If you made this request, click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #f5576c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666; background: #e9e9e9; padding: 10px; border-radius: 5px;">${resetUrl}</p>
        <p>This password reset link will expire in 1 hour for security reasons.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #666; font-size: 14px;"><strong>Important:</strong> If you didn't request a password reset, please ignore this email and consider changing your password if you suspect unauthorized access to your account.</p>
        <p style="color: #666; font-size: 14px;">Best regards,<br>The CoRATES Team</p>
      </div>
    </body>
    </html>
  `;
}

export function getPasswordResetEmailText({ name, resetUrl }) {
  return `
    Hi ${name},

    We received a request to reset your password for your CoRATES account. If you made this request, visit this link to reset your password:

    ${resetUrl}

    This password reset link will expire in 1 hour for security reasons.

    If you didn't request a password reset, please ignore this email and consider changing your password if you suspect unauthorized access to your account.

    Best regards,
    The CoRATES Team
  `;
}
