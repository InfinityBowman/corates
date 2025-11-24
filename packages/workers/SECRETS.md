# CoRATES Workers - Secret Management

This guide explains how to properly manage secrets and sensitive configuration for the CoRATES Workers.

## 🔐 Development Secrets

For local development, secrets are stored in `.dev.vars` file which is automatically ignored by git.

### Setup Development Secrets

1. **Copy the example file:**

   ```bash
   cd packages/workers
   cp .dev.vars.example .dev.vars
   ```

2. **Edit `.dev.vars` with your actual values:**

   ```bash
   # Development secrets - DO NOT COMMIT TO GIT
   AUTH_SECRET=your-very-long-random-secret-key-here
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-gmail-app-password
   EMAIL_FROM=your-email@gmail.com
   ```

3. **For Gmail, use App Passwords:**
   - Go to Google Account settings
   - Enable 2FA if not already enabled
   - Generate an App Password for "Mail"
   - Use the App Password in `SMTP_PASS`

### Optional Email Services

Instead of SMTP, you can use these services (recommended for production):

**Resend (Recommended):**

```bash
# Add to .dev.vars
RESEND_API_KEY=re_your_api_key_here
```

**SendGrid:**

```bash
# Add to .dev.vars
SENDGRID_API_KEY=SG.your_api_key_here
```

## 🚀 Production Secrets

For production, use Cloudflare's secret management via `wrangler secret put`:

### Required Production Secrets

```bash
# Set these secrets for production environment
wrangler secret put AUTH_SECRET --env production
wrangler secret put SMTP_USER --env production
wrangler secret put SMTP_PASS --env production
wrangler secret put EMAIL_FROM --env production

# Optional: Email service API keys
wrangler secret put RESEND_API_KEY --env production
wrangler secret put SENDGRID_API_KEY --env production
```

### Example Commands

```bash
# Set a strong auth secret
wrangler secret put AUTH_SECRET --env production
# Enter: a-very-long-random-string-with-at-least-64-characters

# Set email credentials
wrangler secret put SMTP_USER --env production
# Enter: your-production-email@yourdomain.com

wrangler secret put SMTP_PASS --env production
# Enter: your-app-password-or-smtp-password
```

### List Production Secrets

```bash
# View which secrets are set (values are hidden)
wrangler secret list --env production
```

### Delete a Secret

```bash
wrangler secret delete SECRET_NAME --env production
```

## 📁 File Structure

```
packages/workers/
├── .dev.vars                 # Local secrets (ignored by git)
├── .dev.vars.example         # Template for local secrets
├── wrangler.toml            # Public configuration only
└── src/
    ├── auth/
    │   ├── config.js        # Uses env.SECRET_NAME
    │   └── email.js         # Email service configuration
    └── index.js
```

## 🔒 Security Best Practices

1. **Never commit secrets to git**
   - Use `.dev.vars` for local development
   - Use `wrangler secret put` for production

2. **Use strong secrets**
   - AUTH_SECRET should be at least 64 characters
   - Use random generation for production secrets

3. **Rotate secrets regularly**
   - Change production secrets periodically
   - Update email app passwords if compromised

4. **Limit access**
   - Only give Cloudflare account access to trusted team members
   - Use separate email accounts for different environments

## 🛠️ Troubleshooting

### Local Development Issues

**Secret not loading:**

```bash
# Ensure .dev.vars file exists and has correct format
ls -la .dev.vars
cat .dev.vars
```

**Email not working:**

```bash
# Check environment detection
echo "Environment: $ENVIRONMENT"
# Should be 'development' for local dev
```

### Production Issues

**Secret not found:**

```bash
# List all production secrets
wrangler secret list --env production

# Re-add missing secret
wrangler secret put MISSING_SECRET --env production
```

**Email service issues:**

```bash
# Check which email service is configured
wrangler secret list --env production | grep -E "RESEND|SENDGRID|SMTP"
```

## 📚 References

- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Wrangler CLI Commands](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)

## 🧪 Testing Emails in Development

You can test real email sending in development by enabling it in your `.dev.vars`:

### Enable Real Email Sending

1. **Add to your `.dev.vars` file:**

   ```bash
   # Enable real email sending in development
   SEND_EMAILS_IN_DEV=true

   # Use your real email credentials
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-gmail-app-password
   EMAIL_FROM=your-email@gmail.com

   # Or use an email service API key (recommended)
   RESEND_API_KEY=re_your_api_key_here
   ```

2. **Test via API endpoint (development only):**

   ```bash
   # Start the development server
   pnpm dev:workers

   # Test basic email
   curl -X POST http://localhost:8787/api/test-email \
     -H "Content-Type: application/json" \
     -d '{"email": "your-email@example.com"}'

   # Test email verification
   curl -X POST http://localhost:8787/api/test-email \
     -H "Content-Type: application/json" \
     -d '{"email": "your-email@example.com", "type": "verification"}'

   # Test password reset
   curl -X POST http://localhost:8787/api/test-email \
     -H "Content-Type: application/json" \
     -d '{"email": "your-email@example.com", "type": "password-reset"}'
   ```

### When to Use Real Email Testing

- ✅ Testing email templates and formatting
- ✅ Verifying email service configuration
- ✅ Testing email deliverability
- ✅ End-to-end authentication flows

### Email Service Recommendations

**For Development Testing:**

- Gmail SMTP (easy setup with app password)
- Resend free tier (1,000 emails/month)

**For Production:**

- Resend (recommended for Workers)
- SendGrid
- AWS SES
