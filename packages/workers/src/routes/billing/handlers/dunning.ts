/**
 * Dunning email handlers
 *
 * Sends payment failure notifications to users via the EmailQueue DO.
 * Uses escalating urgency based on payment attempt count.
 */
import type { WebhookContext } from './types.js';
import type { Env } from '../../../types';

interface DunningParams {
  subscriptionId: string;
  orgId: string | null;
  userEmail: string;
  userName: string | null;
  invoiceUrl: string | null;
  amountDue: number;
  currency: string;
  attemptCount: number;
}

interface EmailTemplate {
  subject: string;
  urgency: 'low' | 'medium' | 'high';
}

/**
 * Queue dunning email using existing EmailQueue DO
 */
export async function queueDunningEmail(
  params: DunningParams,
  ctx: WebhookContext,
): Promise<boolean> {
  const {
    subscriptionId,
    orgId,
    userEmail,
    userName,
    invoiceUrl,
    amountDue,
    currency,
    attemptCount,
  } = params;
  const env = ctx.env as Env;
  const { logger } = ctx;

  if (!userEmail) {
    logger.stripe('dunning_email_skipped_no_email', {
      subscriptionId,
      orgId,
      attemptCount,
    });
    return false;
  }

  // Different messaging based on attempt count
  const templates: Record<number, EmailTemplate> = {
    1: {
      subject: 'Payment failed - please update your payment method',
      urgency: 'low',
    },
    2: {
      subject: 'Second payment attempt failed - action required',
      urgency: 'medium',
    },
    3: {
      subject: 'Final notice - your subscription will be canceled',
      urgency: 'high',
    },
  };

  const template = templates[attemptCount] || templates[3];

  // Format amount for display
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amountDue / 100);

  // Build email payload
  const emailPayload = {
    to: userEmail,
    subject: template.subject,
    html: buildDunningEmailHtml({
      userName,
      amount: formattedAmount,
      invoiceUrl,
      attemptCount,
      urgency: template.urgency,
    }),
    text: buildDunningEmailText({
      userName,
      amount: formattedAmount,
      invoiceUrl,
      attemptCount,
    }),
  };

  try {
    // Queue via EmailQueue DO
    const queueId = env.EMAIL_QUEUE.idFromName('default');
    const queue = env.EMAIL_QUEUE.get(queueId);

    const response = await queue.fetch(
      new Request('https://internal/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      }),
    );

    const result = (await response.json()) as { success: boolean };

    logger.stripe('dunning_email_queued', {
      subscriptionId,
      orgId,
      attemptCount,
      urgency: template.urgency,
      queued: result.success,
    });

    return result.success;
  } catch (error) {
    const err = error as Error;
    // Use stripe logger if error logger is not available
    if (logger.error) {
      logger.error('dunning_email_queue_failed', {
        subscriptionId,
        orgId,
        attemptCount,
        error: err.message,
      });
    } else {
      logger.stripe('dunning_email_queue_failed', {
        subscriptionId,
        orgId,
        attemptCount,
        error: err.message,
      });
    }
    return false;
  }
}

interface DunningEmailHtmlParams {
  userName: string | null;
  amount: string;
  invoiceUrl: string | null;
  attemptCount: number;
  urgency: 'low' | 'medium' | 'high';
}

/**
 * Build HTML email for dunning notification
 */
function buildDunningEmailHtml({
  userName,
  amount,
  invoiceUrl,
  attemptCount,
  urgency,
}: DunningEmailHtmlParams): string {
  const urgencyColors = {
    low: '#f59e0b', // amber
    medium: '#f97316', // orange
    high: '#ef4444', // red
  };

  const color = urgencyColors[urgency] || urgencyColors.medium;

  const finalNotice =
    attemptCount >= 3
      ? `
  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0; color: #991b1b;"><strong>Final Notice:</strong> Your subscription will be canceled if payment is not received.</p>
  </div>
  `
      : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-left: 4px solid ${color}; padding-left: 16px; margin-bottom: 24px;">
    <h1 style="color: ${color}; margin: 0 0 8px 0; font-size: 20px;">Payment Failed</h1>
    <p style="margin: 0; color: #6b7280;">Attempt ${attemptCount} of 3</p>
  </div>

  <p>Hi ${userName || 'there'},</p>

  <p>We were unable to process your payment of <strong>${amount}</strong> for your CoRATES subscription.</p>

  ${finalNotice}

  <p>Please update your payment method to continue your subscription:</p>

  <a href="${invoiceUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 16px 0;">Update Payment Method</a>

  <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
    If you have any questions, please contact our support team.
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

  <p style="color: #9ca3af; font-size: 12px;">
    CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis
  </p>
</body>
</html>
  `.trim();
}

interface DunningEmailTextParams {
  userName: string | null;
  amount: string;
  invoiceUrl: string | null;
  attemptCount: number;
}

/**
 * Build plain text email for dunning notification
 */
function buildDunningEmailText({
  userName,
  amount,
  invoiceUrl,
  attemptCount,
}: DunningEmailTextParams): string {
  const finalNotice =
    attemptCount >= 3
      ? 'FINAL NOTICE: Your subscription will be canceled if payment is not received.\n\n'
      : '';

  return `
Payment Failed (Attempt ${attemptCount} of 3)

Hi ${userName || 'there'},

We were unable to process your payment of ${amount} for your CoRATES subscription.

${finalNotice}Please update your payment method: ${invoiceUrl}

If you have any questions, please contact our support team.

--
CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis
  `.trim();
}
