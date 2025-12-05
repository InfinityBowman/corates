// Email HTML and text templates for BetterAuth

export function getVerificationEmailHtml({ name, subject, verificationUrl }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #eff6ff;">
      <div style="background: #2563eb; color: white; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Welcome to CoRATES!</h1>
      </div>
      <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 18px; margin-bottom: 20px; color: #1f2937;">Hi ${name},</p>
        <p style="color: #4b5563;">Thank you for signing up for CoRATES! To complete your registration and verify your email address, please click the button below:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationUrl}" style="background: #2563eb; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Verify Email Address</a>
        </div>
        <p style="color: #4b5563;">If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6b7280; background: #f3f4f6; padding: 12px; border-radius: 8px; font-size: 14px;">${verificationUrl}</p>
        <p style="color: #4b5563;">This verification link will expire in 24 hours for security reasons.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        <p style="color: #6b7280; font-size: 14px;">If you didn't create an account with CoRATES, you can safely ignore this email.</p>
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The CoRATES Team</p>
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
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #eff6ff;">
      <div style="background: #2563eb; color: white; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Password Reset Request</h1>
      </div>
      <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 18px; margin-bottom: 20px; color: #1f2937;">Hi ${name},</p>
        <p style="color: #4b5563;">We received a request to reset your password for your CoRATES account. If you made this request, click the button below to reset your password:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Reset Password</a>
        </div>
        <p style="color: #4b5563;">If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6b7280; background: #f3f4f6; padding: 12px; border-radius: 8px; font-size: 14px;">${resetUrl}</p>
        <p style="color: #4b5563;">This password reset link will expire in 1 hour for security reasons.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        <p style="color: #6b7280; font-size: 14px;"><strong style="color: #374151;">Important:</strong> If you didn't request a password reset, please ignore this email and consider changing your password if you suspect unauthorized access to your account.</p>
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The CoRATES Team</p>
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

export function getMagicLinkEmailHtml({ subject, magicLinkUrl }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #eff6ff;">
      <div style="background: #2563eb; color: white; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Sign in to CoRATES</h1>
      </div>
      <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 18px; margin-bottom: 20px; color: #1f2937;">Hi there,</p>
        <p style="color: #4b5563;">Click the button below to sign in to your CoRATES account. No password needed!</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${magicLinkUrl}" style="background: #2563eb; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Sign In to CoRATES</a>
        </div>
        <p style="color: #4b5563;">If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6b7280; background: #f3f4f6; padding: 12px; border-radius: 8px; font-size: 14px;">${magicLinkUrl}</p>
        <p style="color: #4b5563;">This link will expire in 10 minutes for security reasons.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        <p style="color: #6b7280; font-size: 14px;">If you didn't request this sign-in link, you can safely ignore this email.</p>
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The CoRATES Team</p>
      </div>
    </body>
    </html>
  `;
}

export function getMagicLinkEmailText({ magicLinkUrl }) {
  return `
    Hi there,

    Click the link below to sign in to your CoRATES account. No password needed!

    ${magicLinkUrl}

    This link will expire in 10 minutes for security reasons.

    If you didn't request this sign-in link, you can safely ignore this email.

    Best regards,
    The CoRATES Team
  `;
}
