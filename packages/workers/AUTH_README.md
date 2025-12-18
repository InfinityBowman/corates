# Authentication Setup for CoRATES

## Overview

This setup provides comprehensive user authentication using Better Auth with multiple authentication methods, storing users in Cloudflare D1 database, and protecting all Workers endpoints.

## Features

- Email/password authentication with email verification
- Magic link (passwordless) authentication
- Google OAuth integration (for Google Drive access)
- ORCID OAuth integration (for academic researchers)
- Two-factor authentication (TOTP with backup codes)
- User data stored in D1 database via Drizzle ORM
- Session management with secure cookies (7-day expiry)
- Rate limiting on auth endpoints
- Admin features with user impersonation
- Account linking and merging
- WebSocket authentication support

## API Endpoints

### Authentication

- `POST /api/auth/sign-up/email` - Register new user with email/password
- `POST /api/auth/sign-in/email` - Login with email/password
- `POST /api/auth/sign-out` - Logout user
- `GET /api/auth/session` - Get current session info (returns `{ user, session, sessionToken }`)
- `GET /api/auth/verify-email` - Verify email address (from email link)
- `POST /api/auth/forget-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/magic-link` - Send magic link for passwordless login

### OAuth Providers

- `GET /api/auth/sign-in/social?provider=google` - Initiate Google OAuth flow
- `GET /api/auth/callback/google` - Google OAuth callback handler
- `GET /api/auth/sign-in/social?provider=orcid` - Initiate ORCID OAuth flow
- `GET /api/auth/callback/orcid` - ORCID OAuth callback handler

### Two-Factor Authentication

- `POST /api/auth/two-factor/enable` - Enable 2FA (returns TOTP secret and backup codes)
- `POST /api/auth/two-factor/verify` - Verify 2FA code during login
- `POST /api/auth/two-factor/disable` - Disable 2FA

### Admin Endpoints

- `POST /api/admin/stop-impersonation` - Stop admin impersonation session
- Additional admin endpoints for user management (requires admin role)

### Protected Resources

- `/api/projects/*` - Project management (requires auth)
- `/api/projects/:projectId/members/*` - Project member management (requires auth)
- `/api/projects/:projectId/studies/:studyId/pdfs/*` - PDF management (requires auth)
- `/api/users/*` - User management (requires auth)
- `/api/sessions/:sessionId/*` - User session Durable Object (requires auth)
- `/api/project/:projectId/*` - Project Document Durable Object (requires auth)
- `/api/admin/*` - Admin endpoints (requires admin role)
- `/api/billing/*` - Billing endpoints (requires auth)
- `/api/google-drive/*` - Google Drive integration (requires auth)
- `/api/accounts/merge/*` - Account merging (requires auth)

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

The authentication system uses these tables (managed by Better Auth with Drizzle ORM):

### User Table

| Column             | Type      | Description                                      |
| ------------------ | --------- | ------------------------------------------------ |
| `id`               | text      | Primary key (UUID)                               |
| `name`             | text      | User's display name (required)                   |
| `email`            | text      | Email address (required, unique)                 |
| `emailVerified`    | boolean   | Whether email has been verified                  |
| `image`            | text      | Profile image URL                                |
| `username`         | text      | Unique username (optional)                       |
| `displayName`      | text      | Custom display name                              |
| `avatarUrl`        | text      | Avatar URL                                       |
| `role`             | text      | User role ('user' or 'admin')                    |
| `persona`          | text      | User type ('researcher', 'student', 'librarian') |
| `twoFactorEnabled` | boolean   | Whether 2FA is enabled                           |
| `banned`           | boolean   | Whether user is banned                           |
| `banReason`        | text      | Reason for ban                                   |
| `banExpires`       | timestamp | When temporary ban expires                       |

### Session Table

| Column           | Type      | Description                         |
| ---------------- | --------- | ----------------------------------- |
| `id`             | text      | Primary key                         |
| `token`          | text      | Session token (unique)              |
| `expiresAt`      | timestamp | When session expires                |
| `userId`         | text      | Foreign key to user                 |
| `ipAddress`      | text      | Client IP address                   |
| `userAgent`      | text      | Client user agent                   |
| `impersonatedBy` | text      | Admin user ID if being impersonated |

### Account Table

| Column                 | Type      | Description                             |
| ---------------------- | --------- | --------------------------------------- |
| `id`                   | text      | Primary key                             |
| `accountId`            | text      | OAuth provider account ID               |
| `providerId`           | text      | Provider name ('google', 'orcid', etc.) |
| `userId`               | text      | Foreign key to user                     |
| `accessToken`          | text      | OAuth access token                      |
| `refreshToken`         | text      | OAuth refresh token                     |
| `accessTokenExpiresAt` | timestamp | Token expiry                            |
| `scope`                | text      | OAuth scopes granted                    |
| `password`             | text      | Hashed password (for email auth)        |

### Verification Table

| Column       | Type      | Description        |
| ------------ | --------- | ------------------ |
| `id`         | text      | Primary key        |
| `identifier` | text      | Email address      |
| `value`      | text      | Verification token |
| `expiresAt`  | timestamp | When token expires |

### Two-Factor Table

| Column        | Type | Description                |
| ------------- | ---- | -------------------------- |
| `id`          | text | Primary key                |
| `userId`      | text | Foreign key to user        |
| `secret`      | text | TOTP secret                |
| `backupCodes` | text | JSON array of backup codes |

## Environment Variables

### Required

| Variable      | Description                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| `AUTH_SECRET` | Secret key for signing tokens. Must be a long, random string in production. |

### Optional - Configuration

| Variable        | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| `AUTH_BASE_URL` | Base URL for auth callbacks (default: `http://localhost:8787`) |
| `COOKIE_DOMAIN` | Domain for cookies (e.g., `.corates.org` for cross-subdomain)  |
| `ENVIRONMENT`   | `development` or `production`                                  |

### Optional - Email (Postmark)

| Variable                | Description                             |
| ----------------------- | --------------------------------------- |
| `POSTMARK_SERVER_TOKEN` | Server token for Postmark email service |
| `EMAIL_FROM`            | From address for auth emails            |
| `SEND_EMAILS_IN_DEV`    | Set to `'true'` to enable emails in dev |

### Optional - Google OAuth

Used for Google Drive integration:

| Variable               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth 2.0 Client ID from Google Cloud Console     |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret from Google Cloud Console |

### Optional - ORCID OAuth

Used for academic researcher authentication:

| Variable              | Description               |
| --------------------- | ------------------------- |
| `ORCID_CLIENT_ID`     | ORCID OAuth Client ID     |
| `ORCID_CLIENT_SECRET` | ORCID OAuth Client Secret |

### Optional - Magic Links

| Variable                    | Description                          |
| --------------------------- | ------------------------------------ |
| `MAGIC_LINK_EXPIRY_MINUTES` | Magic link expiry time (default: 15) |

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
