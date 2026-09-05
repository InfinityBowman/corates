# Authentication Guide

This guide covers authentication setup, configuration, usage patterns, and code examples with Better Auth in CoRATES.

## Overview

CoRATES uses Better Auth for authentication, providing email/password, emailed one-time codes, OAuth (Google, ORCID), and two-factor authentication. Authentication state is managed on the server (via `getSession` in TanStack Start route handlers) and on the React client (via `useAuthStore`, a Zustand store that mirrors Better Auth's session for use outside React).

This setup provides comprehensive user authentication using Better Auth with multiple authentication methods, storing users in Cloudflare D1 database, and protecting all API endpoints.

## Features

- Email/password authentication with email verification by code
- Emailed six-digit codes for passwordless sign-in, verification, and password reset
- Google OAuth integration (for Google Drive access)
- ORCID OAuth integration (for academic researchers)
- Two-factor authentication (TOTP with backup codes)
- User data stored in D1 database via Drizzle ORM
- Session management with secure cookies (7-day expiry)
- Rate limiting on every endpoint via Cloudflare domain-level rules (Better Auth's built-in limiter is disabled)
- Admin features with user impersonation
- Account linking and merging
- WebSocket authentication support

## Better Auth Setup

### Backend Configuration

Better Auth is configured in `packages/workers/src/auth/config.ts` and exposed via `createAuth(env)`. Route handlers import it from `@corates/workers/auth-config`. It wires up Drizzle + D1, the Postmark email service, and the social providers conditionally based on which credentials are present in the environment.

### Authentication Methods

CoRATES supports multiple authentication methods:

1. **Email/Password** - Traditional email and password authentication
2. **Email Code** - Passwordless sign-in with a six-digit emailed code (creates the account for a new address)
3. **Google OAuth** - OAuth with Google (includes Drive access)
4. **ORCID OAuth** - OAuth with ORCID for academic researchers
5. **Two-Factor Authentication** - TOTP-based 2FA with backup codes

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/sign-up/email` - Register new user with email/password
- `POST /api/auth/sign-in/email` - Login with email/password
- `POST /api/auth/sign-out` - Logout user
- `GET /api/auth/session` - Get current session info
- `POST /api/auth/email-otp/send-verification-otp` - Send a code (`type`: `sign-in` or `email-verification`)
- `POST /api/auth/sign-in/email-otp` - Sign in (or sign up) with an emailed code
- `POST /api/auth/email-otp/verify-email` - Verify an email address with a code
- `POST /api/auth/forget-password/email-otp` - Send a password reset code
- `POST /api/auth/email-otp/reset-password` - Reset password with a code
- `POST /api/auth/onboarding/request-email` - Send a code to the address a placeholder-email user wants to use
- `POST /api/auth/onboarding/confirm-email` - Verify that code; claims an existing account when the address already has one

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

- `/api/orgs/*` - Organization management (requires auth + org membership)
- `/api/orgs/:orgId/projects/*` - Project management (requires auth + org membership)
- `/api/orgs/:orgId/projects/:projectId/members/*` - Project member management (requires project access)
- `/api/orgs/:orgId/projects/:projectId/invitations/*` - Project invitations (requires project access)
- `/api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/*` - PDF management (requires project access)
- `/api/users/*` - User management (requires auth)
- `/api/sessions/:sessionId/*` - User session Durable Object (requires auth)
- `/api/sync/:projectId` - Sync-engine workspace WebSocket (requires auth + project membership, checked against D1 on connect)
- `/api/admin/*` - Admin endpoints (requires admin role)
- `/api/billing/*` - Billing endpoints (requires auth)
- `/api/google-drive/*` - Google Drive integration (requires auth)
- `/api/invitations/accept` - Accept project invitations (requires auth)

See the [Organizations Guide](/guides/organizations) for detailed org/project route patterns.

## Frontend Usage

### Auth Client

The React client is configured in `packages/web/src/api/auth-client.ts`:

```ts
import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, twoFactorClient, adminClient, organizationClient } from 'better-auth/client/plugins';
import { API_BASE } from '@/config/api';
import { parseError } from '@/lib/error-utils';

export const authClient = createAuthClient({
  baseURL: API_BASE,
  plugins: [emailOTPClient(), twoFactorClient(), adminClient(), organizationClient()],
  fetchOptions: {
    credentials: 'include',
    onError(error) {
      const parsedError = parseError(error);
      console.error('Auth error:', parsedError.code, parsedError.message);
    },
  },
});
```

`authFetch` (exported from the same file) wraps Better Auth's `{ data, error }` return shape and throws on error so calls compose naturally with `try/catch` and TanStack Query.

### Auth Store

`useAuthStore` (Zustand, at `packages/web/src/stores/authStore.ts`) holds auth state that must be accessible from outside React -- sync-engine callbacks, API interceptors, cross-tab broadcasts. `AuthProvider` syncs Better Auth's `useSession()` into the store.

Key fields:

- `sessionUser` / `sessionLoading` -- mirror Better Auth's current session.
- `cachedUser` -- last-known user from localStorage, used for offline and first-paint UX.
- `isOnline` -- toggled by `online` / `offline` window events.

Selectors compose these into derived state:

```ts
import { useAuthStore, selectIsLoggedIn, selectUser } from '@/stores/authStore';

const isLoggedIn = useAuthStore(selectIsLoggedIn);
const user = useAuthStore(selectUser);
```

`selectIsLoggedIn` returns `true` when a cached user exists and the session is still loading, so protected routes don't flash a redirect on reload.

### Auth actions

All sign-in / sign-out / OAuth helpers are actions on `useAuthStore`:

```tsx
const signin = useAuthStore(s => s.signin);
const signinWithGoogle = useAuthStore(s => s.signinWithGoogle);
const authError = useAuthStore(s => s.authError);

await signin(email, password);
```

See [State Management Guide](/guides/state-management) for the store pattern more broadly.

## Protected Routes

### Backend Protection

API route handlers guard themselves with `getSession`. There is no Hono-style middleware layer -- each handler does its own check. This keeps auth policy explicit at the route.

```ts
import { getSession } from '@corates/workers/auth';
import { env } from 'cloudflare:workers';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

export const handleGet = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    return Response.json(createDomainError(AUTH_ERRORS.REQUIRED), { status: 401 });
  }

  // session.user, session.session available here
};
```

For finer-grained checks (org ownership, project membership, admin role), use the policies from `@corates/workers/policies` or the guard helpers under `@/server/guards/`.

### Frontend Protection

Protected route trees use TanStack Router's `beforeLoad` hook, reading from `useAuthStore` synchronously (the store hydrates from the localStorage cache at module load, so this check works even before the session resolves).

```tsx
// routes/_app/_protected.tsx
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';

export const Route = createFileRoute('/_app/_protected')({
  beforeLoad: () => {
    const state = useAuthStore.getState();
    if (!selectIsLoggedIn(state)) {
      throw redirect({ to: '/signin' });
    }
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const isLoading = useAuthStore(selectIsAuthLoading);
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      navigate({ to: '/signin', replace: true });
    }
  }, [isLoading, isLoggedIn, navigate]);

  return isLoading ? <PageLoader /> : <Outlet />;
}
```

Any route segment under `_protected` is now guarded. Do not re-guard inside child routes unless they require stricter policy (e.g. admin only).

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

WebSocket upgrades authenticate with the same Better Auth session cookie as REST requests -- the browser sends cookies on the upgrade request automatically:

```javascript
const ws = new WebSocket('ws://localhost:8787/api/sync/my-project-id?clientId=MY_CLIENT_ID');
```

## Session Management

### Session Configuration

Sessions are managed with secure cookies (7-day expiry by default). Session data includes:

- User information (id, name, email, etc.)
- Session token
- Expiration timestamp

### Session Access

**Backend (inside a route handler):**

```ts
const session = await getSession(request, env);
const { user, session: sessionRow } = session ?? {};
```

**Frontend:**

```tsx
const user = useAuthStore(selectUser);
const isLoggedIn = useAuthStore(selectIsLoggedIn);
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

## Account Linking

Users can link multiple sign-in methods (Google, ORCID, email code, password) to one account from Settings > Sign-in methods, which uses Better Auth's `linkSocial` and `unlinkAccount`. Account linking is configured in `packages/workers/src/auth/config.ts` with `allowDifferentEmails: true`, so an authenticated user can link a provider whose email differs from their account email. Google is a trusted provider, so a Google sign-in whose email matches an existing account links automatically.

Both social providers run with `disableImplicitSignUp`, so a sign-in with an identity CoRATES has never seen fails with `signup_disabled` and the sign-in page offers two options: sign in with the method used before, or create an account with that identity (which re-runs the flow with `requestSignUp`). The sign-up page always passes `requestSignUp`. Email code sign-in is deliberately not gated: the code proves ownership of the address, so a new address becomes an account and an existing one signs in, and the same address can never become two accounts.

## Onboarding and the Email Identity

A verified real email is the account identity; providers only prove ownership of one. `getOnboardingStep` in `@corates/shared/email` derives the state from the user row (`email`, `emailVerified`, `profileCompletedAt`): `email`, then `profile`, then done. The `_app/_protected` layout redirects anyone with a pending step to `/complete-profile`, which renders that step, so no signed-in user reaches the app without a verified email.

ORCID's OIDC userinfo carries no email. On sign-in CoRATES asks the public API (`GET https://pub.orcid.org/v3.0/{orcid}/email`) for a verified public address and uses it as a verified email. Otherwise the user is created with a placeholder `<orcid-id>@orcid.placeholder.invalid` (`isSyntheticEmail`) and `emailVerified` false, and lands on the email step. That step is served by the `onboardingEmail` plugin in `packages/workers/src/auth/onboarding-email.ts`: it sends a code to the typed address regardless of whether an account exists, and a correct code either writes the address as verified or, when another account already owns it, claims that account. Claiming moves the provider `account` rows and any shared organization memberships onto the existing user, deletes the throwaway user and any organization only it occupied, and signs the browser in as the existing user. If the existing account was never verified, its pre-existing password, provider links, and sessions are revoked first (Better Auth's `revokeUnprovenAccountAccess`), so nothing that predates proof of the mailbox is inherited; a banned existing account cannot be claimed. A user with a completed profile or any project data is never discarded; the endpoint returns `EMAIL_IN_USE` and the person is told to sign in to the other account and link from Settings. The only remaining manual merge is that case.

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

Every emailed secret is a six-digit code (Better Auth `emailOTP` plugin with `overrideDefaultEmailVerification`), never a link: mail security scanners consume single-use links, and a link opened on another device loses the browser state the flow depends on. Codes expire after `AUTH_CODE_EXPIRY_MINUTES` (10) and allow five wrong guesses. A password sign-in on an unverified address sends a code and the client moves to `/verify-email`, where a correct code verifies the address and signs the user in. In `DEV_MODE` the pending code can be read back through `GET /api/test/auth-code?email=&type=` for e2e tests.

## Password Reset

1. User enters their email on `/reset-password` (`POST /api/auth/forget-password/email-otp`)
2. The same page asks for the code and a new password (`POST /api/auth/email-otp/reset-password`)

Settings uses the same page to let a user without a password set one: it sends the code and opens `/reset-password?email=...&sent=1`.

## Better Auth Organization Plugin

CoRATES uses the Better Auth organization plugin for multi-tenant workspace support. Organizations are the top-level container for projects and team collaboration.

### Organization Features

- **Multi-org support** - Users can belong to multiple organizations
- **Role-based access** - Org roles: `owner > admin > member`
- **Active organization** - Session tracks user's current active org
- **Org invitations** - Better Auth handles org-level invitations

### Frontend Organization Client

```js
import { authClient } from '@api/auth-client.js';

// List user's organizations
const { data: orgs } = await authClient.organization.list();

// Create organization
await authClient.organization.create({ name: 'My Lab', slug: 'my-lab' });

// Set active organization
await authClient.organization.setActive({ organizationId: orgId });
```

See the [Organizations Guide](/guides/organizations) for complete organization patterns.

## Project Invitations

Project invitations allow project owners to invite users who don't have accounts yet. The email carries a stable `/invite/{token}` link that stays valid for the invitation's lifetime; no short-lived auth token is embedded.

### Combined Org + Project Flow

Project invitations use a **combined flow** that ensures org membership before granting project access:

1. **Invitation Creation**: When a project owner creates an invitation via `POST /api/orgs/:orgId/projects/:projectId/invitations`:
   - Invitation includes `orgId`, `projectId`, `role` (project), `orgRole` (org)
   - Unique invitation token (UUID)
   - 7-day expiration
   - Inviter information

2. **Invitation Link**: The email links to `/invite/{token}` (`packages/workers/src/lib/send-invitation-email.ts`), which handles every auth state: a signed-in user accepts in place, an existing user is sent to sign in, and a new user is sent to sign up. The token is stashed in `localStorage` as `pendingInvitationToken` so onboarding can finish the acceptance.

3. **Account Creation**: A new user signs up with an email code or a provider, completes `/complete-profile`, and the onboarding flow calls `acceptInvitation` with the stashed token.

4. **Invitation Acceptance**: The acceptance endpoint:
   - Validates the invitation token
   - Checks expiration and acceptance status
   - Verifies email match (case-insensitive, trimmed)
   - **Ensures org membership** (adds with `orgRole` if not already a member)
   - Adds user to project as a member with specified `role` (membership is a D1 fact, read by the sync engine at authorize time)
   - Refresh-disconnects the project's sync sessions so connected clients refetch the members query
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

- `POST /api/orgs/:orgId/projects/:projectId/invitations` - Create invitation (project owner)
- `GET /api/orgs/:orgId/projects/:projectId/invitations` - List invitations (project member)
- `DELETE /api/orgs/:orgId/projects/:projectId/invitations/:id` - Cancel invitation (project owner)
- `POST /api/invitations/accept` - Accept a project invitation by token
  - Requires authentication
  - Validates email match
  - Ensures org membership before project membership
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
   - `https://www.googleapis.com/auth/drive.file` (per-file access to PDFs picked in the Google Picker; non-sensitive, so no restricted-scope verification is needed. Do not use `drive.readonly`: it is a restricted scope that requires a CASA security assessment and shows an unverified-app warning until approved)

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

- Call `getSession(request, env)` at the top of every protected route handler
- Read auth state in components via `useAuthStore` selectors (`selectIsLoggedIn`, `selectUser`)
- Guard protected route trees with `beforeLoad` + redirect, not ad-hoc component checks
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

- [Organizations Guide](/guides/organizations) - For org model, routes, and middleware
- [API Development Guide](/guides/api-development) - For protected route patterns
- [Error Handling Guide](/guides/error-handling) - For auth error handling
- [State Management Guide](/guides/state-management) - For auth store patterns
