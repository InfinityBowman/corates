yes# Authentication Setup for Corates

## Overview

This setup provides comprehensive user authentication using BetterAuth with email/password authentication, storing users in D1 database, and protecting all Workers endpoints.

## Features

- Email/password authentication with BetterAuth
- Email verification with customizable templates
- Password reset functionality
- Google OAuth integration (for Google Drive access)
- User data stored in D1 database
- Session management with secure cookies
- Rate limiting on auth endpoints
- WebSocket authentication support

## API Endpoints

### Authentication

- `POST /api/auth/sign-up/email` - Register new user with email/password
- `POST /api/auth/sign-in/email` - Login with email/password
- `POST /api/auth/sign-out` - Logout user
- `GET /api/auth/session` - Get current session info
- `GET /api/auth/verify-email` - Verify email address (from email link)
- `POST /api/auth/forget-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### OAuth (Google)

- `GET /api/auth/sign-in/social?provider=google` - Initiate Google OAuth flow
- `GET /api/auth/callback/google` - OAuth callback handler

### Protected Resources

- `/api/projects/*` - Project management (requires auth)
- `/api/projects/:projectId/members/*` - Project member management (requires auth)
- `/api/projects/:projectId/studies/:studyId/pdfs/*` - PDF management (requires auth)
- `/api/users/*` - User management (requires auth)
- `/api/sessions/:sessionId/*` - User session Durable Object (requires auth)
- `/api/project/:projectId/*` - Project Document Durable Object (requires auth)

## Usage Examples

### Register a new user

```bash
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "name": "John Doe"
  }'
```

### Login

```bash
curl -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'
```

### Get current session

```bash
curl -X GET http://localhost:8787/api/auth/session \
  --cookie "better-auth.session_token=YOUR_SESSION_TOKEN"
```

### WebSocket Authentication

For WebSocket connections, authenticate via URL parameter:

```javascript
const ws = new WebSocket('ws://localhost:8787/api/project/my-project?token=YOUR_SESSION_TOKEN');
```

## Database Schema

The authentication system uses these tables (managed by BetterAuth):

- `user` - User profiles (id, name, email, emailVerified, username, displayName, avatarUrl)
- `session` - Active user sessions with tokens
- `account` - OAuth provider accounts (stores access/refresh tokens for Google, etc.)
- `verification` - Email verification and password reset tokens

## Environment Variables

### Required

| Variable        | Description                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| `AUTH_SECRET`   | Secret key for signing tokens. Must be a long, random string in production. |
| `AUTH_BASE_URL` | Base URL for auth callbacks (e.g., `https://api.corates.app`)               |

### Email

| Variable         | Description                      |
| ---------------- | -------------------------------- |
| `RESEND_API_KEY` | API key for Resend email service |
| `EMAIL_FROM`     | From address for auth emails     |

### Google OAuth

Used for Google Drive integration:

| Variable               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth 2.0 Client ID from Google Cloud Console     |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret from Google Cloud Console |

### Cross-subdomain cookies

| Variable        | Description                                                   |
| --------------- | ------------------------------------------------------------- |
| `COOKIE_DOMAIN` | Domain for cookies (e.g., `.corates.app` for cross-subdomain) |

## Google OAuth Setup

Google OAuth is used to allow users to connect their Google account and access their Google Drive (e.g., to import PDFs).

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API** under APIs & Services > Library

### 2. Configure OAuth Consent Screen

1. Go to APIs & Services > OAuth consent screen
2. Choose "External" user type
3. Fill in app name, support email, and developer contact
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/drive.readonly` (for reading Drive files)

### 3. Create OAuth Credentials

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Choose "Web application"
4. Add authorized redirect URIs:
   - Development: `http://localhost:8787/api/auth/callback/google`
   - Production: `https://your-api-domain.com/api/auth/callback/google`
5. Copy the Client ID and Client Secret
