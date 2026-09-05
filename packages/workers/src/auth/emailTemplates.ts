// Email HTML and text templates for BetterAuth

import { escapeHtml } from '@corates/shared/html';

interface AccountMergeEmailParams {
  code: string;
  expiryMinutes?: number;
}

interface ProjectInvitationEmailParams {
  projectName: string;
  inviterName: string;
  invitationUrl: string;
  role: string;
  expiryDays?: number;
}

interface ProjectMemberAddedEmailParams {
  projectName: string;
  inviterName: string;
  projectUrl: string;
  role: string;
}

interface EmailShellParams {
  title: string;
  /** Inbox preview line. Must already be HTML-escaped if it carries user data. */
  preheader: string;
  heading: string;
  bodyHtml: string;
  /** Completes the sentence "You received this email because ...". */
  footerReason: string;
}

const SUPPORT_EMAIL = 'support@corates.org';

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

// Padding after the preheader keeps the first body line out of the inbox
// preview. Written as entities so the source stays ASCII.
const PREHEADER_SPACER = '&nbsp;'.repeat(60);

const PARAGRAPH_STYLE = `margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;`;

const LEAD_STYLE = `margin: 0 0 16px; font-size: 18px; line-height: 1.5; color: #1f2937;`;

const NOTE_STYLE = `margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;`;

const DIVIDER = `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;">`;

/**
 * Shared table wrapper. Tables plus inline styles are used instead of modern
 * layout because Outlook renders through Word, which supports neither flexbox
 * nor grid nor external stylesheets.
 */
function renderShell({
  title,
  preheader,
  heading,
  bodyHtml,
  footerReason,
}: EmailShellParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #eff6ff; font-family: ${FONT_STACK}; color: #374151;">
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #eff6ff;">${preheader}${PREHEADER_SPACER}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #eff6ff;">
    <tr>
      <td align="center" style="padding: 24px 12px 32px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <tr>
            <td align="center" style="background-color: #2563eb; padding: 28px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 24px; line-height: 1.3; font-weight: 700; color: #ffffff;">${heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 8px 0;">
              <p style="margin: 0 0 6px; color: #4b5563; font-size: 12px; line-height: 1.6;">You received this email because ${footerReason}</p>
              <p style="margin: 0; color: #4b5563; font-size: 12px; line-height: 1.6;">CoRATES is operated by Syntch LLC. Questions? Email <a href="mailto:${SUPPORT_EMAIL}" style="color: #1d4ed8; text-decoration: underline;">${SUPPORT_EMAIL}</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * The one primary action per email. The background sits on the cell as well as
 * the anchor so it still reads as a button where anchor padding is dropped.
 */
function renderButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px auto;">
                <tr>
                  <td align="center" bgcolor="#2563eb" style="background-color: #2563eb; border-radius: 12px;">
                    <a href="${url}" style="display: inline-block; padding: 16px 32px; font-family: ${FONT_STACK}; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 12px;">${label}</a>
                  </td>
                </tr>
              </table>`;
}

/** Plain-URL fallback for clients that strip or fail to render the button. */
function renderFallbackLink(url: string): string {
  return `<p style="margin: 0 0 8px; color: #4b5563; font-size: 14px; line-height: 1.6;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="margin: 0 0 20px; padding: 12px; background-color: #f3f4f6; border-radius: 8px; font-size: 13px; line-height: 1.5; word-break: break-all;"><a href="${url}" style="color: #1d4ed8; text-decoration: underline;">${url}</a></p>`;
}

function renderTextFooter(footerReason: string): string {
  return `You received this email because ${footerReason}
CoRATES is operated by Syntch LLC. Questions? Email ${SUPPORT_EMAIL}`;
}

export const AUTH_CODE_EXPIRY_MINUTES = 10;

export type AuthCodePurpose = 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

interface AuthCodeEmailParams {
  purpose: AuthCodePurpose;
  code: string;
  expiryMinutes?: number;
}

const AUTH_CODE_COPY: Record<
  AuthCodePurpose,
  { subject: string; heading: string; intro: string; footerReason: string; ignore: string }
> = {
  'sign-in': {
    subject: 'Your CoRATES sign-in code',
    heading: 'Your sign-in code',
    intro: 'Enter this code on the CoRATES sign-in page to continue.',
    footerReason: 'someone requested a sign-in code for this address on corates.org.',
    ignore: 'If you did not request this code, you can ignore this email.',
  },
  'email-verification': {
    subject: 'Confirm your CoRATES email',
    heading: 'Confirm your email address',
    intro: 'Enter this code in CoRATES to confirm this email address belongs to you.',
    footerReason: 'this address was used to sign up for CoRATES.',
    ignore: 'If you did not sign up for CoRATES, you can ignore this email.',
  },
  'forget-password': {
    subject: 'Your CoRATES password reset code',
    heading: 'Reset your password',
    intro:
      'Enter this code in CoRATES to choose a new password for the account tied to this address.',
    footerReason: 'a password reset was requested for the CoRATES account using this address.',
    ignore:
      'Did not request this? Ignore this email and your password stays as it is. If you think someone else has access to your account, change your password once you are signed in.',
  },
  'change-email': {
    subject: 'Confirm your CoRATES email',
    heading: 'Confirm your email address',
    intro: 'Enter this code in CoRATES to use this email address for your account.',
    footerReason: 'someone asked to use this address for a CoRATES account.',
    ignore: 'If you did not request this, you can ignore this email and nothing will change.',
  },
};

function renderCodeBox(code: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f3f4f6; padding: 24px; border-radius: 12px;">
                    <span style="font-family: Consolas, Menlo, Monaco, monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1e40af;">${escapeHtml(code)}</span>
                  </td>
                </tr>
              </table>`;
}

export function getAuthCodeEmail({
  purpose,
  code,
  expiryMinutes = AUTH_CODE_EXPIRY_MINUTES,
}: AuthCodeEmailParams): { subject: string; html: string; text: string } {
  const copy = AUTH_CODE_COPY[purpose];
  const html = renderShell({
    title: copy.subject,
    // The code stays out of the preview line so it is not exposed on a locked phone screen
    preheader: `Your verification code is inside. It expires in ${expiryMinutes} minutes.`,
    heading: copy.heading,
    footerReason: copy.footerReason,
    bodyHtml: `<p style="${LEAD_STYLE}">Hi there,</p>
              <p style="${PARAGRAPH_STYLE}">${copy.intro}</p>
              ${renderCodeBox(code)}
              <p style="${PARAGRAPH_STYLE}">The code expires in ${expiryMinutes} minutes. Never share it with anyone.</p>
              ${DIVIDER}
              <p style="${NOTE_STYLE}">${copy.ignore}</p>`,
  });
  const text = `Hi there,

${copy.intro}

Your code: ${code}

The code expires in ${expiryMinutes} minutes. Never share it with anyone.

${copy.ignore}

${renderTextFooter(copy.footerReason)}`;
  return { subject: copy.subject, html, text };
}

export function getAccountMergeEmailHtml({
  code,
  expiryMinutes = 15,
}: AccountMergeEmailParams): string {
  return renderShell({
    title: 'Account Merge Verification Code',
    // The code is deliberately kept out of the preview line so it is not
    // exposed on a locked phone screen.
    preheader: `Your verification code is inside. It expires in ${expiryMinutes} minutes.`,
    heading: 'Confirm your account merge',
    footerReason: 'an account merge was requested for the CoRATES account using this address.',
    bodyHtml: `<p style="${LEAD_STYLE}">Hi there,</p>
              <p style="${PARAGRAPH_STYLE}">A request was made to merge your CoRATES account with another account. If that was you, enter this verification code to confirm:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f3f4f6; padding: 24px; border-radius: 12px;">
                    <span style="font-family: Consolas, Menlo, Monaco, monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1e40af;">${escapeHtml(code)}</span>
                  </td>
                </tr>
              </table>
              <p style="${PARAGRAPH_STYLE}">The code expires in ${expiryMinutes} minutes.</p>
              ${DIVIDER}
              <p style="${NOTE_STYLE}"><strong style="color: #374151;">Did not request this?</strong> Ignore this email and do not share the code. Your account will not be changed.</p>`,
  });
}

export function getAccountMergeEmailText({
  code,
  expiryMinutes = 15,
}: AccountMergeEmailParams): string {
  return `Hi there,

A request was made to merge your CoRATES account with another account.

If that was you, enter this verification code to confirm: ${code}

The code expires in ${expiryMinutes} minutes.

Did not request this? Ignore this email and do not share the code. Your account will not be changed.

${renderTextFooter('an account merge was requested for the CoRATES account using this address.')}`;
}

export function getProjectInvitationEmailHtml({
  projectName,
  inviterName,
  invitationUrl,
  role,
  expiryDays = 7,
}: ProjectInvitationEmailParams): string {
  const roleText = role === 'owner' ? 'Owner' : 'Member';
  const safeInviter = escapeHtml(inviterName);
  const safeProject = escapeHtml(projectName);

  return renderShell({
    title: 'Project Invitation - CoRATES',
    preheader: `${safeInviter} invited you to collaborate on "${safeProject}" in CoRATES. The invitation expires in ${expiryDays} days.`,
    heading: 'You are invited to a CoRATES project',
    footerReason: `${safeInviter} entered this address when inviting collaborators to a CoRATES project.`,
    bodyHtml: `<p style="${LEAD_STYLE}">Hi there,</p>
              <p style="${PARAGRAPH_STYLE}"><strong style="color: #1f2937;">${safeInviter}</strong> invited you to join the project <strong style="color: #1f2937;">"${safeProject}"</strong> as a <strong style="color: #1f2937;">${escapeHtml(roleText)}</strong> on CoRATES, the web app research teams use to appraise study quality and risk of bias for systematic reviews and evidence synthesis.</p>
              <p style="${PARAGRAPH_STYLE}">Accept the invitation to open the project. You can sign in with an existing CoRATES account or create one in the same step.</p>
              ${renderButton(invitationUrl, 'Accept invitation')}
              ${renderFallbackLink(invitationUrl)}
              <p style="${PARAGRAPH_STYLE}">The invitation expires in ${expiryDays} days.</p>
              ${DIVIDER}
              <p style="${NOTE_STYLE}">If you were not expecting this invitation, you can ignore this email. Nothing is shared with you until you accept.</p>`,
  });
}

export function getProjectInvitationEmailText({
  projectName,
  inviterName,
  invitationUrl,
  role,
  expiryDays = 7,
}: ProjectInvitationEmailParams): string {
  const roleText = role === 'owner' ? 'Owner' : 'Member';

  return `Hi there,

${inviterName} invited you to join the project "${projectName}" as a ${roleText} on CoRATES, the web app research teams use to appraise study quality and risk of bias for systematic reviews and evidence synthesis.

Accept the invitation to open the project. You can sign in with an existing CoRATES account or create one in the same step.

Accept the invitation:
${invitationUrl}

The invitation expires in ${expiryDays} days.

If you were not expecting this invitation, you can ignore this email. Nothing is shared with you until you accept.

${renderTextFooter(`${inviterName} entered this address when inviting collaborators to a CoRATES project.`)}`;
}

export function getProjectMemberAddedEmailHtml({
  projectName,
  inviterName,
  projectUrl,
  role,
}: ProjectMemberAddedEmailParams): string {
  const roleText = role === 'owner' ? 'Owner' : 'Member';
  const safeInviter = escapeHtml(inviterName);
  const safeProject = escapeHtml(projectName);

  return renderShell({
    title: 'Added to Project - CoRATES',
    preheader: `${safeInviter} added you to "${safeProject}" as a ${escapeHtml(roleText)}. You have access now.`,
    heading: 'You have been added to a project',
    footerReason: 'you were added to a project in your CoRATES account.',
    bodyHtml: `<p style="${LEAD_STYLE}">Hi there,</p>
              <p style="${PARAGRAPH_STYLE}"><strong style="color: #1f2937;">${safeInviter}</strong> added you to the project <strong style="color: #1f2937;">"${safeProject}"</strong> as a <strong style="color: #1f2937;">${escapeHtml(roleText)}</strong>. There is nothing to accept, the project is already in your CoRATES dashboard.</p>
              ${renderButton(projectUrl, 'Open project')}
              ${renderFallbackLink(projectUrl)}`,
  });
}

export function getProjectMemberAddedEmailText({
  projectName,
  inviterName,
  projectUrl,
  role,
}: ProjectMemberAddedEmailParams): string {
  const roleText = role === 'owner' ? 'Owner' : 'Member';

  return `Hi there,

${inviterName} added you to the project "${projectName}" as a ${roleText}. There is nothing to accept, the project is already in your CoRATES dashboard.

Open the project:
${projectUrl}

${renderTextFooter('you were added to a project in your CoRATES account.')}`;
}
