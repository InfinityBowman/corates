export class EmailQueue {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    // Accept POST with email payload {to, subject, html, text}
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const payload = await request.json();
      // Minimally validate
      if (!payload?.to || !payload?.subject || (!payload?.html && !payload?.text)) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
      }

      // Send email in background: we will attempt and record errors, but respond quickly
      this.sendEmail(payload).catch(err => {
        console.error('EmailQueue send error:', err);
      });

      return new Response(JSON.stringify({ success: true }), { status: 202 });
    } catch (err) {
      console.error('EmailQueue error parsing request:', err);
      return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });
    }
  }

  async sendEmail(payload) {
    const { createEmailService } = await import('../auth/email.js');
    const emailService = createEmailService(this.env);

    // Attempt to send email
    try {
      const result = await emailService.sendEmail(payload);
      if (result.success) {
        console.log('EmailQueue: email sent to', payload.to);
      } else {
        throw new Error(result.error || 'Unknown email error');
      }
    } catch (err) {
      console.error('EmailQueue: failed to send', err);
      // Minimal retry logic: single retry after delay
      try {
        await new Promise(r => setTimeout(r, 500));
        const retryResult = await emailService.sendEmail(payload);
        if (retryResult.success) {
          console.log('EmailQueue: email retry succeeded for', payload.to);
        } else {
          throw new Error(retryResult.error || 'Retry failed');
        }
      } catch (err2) {
        console.error('EmailQueue: retry failed for', payload.to, err2);
      }
    }
  }
}
