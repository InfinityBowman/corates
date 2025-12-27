# Authentication Guide

This guide covers authentication setup, configuration, usage patterns, and code examples with Better Auth in CoRATES.

## Overview

CoRATES uses Better Auth for authentication, providing email/password, magic links, OAuth (Google, ORCID), and two-factor authentication. Authentication state is managed on both the backend (Workers) and frontend (SolidJS).

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

## Better Auth Setup

### Backend Configuration

Better Auth is configured in `packages/workers/src/auth/config.js`:

```11:34:packages/workers/src/auth/config.js
export function createAuth(env, ctx) {
  // Initialize Drizzle with D1
  const db = drizzle(env.DB, { schema });

  // Create email service
  const emailService = createEmailService(env);

  // Build social providers config if credentials are present
  const socialProviders = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Required so Google issues a refresh token (needed for Drive access when access tokens expire)
      accessType: 'offline',
      // Request Drive read-only access for PDF import
      scope: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.readonly'],
    };
  } else {
    console.error(
      '[Auth] Google OAuth NOT configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET',
    );
  }
```

### Authentication Methods

CoRATES supports multiple authentication methods:

1. **Email/Password** - Traditional email and password authentication
2. **Magic Link** - Passwordless email-based authentication
3. **Google OAuth** - OAuth with Google (includes Drive access)
4. **ORCID OAuth** - OAuth with ORCID for academic researchers
5. **Two-Factor Authentication** - TOTP-based 2FA with backup codes

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/sign-up/email` - Register new user with email/password
- `POST /api/auth/sign-in/email` - Login with email/password
- `POST /api/auth/sign-out` - Logout user
- `GET /api/auth/session` - Get current session info
- `GET /api/auth/verify-email` - Verify email address (from email link)
- `POST /api/auth/forget-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/magic-link` - Send magic link for passwordless login

### OAuth Endpoints

- `GET /api/auth/sign-in/social?provider=google` - Initiate Google OAuth flow
- `GET /api/auth/callback/google` - Google OAuth callback handler
- `GET /api/auth/sign-in/social?provider=orcid` - Initiate ORCID OAuth flow
- `GET /api/auth/callback/orcid` - ORCID OAuth callback handler

### Two-Factor Authentication Endpoints

- `POST /api/auth/two-factor/enable` - Enable 2FA (returns TOTP secret and backup codes)
- `POST /api/auth/two-factor/verify` - Verify 2FA code during login
- `POST /api/auth/two-factor/disable` - Disable 2FA

### Admin Endpoints

- `POST /api/admin/stop-impersonation` - Stop admin impersonation session
- Additional admin endpoints for user management (requires admin role)

### Protected Resources

The following endpoints require authentication:

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

## Frontend Usage

### Auth Client

The frontend uses Better Auth's SolidJS client:

```1:41:packages/web/src/api/auth-client.js
import { createAuthClient } from 'better-auth/solid';
import {
  genericOAuthClient,
  magicLinkClient,
  twoFactorClient,
  adminClient,
} from 'better-auth/client/plugins';
import { API_BASE } from '@config/api.js';
import { parseError } from '@/lib/error-utils.js';

export const authClient = createAuthClient({
  baseURL: API_BASE,

  plugins: [genericOAuthClient(), magicLinkClient(), twoFactorClient(), adminClient()],

  fetchOptions: {
    credentials: 'include',
    onError(error) {
      const parsedError = parseError(error);
      console.error('Auth error:', parsedError.code, parsedError.message);
    },
    onSuccess() {
      // Auth action successful
    },
  },
});

// Export Better Auth methods for easy access
export const {
  signIn,
  signUp
```

### Auth Store

The auth store wraps Better Auth with caching and offline support:

```18:65:packages/web/src/api/better-auth-store.js
function createBetterAuthStore() {
  // Track online status without reactive primitives (for singleton context)
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);

  // Listen for online/offline events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
  }

  function loadCachedAuth() {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(AUTH_CACHE_KEY);
      const timestamp = localStorage.getItem(AUTH_CACHE_TIMESTAMP_KEY);
      if (!cached || !timestamp) return null;

      const age = Date.now() - parseInt(timestamp, 10);
      if (age > AUTH_CACHE_MAX_AGE) {
        localStorage.removeItem(AUTH_CACHE_KEY);
        localStorage.removeItem(AUTH_CACHE_TIMESTAMP_KEY);
        return null;
      }

      return JSON.parse(cached);
    } catch (err) {
      console.error('Error loading cached auth:', err);
      return null;
    }
  }

  // Save auth data to localStorage
  function saveCachedAuth(userData) {
    if (typeof window === 'undefined') return;
    try {
      if (userData) {
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(userData));
        localStorage.setItem(AUTH_CACHE_TIMESTAMP_KEY, Date.now().toString());
      } else {
        localStorage.removeItem(AUTH_CACHE_KEY);
        localStorage.removeItem(AUTH_CACHE_TIMESTAMP_KEY);
      }
    } catch (err) {
      console.error('Error saving cached auth:', err);
    }
  }
```

### Using Auth in Components

```js
import { useBetterAuth } from '@/api/better-auth-store.js';

function MyComponent() {
  const auth = useBetterAuth();

  // Reactive values
  const user = () => auth.user();
  const isLoggedIn = () => auth.isLoggedIn();
  const isLoading = () => auth.authLoading();

  return (
    <Show when={isLoggedIn()}>
      <div>Welcome, {user()?.name}</div>
    </Show>
  );
}
```

## Protected Routes

### Backend Protection

Use `requireAuth` middleware to protect routes:

```35:56:packages/workers/src/middleware/auth.js
export async function requireAuth(c, next) {
  try {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) {
      const error = createDomainError(AUTH_ERRORS.REQUIRED);
      return c.json(error, error.statusCode);
    }

    c.set('user', session.user);
    c.set('session', session.session);

    await next();
  } catch (error) {
    console.error('Auth verification error:', error);
    const authError = createDomainError(AUTH_ERRORS.REQUIRED);
    return c.json(authError, authError.statusCode);
  }
}
```

### Frontend Protection

Use `ProtectedGuard` component:

```js
import ProtectedGuard from '@auth-ui/ProtectedGuard.jsx';

function App() {
  return (
    <ProtectedGuard>
      <YourProtectedComponent />
    </ProtectedGuard>
  );
}
```

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

## Session Management

### Session Configuration

Sessions are managed with secure cookies (7-day expiry by default). Session data includes:

- User information (id, name, email, etc.)
- Session token
- Expiration timestamp

### Session Access

**Backend:**

```js
const { user, session } = getAuth(c);
```

**Frontend:**

```js
const auth = useBetterAuth();
const user = () => auth.user();
const session = () => auth.session();
```

## Admin Features

### User Impersonation

Admins can impersonate users for support purposes:

```js
// Admin only - impersonate a user
await authClient.admin.impersonate({ userId: 'user-id' });
```

### Admin Routes

Admin routes require admin role and use special middleware to check permissions.

## Account Linking and Merging

Users can link multiple accounts (e.g., email and OAuth) and merge accounts when needed. This is handled through Better Auth's account linking features.

## Two-Factor Authentication

### Enabling 2FA

```js
// Enable 2FA
const result = await authClient.twoFactor.enable();
// Returns: { secret, backupCodes, qrCode }

// Display QR code to user
// User scans with authenticator app
```

### Verifying 2FA

```js
// During login with 2FA enabled
await authClient.signIn.email({
  email,
  password,
  twoFactorCode: '123456', // From authenticator app
});
```

### Backup Codes

Users receive backup codes when enabling 2FA. These can be used if the authenticator app is lost.

## Email Verification

Users must verify their email address after signup. Verification links are sent via email and contain tokens that expire after a set time.

## Password Reset

Password reset flow:

1. User requests password reset (`POST /api/auth/forget-password`)
2. Email sent with reset token
3. User clicks link and enters new password
4. Password is reset (`POST /api/auth/reset-password`)

## Project Invitations

Project invitations allow project owners to invite users who don't have accounts yet. Invitations use Better Auth's magic link system for seamless account creation and project access.

### Invitation Flow

1. **Invitation Creation**: When a project owner adds a member by email and the user doesn't exist, an invitation is created with:
   - Unique invitation token (UUID)
   - 7-day expiration
   - Project role assignment
   - Inviter information

2. **Magic Link Generation**: The invitation email contains a Better Auth magic link that:
   - Points to `/complete-profile?invitation={token}`
   - Uses Better Auth's `signInMagicLink` API
   - Creates a magic link token in the verification table
   - Expires after the configured magic link expiry time

3. **Account Creation**: When the invited user clicks the magic link:
   - Better Auth handles authentication/account creation
   - User is redirected to `/complete-profile` with the invitation token
   - Frontend extracts the token and calls `POST /api/invitations/accept`

4. **Invitation Acceptance**: The acceptance endpoint:
   - Validates the invitation token
   - Checks expiration and acceptance status
   - Verifies email match (case-insensitive, trimmed)
   - Adds user to project as a member
   - Syncs member data to ProjectDoc Durable Object
   - Sends notification via UserSession Durable Object

### Email Matching Security

For security, the authenticated user's email must match the invitation email. The comparison is:

- Case-insensitive
- Trimmed (whitespace removed)
- Normalized before comparison

```js
const normalizedUserEmail = (currentUser.email || '').trim().toLowerCase();
const normalizedInvitationEmail = (invitation.email || '').trim().toLowerCase();

if (normalizedUserEmail !== normalizedInvitationEmail) {
  // Email mismatch - reject invitation
}
```

### Invitation Endpoints

- `POST /api/invitations/accept` - Accept a project invitation by token
  - Requires authentication
  - Validates email match
  - Returns project details on success

### Resending Invitations

If an invitation is pending (not expired or accepted), it can be resent by:

- Updating the role if changed
- Extending the expiration date
- Resending the email with the same token

Already-accepted invitations cannot be resent and will return a `PROJECT_INVITATION_ALREADY_ACCEPTED` error.

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

## Best Practices

### DO

- Always use `requireAuth` middleware on protected routes
- Use `useBetterAuth` hook in components for auth state
- Cache auth state in localStorage for offline support
- Handle auth errors gracefully
- Verify email addresses
- Support password reset flow
- Use secure session cookies

### DON'T

- Don't expose session tokens to frontend
- Don't store passwords in plain text
- Don't skip email verification
- Don't allow weak passwords (Better Auth handles this)
- Don't forget to handle expired sessions

## Related Guides

- [API Development Guide](/guides/api-development) - For protected route patterns
- [Error Handling Guide](/guides/error-handling) - For auth error handling
- [State Management Guide](/guides/state-management) - For auth store patterns
