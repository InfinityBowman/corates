# SMTP Relay Server for Development

This is a simple SMTP relay server for local development. It allows your Cloudflare Worker or other frontend code to send emails via Gmail (or any SMTP provider) using a secure HTTP endpoint.

## Features

- Uses nodemailer to send emails via SMTP
- Accepts HTTP POST requests at `/send-email`
- Reads credentials from `.env` file or environment variables
- Designed for development/testing only

## Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Configure environment variables:**
   - Copy `.env.example` to `.env` and fill in your credentials:
     ```bash
     cp .env.example .env
     # Edit .env with your Gmail/app password or SMTP provider
     ```

3. **Start the server:**
   ```bash
   pnpm run dev
   # or
   node server.mjs
   ```
   The server will listen on `http://localhost:3001` by default.

## Usage

Send a POST request to `/send-email` with JSON body:

```json
{
  "to": "recipient@example.com",
  "subject": "Test Email",
  "html": "<h1>Hello!</h1>",
  "text": "Hello!"
}
```

Example with `curl`:

```bash
curl -X POST http://localhost:3001/send-email \
  -H "Content-Type: application/json" \
  -d '{"to":"recipient@example.com","subject":"Test Email","html":"<h1>Hello!</h1>","text":"Hello!"}'
```

## Environment Variables

See `.env.example` for all required variables:

- `SMTP_HOST` (default: smtp.gmail.com)
- `SMTP_PORT` (default: 587)
- `SMTP_USER` (your email)
- `SMTP_PASS` (your app password)
- `EMAIL_FROM` (your email)
- `EMAIL_FROM_NAME` (display name)
- `PORT` (default: 3001)

## Security

- **Do not use this in production!**
- Only run locally or in a trusted environment.
- Never commit your `.env` file with real credentials to version control.

## Troubleshooting

- Make sure your Gmail account has 2FA enabled and you use an App Password.
- Check logs for errors if emails are not sent.
- Ensure your firewall allows outgoing connections to your SMTP provider.

## License

MIT
