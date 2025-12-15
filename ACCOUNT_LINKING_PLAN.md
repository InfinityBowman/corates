# Account Linking and Identity Management Plan

## Overview

This document outlines the implementation plan for enterprise-grade account linking and identity management in CoRATES. Users will be able to link multiple authentication providers (Google, ORCID, email/password, magic link) to a single account, manage their linked identities, and maintain security across all sign-in methods.

## Goals

1. **Single Identity**: Users have one account regardless of how they sign in
2. **Flexibility**: Support linking/unlinking multiple providers at any time
3. **Security**: Prevent account takeover while enabling legitimate account merging
4. **Transparency**: Users can see and manage all linked accounts
5. **Recovery**: Multiple sign-in options serve as account recovery methods

---

## Phase 1: Backend Configuration (Completed)

### 1.1 Enable Account Linking in Better Auth

**File**: `packages/workers/src/auth/config.js`

```js
account: {
  accountLinking: {
    enabled: true,
    trustedProviders: ['google'],  // Google always verifies email
    // ORCID may not always return verified emails, so not trusted by default
  },
},
```

**Status**: Done

### 1.2 Behavior Summary

| Scenario                               | Behavior                                      |
| -------------------------------------- | --------------------------------------------- |
| Same email, trusted provider (Google)  | Auto-link to existing account                 |
| Same email, untrusted provider (ORCID) | Only link if provider confirms email verified |
| Different email                        | Requires manual linking while signed in       |
| User has only 1 account                | Cannot unlink (prevents lockout)              |

---

## User Flows

This section documents the complete user flows for account linking operations. Each flow includes UI states, API calls, success/error handling, and edge cases.

---

### Flow 1: Link Google Account (Happy Path)

**Trigger**: User clicks "+ Google" button in Linked Accounts section

**Prerequisites**:

- User is authenticated
- User does not already have a Google account linked

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLOW DIAGRAM                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Settings Page]                                                │
│       │                                                         │
│       ▼                                                         │
│  [Click "+ Google"]                                             │
│       │                                                         │
│       ▼                                                         │
│  [Button shows "Linking..."]                                    │
│       │                                                         │
│       ▼                                                         │
│  [Redirect to Google OAuth]                                     │
│       │                                                         │
│       ├──── User cancels ────► [Return to Settings]             │
│       │                        [No changes, no toast]           │
│       │                                                         │
│       ▼                                                         │
│  [User authorizes in Google]                                    │
│       │                                                         │
│       ▼                                                         │
│  [Redirect back to Settings]                                    │
│       │                                                         │
│       ├──── Success ────► [Refetch accounts]                    │
│       │                   [Show success toast]                  │
│       │                   [Google now in list]                  │
│       │                                                         │
│       └──── Error ────► [Show error toast]                      │
│                         [Account list unchanged]                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Step-by-Step**:

| Step | User Action          | System Response                                                                | UI State                                    |
| ---- | -------------------- | ------------------------------------------------------------------------------ | ------------------------------------------- |
| 1    | Clicks "+ Google"    | Call `authClient.linkSocial({ provider: 'google', callbackURL: '/settings' })` | Button disabled, shows "Linking..."         |
| 2    | —                    | Better Auth redirects to Google OAuth                                          | Full page redirect                          |
| 3    | Authorizes in Google | Google redirects to callback URL with auth code                                | Page renders normally                       |
| 4    | —                    | Better Auth exchanges code, creates account record, links to user              | —                                           |
| 5    | —                    | Page loads, `listAccounts()` is called                                         | Accounts list refreshes                     |
| 6    | —                    | Google account appears in list                                                 | Toast: "Google account linked successfully" |

**Error Scenarios**:

| Error                    | Cause                                   | User Message                                                       | Recovery                                                                     |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `ACCOUNT_ALREADY_LINKED` | Google account linked to different user | "This Google account is already linked to another CoRATES account" | User must sign out of other account first, or use a different Google account |
| `OAUTH_CANCELLED`        | User closed Google popup/clicked cancel | No message (silent)                                                | User can try again                                                           |
| `OAUTH_ERROR`            | Google returned an error                | "Failed to connect Google account. Please try again."              | Retry                                                                        |
| `NETWORK_ERROR`          | Connection issue                        | "Connection error. Please check your internet and try again."      | Retry                                                                        |

**Implementation Notes**:

- Store `linkingProvider` state to show loading on correct button
- `callbackURL` should be the current page URL to return user to settings
- On return, check URL params for error codes from Better Auth
- Clear loading state on both success and failure

---

### Flow 2: Link Google Account (Different Email)

**Trigger**: User with `jacob@yahoo.com` links Google account `jacob@gmail.com`

**Key Difference**: The Google account has a different email than the user's primary email

```
┌─────────────────────────────────────────────────────────────────┐
│                     DIFFERENT EMAIL FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User: jacob@yahoo.com (signed in)                              │
│       │                                                         │
│       ▼                                                         │
│  [Click "+ Google"]                                             │
│       │                                                         │
│       ▼                                                         │
│  [Google OAuth - user picks jacob@gmail.com]                    │
│       │                                                         │
│       ▼                                                         │
│  [Better Auth links account]                                    │
│       │                                                         │
│       ▼                                                         │
│  Result:                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ User record:                                            │    │
│  │   id: "user_123"                                        │    │
│  │   email: "jacob@yahoo.com" (unchanged - primary)        │    │
│  │                                                         │    │
│  │ Account records:                                        │    │
│  │   1. providerId: "credential", email: jacob@yahoo.com   │    │
│  │   2. providerId: "google", email: jacob@gmail.com       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**UI Display After Linking**:

```
┌───────────────────────────────────────────────────────────┐
│ [Email Icon]   Email & Password               [Primary]   │
│                jacob@yahoo.com                            │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ [Google Icon]  Google                          [Unlink]   │
│                jacob@gmail.com                            │
│                Linked on Dec 15, 2025                     │
└───────────────────────────────────────────────────────────┘
```

**Important Behaviors**:

- Primary email remains `jacob@yahoo.com` (used for notifications, password reset)
- User can now sign in with either email
- Sign in with `jacob@gmail.com` via Google → same account
- Sign in with `jacob@yahoo.com` via password → same account

---

### Flow 3: Link ORCID Account

**Trigger**: User clicks "+ ORCID" button

**Key Differences from Google**:

- ORCID uses generic OAuth (not a native Better Auth provider)
- ORCID may not return an email address
- Display shows ORCID ID (e.g., `0000-0001-2345-6789`) instead of email

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORCID FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Click "+ ORCID"]                                              │
│       │                                                         │
│       ▼                                                         │
│  [Redirect to orcid.org OAuth]                                  │
│       │                                                         │
│       ▼                                                         │
│  [User signs in to ORCID, authorizes CoRATES]                   │
│       │                                                         │
│       ▼                                                         │
│  [ORCID returns profile data]                                   │
│       │                                                         │
│       ├──── Has email ────► Store email with account            │
│       │                                                         │
│       └──── No email ────► Use ORCID ID as identifier           │
│                            (e.g., "0000-0001-2345-6789@orcid")  │
│       │                                                         │
│       ▼                                                         │
│  [Account linked successfully]                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**UI Display After Linking**:

```
┌───────────────────────────────────────────────────────────┐
│ [ORCID Icon]   ORCID                           [Unlink]   │
│                0000-0001-2345-6789                        │
│                Linked on Dec 15, 2025                     │
└───────────────────────────────────────────────────────────┘
```

**ORCID-Specific Notes**:

- ORCID profile may have private email → we get ORCID ID only
- Show ORCID ID in display (researchers recognize this)
- Consider linking to ORCID profile: `https://orcid.org/0000-0001-2345-6789`

---

### Flow 4: Add Email/Password (OAuth-Only User)

**Trigger**: User who signed up with Google clicks "+ Email/Password"

**Context**: User wants a backup sign-in method that doesn't depend on Google

```
┌─────────────────────────────────────────────────────────────────┐
│                   ADD PASSWORD FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Current state: User has only Google account                    │
│  User email (from Google): jacob@gmail.com                      │
│       │                                                         │
│       ▼                                                         │
│  [Click "+ Email/Password"]                                     │
│       │                                                         │
│       ▼                                                         │
│  [Show modal: "Set a Password"]                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Set a Password                                         │    │
│  │                                                         │    │
│  │  Create a password to sign in without Google.           │    │
│  │  Password reset emails will be sent to jacob@gmail.com  │    │
│  │                                                         │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ New Password                              [👁]  │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ Confirm Password                          [👁]  │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                         │    │
│  │  Password must be at least 8 characters                 │    │
│  │                                                         │    │
│  │         [Cancel]              [Set Password]            │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                         │
│       ▼                                                         │
│  [API: auth.api.setPassword({ password })]                      │
│       │                                                         │
│       ├──── Success ────► [Close modal]                         │
│       │                   [Refetch accounts]                    │
│       │                   [Toast: "Password added"]             │
│       │                   [Credential account now in list]      │
│       │                                                         │
│       └──── Error ────► [Show error in modal]                   │
│                         [Keep modal open]                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Alternative Flow (Email-Based)**:

If `setPassword` isn't available client-side, use password reset flow:

| Step | Action                   | Result                              |
| ---- | ------------------------ | ----------------------------------- |
| 1    | Click "+ Email/Password" | Show info modal                     |
| 2    | Click "Send Setup Email" | Call `resetPassword(user.email)`    |
| 3    | —                        | Email sent with password reset link |
| 4    | User clicks email link   | Redirected to password reset page   |
| 5    | User sets password       | Credential account created          |
| 6    | User returns to Settings | New credential account in list      |

**Decision Point**: Which flow to implement?

- **Modal with password fields**: Better UX, requires server-side `setPassword` endpoint
- **Email-based**: Simpler, uses existing password reset, but more steps

**Recommendation**: Use email-based flow initially (already have the UI in Security section), then upgrade to modal if needed.

---

### Flow 5: Unlink Account

**Trigger**: User clicks "Unlink" on a linked account

**Prerequisites**:

- User has more than 1 linked account
- Account is not the credential (password) account (see Flow 6 for that)

```
┌─────────────────────────────────────────────────────────────────┐
│                       UNLINK FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Click "Unlink" on Google account]                             │
│       │                                                         │
│       ▼                                                         │
│  [Show confirmation dialog]                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Unlink Google Account?                                 │    │
│  │                                                         │    │
│  │  You won't be able to sign in with Google anymore.      │    │
│  │  Your CoRATES data will not be affected.                │    │
│  │                                                         │    │
│  │  You can always link Google again later.                │    │
│  │                                                         │    │
│  │              [Cancel]              [Unlink]             │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                         │
│       ├──── Cancel ────► [Close dialog, no action]              │
│       │                                                         │
│       ▼                                                         │
│  [Click "Unlink"]                                               │
│       │                                                         │
│       ▼                                                         │
│  [Close dialog immediately]                                     │
│  [Show loading state on card: "Unlinking..."]                   │
│       │                                                         │
│       ▼                                                         │
│  [API: authClient.unlinkAccount({ providerId: 'google' })]      │
│       │                                                         │
│       ├──── Success ────► [Refetch accounts]                    │
│       │                   [Google removed from list]            │
│       │                   [Toast: "Google account unlinked"]    │
│       │                                                         │
│       └──── Error ────► [Toast: "Failed to unlink account"]     │
│                         [Account remains in list]               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Post-Unlink Behavior**:

| Scenario                        | What Happens                                         |
| ------------------------------- | ---------------------------------------------------- |
| User signs in with Google later | New user account created (not linked to old account) |
| User wants to re-link Google    | Must sign in first, then link from Settings          |
| Data from old Google account    | Still accessible (data is on user, not account)      |

**Warning for Re-linking**:
If user unlinks Google and later signs in with Google (instead of linking), they get a NEW account.

**Solution - Soft Delete with Grace Period**:

- When unlinking, mark the account record as `unlinkedAt` timestamp instead of deleting
- Keep unlinked records for 30 days
- If same provider/accountId attempts sign-in within grace period, show prompt:
  > "This Google account was previously linked to an existing CoRATES account. Would you like to reconnect to that account instead of creating a new one?"
- After 30 days, permanently delete the unlinked record
- Add this warning to unlink confirmation dialog:
  > "If you sign in with Google later without linking first, you may create a separate account."

---

### Flow 6: Unlink Credential (Password) Account

**Trigger**: User clicks "Unlink" on Email/Password account

**Special Handling**: Credential account requires different treatment because:

1. It's often the "primary" account
2. Removing it means no password-based recovery
3. 2FA may be tied to credential account

```
┌─────────────────────────────────────────────────────────────────┐
│                UNLINK CREDENTIAL FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Option A: Don't allow unlinking credential account             │
│  ────────────────────────────────────────────────────────────── │
│  - Hide "Unlink" button for credential provider                 │
│  - Show "Primary" badge instead                                 │
│  - User must use "Change Password" in Security section          │
│                                                                 │
│  Option B: Allow with extra confirmation                        │
│  ────────────────────────────────────────────────────────────── │
│  [Click "Unlink" on Email/Password]                             │
│       │                                                         │
│       ▼                                                         │
│  [Show warning dialog]                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [FiAlertTriangle] Remove Password Sign-In?             │    │
│  │                                                         │    │
│  │  This will:                                             │    │
│  │  • Disable password sign-in                             │    │
│  │  • Disable Two-Factor Authentication (if enabled)       │    │
│  │  • Remove password reset option                         │    │
│  │                                                         │    │
│  │  You'll only be able to sign in with:                   │    │
│  │  • Google (jacob@gmail.com)                             │    │
│  │                                                         │    │
│  │  Type "REMOVE" to confirm:                              │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │                                                 │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                         │    │
│  │              [Cancel]        [Remove Password]          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Recommendation**: Use Option B (allow with extra confirmation), but only when:

- User has at least one other linked provider with a verified email
- The other provider's email matches the user's primary email OR user explicitly confirms they have access to the other provider

This allows security-conscious users who prefer OAuth-only authentication to remove their password, while still preventing lockout.

---

### Flow 7: Cannot Unlink (Only Account)

**Trigger**: User has only 1 linked account and hovers/clicks "Unlink"

```
┌─────────────────────────────────────────────────────────────────┐
│                CANNOT UNLINK - ONLY ACCOUNT                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  State: User has only Google linked                             │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [Google Icon]  Google                                     │  │
│  │                jacob@gmail.com                            │  │
│  │                                                           │  │
│  │                     [Only sign-in method]     (grayed)    │  │
│  │                                                           │  │
│  │  ℹ️ Link another account to enable unlinking              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Alternative UI: Tooltip on hover                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [Google Icon]  Google                 [Unlink] (disabled) │  │
│  │                jacob@gmail.com        ─────────           │  │
│  │                                      │ Can't unlink your  │  │
│  │                                      │ only sign-in       │  │
│  │                                      │ method. Link       │  │
│  │                                      │ another account    │  │
│  │                                      │ first.             │  │
│  │                                       ─────────           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation**:

- Check `accounts.length > 1` before showing Unlink button
- If only 1 account, show disabled state with explanation
- Use Tooltip component for hover explanation

---

### Flow 8: Account Already Linked to Another User

**Trigger**: User tries to link a Google account that's already linked to a different CoRATES user

```
┌─────────────────────────────────────────────────────────────────┐
│                ACCOUNT CONFLICT FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User A: jacob@yahoo.com (signed in)                            │
│  User B: jacob@gmail.com (different CoRATES account)            │
│       │                                                         │
│       ▼                                                         │
│  [User A clicks "+ Google"]                                     │
│       │                                                         │
│       ▼                                                         │
│  [Google OAuth - picks jacob@gmail.com]                         │
│       │                                                         │
│       ▼                                                         │
│  [Better Auth checks: Is this Google account already linked?]   │
│       │                                                         │
│       ▼                                                         │
│  [Yes - linked to User B]                                       │
│       │                                                         │
│       ▼                                                         │
│  [Return error: ACCOUNT_ALREADY_LINKED]                         │
│       │                                                         │
│       ▼                                                         │
│  [Redirect back to Settings with error]                         │
│       │                                                         │
│       ▼                                                         │
│  [Show error toast]                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ❌ Cannot Link Account                                  │    │
│  │                                                         │    │
│  │  This Google account is already linked to another       │    │
│  │  CoRATES account. To use it here, first unlink it       │    │
│  │  from the other account or sign in with that account.   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Resolution Options for User**:

| Option                       | Steps                                                           |
| ---------------------------- | --------------------------------------------------------------- |
| Use different Google account | Try linking a different Google account                          |
| Unlink from other account    | Sign into User B, unlink Google, then sign into User A and link |
| Merge accounts               | Contact support to merge User A and User B (future feature)     |

**Implementation Notes**:

- Parse error code from callback URL params
- Map error codes to user-friendly messages
- Consider showing different toast styles for different error types

---

### Flow 9: OAuth Popup Blocked

**Trigger**: Browser blocks the OAuth popup

```
┌─────────────────────────────────────────────────────────────────┐
│                POPUP BLOCKED FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Click "+ Google"]                                             │
│       │                                                         │
│       ▼                                                         │
│  [Browser blocks popup]                                         │
│       │                                                         │
│       ▼                                                         │
│  [Nothing happens OR brief redirect attempt]                    │
│       │                                                         │
│       ▼                                                         │
│  [Button returns to normal state after timeout]                 │
│       │                                                         │
│       ▼                                                         │
│  [User confused - no feedback]                                  │
│                                                                 │
│  BETTER APPROACH:                                               │
│  ────────────────────────────────────────────────────────────── │
│                                                                 │
│  Better Auth uses redirect (not popup) by default               │
│  → This flow is less relevant                                   │
│                                                                 │
│  But if using popup mode:                                       │
│  - Detect popup blocked via window reference                    │
│  - Show toast: "Please allow popups for this site"              │
│  - Offer fallback: "Or click here to open in new tab"           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Note**: Better Auth uses full-page redirect by default, so popup blocking is not typically an issue. This flow is included for completeness.

---

### Flow 10: Session Expired During Link

**Trigger**: User's session expires while on Google OAuth page

```
┌─────────────────────────────────────────────────────────────────┐
│                SESSION EXPIRED FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [User on Settings page, clicks "+ Google"]                     │
│       │                                                         │
│       ▼                                                         │
│  [Redirect to Google OAuth]                                     │
│       │                                                         │
│       ▼                                                         │
│  [User takes a long time, session expires]                      │
│       │                                                         │
│       ▼                                                         │
│  [User authorizes in Google]                                    │
│       │                                                         │
│       ▼                                                         │
│  [Redirect back to CoRATES]                                     │
│       │                                                         │
│       ▼                                                         │
│  [Better Auth tries to link - no valid session]                 │
│       │                                                         │
│       ├──── If same email ────► Auto sign-in & link succeeds    │
│       │                                                         │
│       └──── If different email ────► Error: Not authenticated   │
│                                       [Redirect to sign-in]     │
│                                       [Toast: "Session expired, │
│                                        please sign in again"]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Mitigation**:

- Sessions are 7 days, so this is rare
- After sign-in, redirect user back to Settings page
- Consider storing "pending link action" in localStorage

---

### Flow 11: Loading Linked Accounts (Initial Page Load)

**Trigger**: User navigates to Settings page

```
┌─────────────────────────────────────────────────────────────────┐
│                INITIAL LOAD FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Navigate to /settings]                                        │
│       │                                                         │
│       ▼                                                         │
│  [Page renders immediately with cached/synced data]             │
│       │                                                         │
│       ▼                                                         │
│  [API: authClient.listAccounts()] - usually instant from cache  │
│       │                                                         │
│       ├──── Success ────► [Render account cards]                │
│       │                                                         │
│       └──── Error ────► [Show inline error + retry]             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Note**: Since CoRATES is local-first with fast cached data, no loading skeletons are needed for initial page load. Data should be available immediately or within milliseconds.

---

## User Flow Insights & Revisions

Based on documenting these flows, here are key implementation insights:

### Insight 1: Error Handling from OAuth Callbacks

OAuth redirects return error info via URL params. Need to:

- Parse `?error=...` and `?error_description=...` on page load
- Show appropriate toast based on error code
- Clear error params from URL after displaying

**Add to LinkedAccountsSection.jsx**:

```jsx
onMount(() => {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (error) {
    showToast.error('Link Failed', getErrorMessage(error));
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  }
});
```

### Insight 2: Credential Account Should Be Special

- Don't show "Unlink" for credential accounts
- Show "Primary" badge instead
- Password management stays in Security section (already exists)

### Insight 3: Add Password Flow Already Exists

The Security section already has "Add Password" functionality that sends a reset email. No need to duplicate - just ensure it creates a credential account when used.

### Insight 4: Re-linking After Unlink Creates New Account

This is a potential UX trap. Consider:

- Warning in unlink confirmation: "If you sign in with Google later without linking first, a new account will be created"
- Or: Detect returning provider and offer to link instead of creating new account

### Insight 5: Provider Icons Needed

Must add to `/public/logos/`:

- `google.svg` (may exist)
- `orcid.svg` (need to add)

### Insight 6: ORCID Display Different from Google

ORCID shows ID instead of email. Update `AccountProviderCard` to handle this:

```jsx
const displayId = () => {
  if (account.providerId === 'orcid') {
    return formatOrcidId(account.accountId); // "0000-0001-2345-6789"
  }
  return account.email || account.accountId;
};
```

---

## Phase 2: API Layer

### 2.1 New API Endpoints (Optional - Better Auth provides these)

Better Auth already exposes these endpoints via the auth client:

- `authClient.listAccounts()` - List all linked accounts
- `authClient.linkSocial({ provider, callbackURL })` - Link a social provider
- `authClient.unlinkAccount({ providerId, accountId? })` - Unlink a provider

### 2.2 Custom Endpoint: Account Summary

**File**: `packages/workers/src/routes/users.js`

Add a new endpoint that returns a user-friendly summary of linked accounts:

```js
/**
 * GET /api/users/me/accounts
 * Returns linked accounts with display-friendly information
 */
userRoutes.get('/me/accounts', async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);

  const accounts = await db
    .select({
      id: account.id,
      providerId: account.providerId,
      accountId: account.accountId,
      createdAt: account.createdAt,
    })
    .from(account)
    .where(eq(account.userId, user.id));

  // Map to user-friendly format
  const linkedAccounts = accounts.map(acc => ({
    id: acc.id,
    provider: acc.providerId,
    providerAccountId: acc.accountId,
    linkedAt: acc.createdAt,
    displayName: getProviderDisplayName(acc.providerId),
    icon: getProviderIcon(acc.providerId),
    canUnlink: accounts.length > 1, // Can't unlink if only 1 account
  }));

  return c.json({
    accounts: linkedAccounts,
    hasPassword: accounts.some(a => a.providerId === 'credential'),
    primaryEmail: user.email,
  });
});
```

---

## Phase 3: Frontend Components

### 3.1 File Structure

```
packages/web/src/components/profile-ui/
├── SettingsPage.jsx              # Main settings page (existing)
├── LinkedAccountsSection.jsx     # NEW: Linked accounts management
├── LinkAccountModal.jsx          # NEW: Modal to link new provider
├── AccountProviderCard.jsx       # NEW: Single provider card component
├── GoogleDriveSettings.jsx       # Existing (keep separate - this is for Drive API access, not auth)
└── TwoFactorSetup.jsx            # Existing
```

### 3.2 LinkedAccountsSection Component

**Purpose**: Display all linked accounts and allow linking/unlinking

**Features**:

- List all currently linked providers
- Show which email each provider uses
- "Link Account" button for each available provider
- "Unlink" button (disabled if only 1 account linked)
- Warning modal before unlinking
- Success/error toasts

**UI Wireframe**:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔗 Linked Accounts                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [Google Icon]  Google                          [Unlink]   │  │
│  │                jacob@gmail.com                            │  │
│  │                Linked on Dec 10, 2025                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [ORCID Icon]   ORCID                           [Unlink]   │  │
│  │                0000-0001-2345-6789                        │  │
│  │                Linked on Dec 12, 2025                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [Email Icon]   Email & Password               [Primary]   │  │
│  │                jacob@yahoo.com                            │  │
│  │                Added on Dec 8, 2025                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                 │
│  Link another account:                                          │
│                                                                 │
│  [+ Google]  [+ ORCID]  [+ Email/Password]                     │
│                                                                 │
│  ℹ️ Linking accounts allows you to sign in using any method.    │
│     Your data and projects remain accessible regardless of      │
│     which method you use to sign in.                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Component: LinkedAccountsSection.jsx

```jsx
/**
 * LinkedAccountsSection - Manages linked authentication providers
 *
 * Features:
 * - Lists all linked accounts (Google, ORCID, credential)
 * - Link new providers
 * - Unlink providers (with safety check)
 * - Shows provider-specific info (email, ORCID ID, etc.)
 */

import { createSignal, createResource, For, Show } from 'solid-js';
import { FiLink, FiMail } from 'solid-icons/fi';
import { authClient } from '@api/auth-client.js';
import { showToast } from '@components/zag/Toast.jsx';
import Dialog from '@components/zag/Dialog.jsx';
import AccountProviderCard from './AccountProviderCard.jsx';

// Provider metadata
const PROVIDERS = {
  google: {
    id: 'google',
    name: 'Google',
    icon: '/logos/google.svg',
    description: 'Sign in with your Google account',
  },
  orcid: {
    id: 'orcid',
    name: 'ORCID',
    icon: '/logos/orcid.svg',
    description: 'Link your ORCID researcher ID',
  },
  credential: {
    id: 'credential',
    name: 'Email & Password',
    icon: null, // Use FiMail icon
    description: 'Sign in with email and password',
  },
};

export default function LinkedAccountsSection() {
  // Fetch linked accounts
  const [accounts, { refetch }] = createResource(fetchLinkedAccounts);

  // UI state
  const [unlinkingId, setUnlinkingId] = createSignal(null);
  const [linkingProvider, setLinkingProvider] = createSignal(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = createSignal(false);
  const [accountToUnlink, setAccountToUnlink] = createSignal(null);

  async function fetchLinkedAccounts() {
    const { data, error } = await authClient.listAccounts();
    if (error) throw error;
    return data;
  }

  async function handleLinkProvider(providerId) {
    setLinkingProvider(providerId);
    try {
      await authClient.linkSocial({
        provider: providerId,
        callbackURL: window.location.href,
      });
    } catch (err) {
      showToast.error('Link Failed', err.message || 'Failed to link account');
      setLinkingProvider(null);
    }
  }

  async function handleUnlink(account) {
    setAccountToUnlink(account);
    setShowUnlinkConfirm(true);
  }

  async function confirmUnlink() {
    const account = accountToUnlink();
    if (!account) return;

    setUnlinkingId(account.id);
    setShowUnlinkConfirm(false);

    try {
      await authClient.unlinkAccount({
        providerId: account.providerId,
        accountId: account.id,
      });
      showToast.success('Unlinked', `${PROVIDERS[account.providerId]?.name || account.providerId} has been unlinked`);
      refetch();
    } catch (err) {
      showToast.error('Unlink Failed', err.message || 'Failed to unlink account');
    } finally {
      setUnlinkingId(null);
      setAccountToUnlink(null);
    }
  }

  // Determine which providers can be linked
  const availableProviders = () => {
    const linked = new Set(accounts()?.map(a => a.providerId) || []);
    return Object.values(PROVIDERS).filter(p => !linked.has(p.id));
  };

  const canUnlink = () => (accounts()?.length || 0) > 1;

  return (
    <div class='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6'>
      {/* Header */}
      <div class='px-6 py-4 border-b border-gray-200 bg-gray-50'>
        <div class='flex items-center space-x-2'>
          <FiLink class='w-5 h-5 text-gray-600' />
          <h2 class='text-lg font-medium text-gray-900'>Linked Accounts</h2>
        </div>
        <p class='text-sm text-gray-500 mt-1'>Manage how you sign in to CoRATES</p>
      </div>

      <div class='p-6 space-y-4'>
        {/* Linked accounts list - renders immediately from cache */}
        <Show when={accounts()}>
          <div class='space-y-3'>
            <For each={accounts()}>
              {account => (
                <AccountProviderCard
                  account={account}
                  provider={PROVIDERS[account.providerId]}
                  canUnlink={canUnlink()}
                  unlinking={unlinkingId() === account.id}
                  onUnlink={() => handleUnlink(account)}
                />
              )}
            </For>
          </div>
        </Show>

        {/* Available providers to link */}
        <Show when={availableProviders().length > 0}>
          <div class='border-t border-gray-200 pt-4 mt-4'>
            <p class='text-sm font-medium text-gray-700 mb-3'>Link another account:</p>
            <div class='flex flex-wrap gap-2'>
              <For each={availableProviders()}>
                {provider => (
                  <button
                    onClick={() => handleLinkProvider(provider.id)}
                    disabled={linkingProvider() === provider.id}
                    class='inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50'
                  >
                    <Show when={provider.icon} fallback={<FiMail class='w-4 h-4' />}>
                      <img src={provider.icon} alt='' class='w-4 h-4' />
                    </Show>
                    {linkingProvider() === provider.id ? 'Linking...' : `+ ${provider.name}`}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Info box */}
        <div class='bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4'>
          <p class='text-sm text-blue-800'>
            <strong>Why link accounts?</strong> Linking multiple sign-in methods gives you backup options if you lose
            access to one. Your projects and data are shared across all linked accounts.
          </p>
        </div>
      </div>

      {/* Unlink confirmation dialog */}
      <Dialog open={showUnlinkConfirm()} onOpenChange={setShowUnlinkConfirm} title='Unlink Account?'>
        <p class='text-gray-600 mb-4'>
          Are you sure you want to unlink your <strong>{PROVIDERS[accountToUnlink()?.providerId]?.name}</strong>{' '}
          account? You won't be able to sign in using this method unless you link it again.
        </p>
        <div class='flex justify-end gap-3'>
          <button
            onClick={() => setShowUnlinkConfirm(false)}
            class='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200'
          >
            Cancel
          </button>
          <button
            onClick={confirmUnlink}
            class='px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700'
          >
            Unlink
          </button>
        </div>
      </Dialog>
    </div>
  );
}
```

### 3.4 Component: AccountProviderCard.jsx

```jsx
/**
 * AccountProviderCard - Displays a single linked provider
 */

import { Show } from 'solid-js';
import { FiMail, FiTrash2, FiCheck } from 'solid-icons/fi';

export default function AccountProviderCard(props) {
  // Note: Don't destructure props in SolidJS - it breaks reactivity

  // Format the account identifier for display
  const displayId = () => {
    if (props.account.providerId === 'credential') {
      return props.account.email || 'Email/Password';
    }
    if (props.account.providerId === 'orcid') {
      return props.account.accountId; // ORCID ID like 0000-0001-2345-6789
    }
    return props.account.email || props.account.accountId;
  };

  const linkedDate = () => {
    if (!props.account.createdAt) return null;
    return new Date(props.account.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div class='flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200'>
      <div class='flex items-center gap-3'>
        {/* Provider icon */}
        <div class='p-2 bg-white rounded-lg border border-gray-200'>
          <Show when={props.provider?.icon} fallback={<FiMail class='w-5 h-5 text-gray-600' />}>
            <img src={props.provider.icon} alt={props.provider?.name} class='w-5 h-5' />
          </Show>
        </div>

        {/* Provider info */}
        <div>
          <div class='flex items-center gap-2'>
            <p class='font-medium text-gray-900'>{props.provider?.name || props.account.providerId}</p>
            <Show when={props.account.providerId === 'credential'}>
              <span class='inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full'>
                <FiCheck class='w-3 h-3' />
                Primary
              </span>
            </Show>
          </div>
          <p class='text-sm text-gray-500'>{displayId()}</p>
          <Show when={linkedDate()}>
            <p class='text-xs text-gray-400 mt-0.5'>Linked on {linkedDate()}</p>
          </Show>
        </div>
      </div>

      {/* Unlink button */}
      <Show when={props.canUnlink && props.account.providerId !== 'credential'}>
        <button
          onClick={props.onUnlink}
          disabled={props.unlinking}
          class='inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50'
        >
          <FiTrash2 class='w-4 h-4' />
          {props.unlinking ? 'Unlinking...' : 'Unlink'}
        </button>
      </Show>

      {/* Can't unlink message */}
      <Show when={!props.canUnlink}>
        <span class='text-xs text-gray-400'>Can't unlink (only sign-in method)</span>
      </Show>
    </div>
  );
}
```

---

## Phase 4: Settings Page Integration

### 4.1 Update SettingsPage.jsx

Replace the "Connected Services" section with two sections:

1. **Linked Accounts** - For authentication methods (new)
2. **Connected Services** - For third-party integrations like Google Drive (existing)

```jsx
// In SettingsPage.jsx, add import:
import LinkedAccountsSection from './LinkedAccountsSection.jsx';

// Then in the JSX, add before "Connected Services":
<LinkedAccountsSection />;

// Rename "Connected Services" to "Integrations" and keep GoogleDriveSettings there
```

### 4.2 Updated Settings Page Structure

```
Settings
├── Billing & Subscription (link to /settings/billing)
├── Linked Accounts (NEW - authentication methods)
│   ├── Google
│   ├── ORCID
│   └── Email/Password
├── Integrations (renamed from "Connected Services")
│   └── Google Drive (for PDF import)
├── Notifications
├── Appearance
├── Security
│   ├── Add/Change Password
│   └── Two-Factor Authentication
├── Privacy
└── Danger Zone (delete account)
```

---

## Phase 5: Edge Cases and Security

### 5.1 Email Conflicts

**Scenario**: User tries to link a Google account with a different email than their primary.

**Behavior**:

- By default, this is **allowed** (user must be authenticated first)
- The linked account's email does NOT become the primary email
- User's primary email remains unchanged

**Optional Enhancement**: Add `allowDifferentEmails: true` to config if not already implicit.

### 5.2 Prevent Lockout

**Rule**: Users cannot unlink their only authentication method.

**Implementation**:

- Backend: Better Auth enforces this by default
- Frontend: Disable unlink button when only 1 account exists
- Show tooltip: "This is your only sign-in method"

### 5.2.1 Session Behavior on Unlink

**Decision**: Keep all existing sessions active when a provider is unlinked.

**Rationale**:

- Sessions are tied to the user, not the provider
- User is already authenticated; unlinking doesn't change their identity
- Simpler implementation, no session tracking per provider needed
- User can manually "Sign out everywhere" from Security section if desired

**Note**: The unlinked provider can no longer be used to create NEW sessions.

### 5.3 Password Requirements for Credential Linking

**Scenario**: User signed up via OAuth wants to add email/password.

**Flow**:

1. User clicks "Add Email/Password"
2. System sends password reset email to their primary email
3. User clicks link and sets password
4. New "credential" account is created and linked

**Alternative Flow** (more seamless):

1. User clicks "Add Password"
2. Modal opens with password fields
3. API calls `auth.api.setPassword()` server-side
4. Credential account is created

### 5.4 ORCID Email Verification

**Issue**: ORCID doesn't always verify email addresses.

**Solution**:

- ORCID is NOT in `trustedProviders`
- Auto-linking only happens if ORCID returns `emailVerified: true`
- Otherwise, user must manually link while authenticated

---

## Phase 5B: Accessibility Considerations

### Focus Management

- Unlink confirmation dialog must trap focus when open
- Return focus to the triggering button when dialog closes
- Success/error toasts should use `role="alert"` for screen reader announcement

### Keyboard Navigation

- All provider cards and buttons must be keyboard accessible
- Link/Unlink buttons should have clear accessible labels:
  ```jsx
  <button aria-label={`Unlink ${props.provider?.name} account`}>Unlink</button>
  ```

### Screen Reader Support

- Provider cards should announce full context: "Google account, jacob@gmail.com, linked on December 10, 2025"
- Disabled unlink buttons should explain why: `aria-describedby` pointing to explanation text

---

## Phase 5C: Error Handling Utilities

### Error Code Mapping

**File**: `packages/web/src/lib/account-linking-errors.js`

```js
export const LINK_ERROR_MESSAGES = {
  ACCOUNT_ALREADY_LINKED:
    'This account is already linked to another CoRATES account. Unlink it from the other account first, or use a different account.',
  OAUTH_ERROR: 'Failed to connect to the provider. Please try again.',
  OAUTH_CANCELLED: null, // Silent - user cancelled intentionally
  EMAIL_NOT_VERIFIED: 'Please verify your email with this provider before linking.',
  SESSION_EXPIRED: 'Your session expired. Please sign in again.',
  NETWORK_ERROR: 'Connection error. Please check your internet and try again.',
};

export function getLinkErrorMessage(code) {
  if (code in LINK_ERROR_MESSAGES) {
    return LINK_ERROR_MESSAGES[code];
  }
  return 'An unexpected error occurred. Please try again.';
}
```

### Network Error Recovery

When unlink fails due to network error:

1. Keep the confirmation dialog open (don't close prematurely)
2. Show error message inline in the dialog
3. Change "Unlink" button to "Retry"
4. Only close dialog on success or user cancellation

```jsx
// In confirmUnlink function
try {
  await authClient.unlinkAccount({ ... });
  setShowUnlinkConfirm(false); // Only close on success
  showToast.success(...);
} catch (err) {
  setUnlinkError(err.message); // Show error in dialog, don't close
}
```

---

## Phase 5D: Security Notifications (Recommended)

Send email notifications when accounts are linked or unlinked:

**On Link**:

> Subject: New sign-in method added to your CoRATES account
>
> A new sign-in method (Google - jacob@gmail.com) was added to your account.
> If this wasn't you, please secure your account immediately.

**On Unlink**:

> Subject: Sign-in method removed from your CoRATES account
>
> Google sign-in was removed from your account. You can no longer use this method to sign in.

This can be implemented via Better Auth hooks or a custom endpoint wrapper.

---

## Phase 6: Database Considerations

### 6.1 Current Schema (No Changes Needed)

The existing `account` table already supports multiple providers per user:

```sql
-- account table (already exists)
id TEXT PRIMARY KEY,
accountId TEXT NOT NULL,      -- Provider's user ID
providerId TEXT NOT NULL,     -- 'google', 'orcid', 'credential'
userId TEXT REFERENCES user,  -- Foreign key to user
accessToken TEXT,
refreshToken TEXT,
...
```

### 6.2 Query for Admin Dashboard

To identify users with multiple linked accounts:

```sql
SELECT
  u.id,
  u.email,
  COUNT(a.id) as account_count,
  GROUP_CONCAT(a.providerId) as providers
FROM user u
LEFT JOIN account a ON a.userId = u.id
GROUP BY u.id
HAVING account_count > 1;
```

---

## Phase 7: Testing Plan

### 7.1 Manual Test Cases

| #   | Test Case                                              | Expected Result                            |
| --- | ------------------------------------------------------ | ------------------------------------------ |
| 1   | Sign up with email, then link Google (same email)      | Single user, 2 accounts                    |
| 2   | Sign up with email, then link Google (different email) | Single user, 2 accounts                    |
| 3   | Sign up with Google, then add password                 | Single user, 2 accounts                    |
| 4   | Try to unlink only account                             | Button disabled, shows tooltip             |
| 5   | Unlink Google when password exists                     | Success, 1 account remains                 |
| 6   | Sign in with Google after unlinking                    | Creates new user (different from original) |
| 7   | Link ORCID with unverified email                       | Should still link (user is authenticated)  |

### 7.2 Security Test Cases

| #   | Test Case                                   | Expected Result                          |
| --- | ------------------------------------------- | ---------------------------------------- |
| 1   | Try to link account while not authenticated | 401 error                                |
| 2   | Try to unlink via API manipulation          | Blocked if only 1 account                |
| 3   | Attempt account takeover via same email     | Only works if email verified by provider |

---

## Phase 8: Future Enhancements

### 8.1 Email Address Management

- Allow users to add additional emails
- Choose primary email for notifications
- Verify additional emails before use

### 8.2 Account Merge Tool (Admin)

- Admin can manually merge duplicate accounts
- Transfers all projects/data to target account
- Deletes source account

### 8.3 Session Management

- Show active sessions across devices
- "Sign out everywhere" button
- Show which provider was used for each session

### 8.4 Social Account Insights

- Show last sign-in for each provider
- Show which provider was used most recently
- Suggest removing unused providers

---

## Implementation Checklist

- [x] Phase 1: Backend configuration (account linking enabled)
- [ ] Phase 2: API layer
  - [ ] Test `listAccounts` endpoint works
  - [ ] Add `unlinkedAt` column to account table for soft delete
- [ ] Phase 3: Frontend components
  - [ ] Create `LinkedAccountsSection.jsx`
  - [ ] Create `AccountProviderCard.jsx`
  - [ ] Create `account-linking-errors.js` utility
  - [ ] Add provider icons to `/public/logos/` (google.svg, orcid.svg)
  - [ ] Handle OAuth callback errors (parse URL params, show toast)
  - [ ] Button loading states ("Linking...", "Unlinking...")
  - [ ] Network error recovery (keep dialog open on failure)
- [ ] Phase 4: Settings page integration
  - [ ] Import and add `LinkedAccountsSection`
  - [ ] Rename "Connected Services" to "Integrations"
  - [ ] Credential account shows "Primary" badge (unlink with extra confirmation)
- [ ] Phase 5: Test edge cases
  - [ ] Link Google (same email) - auto-link works
  - [ ] Link Google (different email) - manual link works
  - [ ] Link ORCID - displays ORCID ID correctly
  - [ ] Unlink with confirmation
  - [ ] Cannot unlink only account (disabled state)
  - [ ] Account conflict error handling
  - [ ] Session expired during link
  - [ ] Re-linking within grace period shows reconnect prompt
- [ ] Phase 5B: Accessibility
  - [ ] Focus management in dialogs
  - [ ] Keyboard navigation for all actions
  - [ ] Screen reader labels and descriptions
- [ ] Phase 5C: Error handling
  - [ ] Error code mapping utility
  - [ ] Network error recovery UX
- [ ] Phase 5D: Security notifications (optional)
  - [ ] Email on account link
  - [ ] Email on account unlink
- [ ] Phase 6: Update admin dashboard (if exists)
- [ ] Documentation updates

---

## Revised Notes (Post User Flow Analysis)

- **Google Drive Settings**: Keep this separate from Linked Accounts. Google Drive connection is for the Drive API (importing PDFs), which requires additional scopes. A user could have Google linked for auth but not have Drive connected.

- **Magic Link**: Magic link sign-in creates a session but doesn't create a "credential" account. Users who only use magic link have their account created without a password. They would need to use "Add Password" in Security section to add credential-based sign-in.

- **Provider Icons**: Need to add `/public/logos/orcid.svg` if not already present. Google logo should exist from Drive integration.

- **Credential Account is Special**: Unlike OAuth providers, the credential (password) account should not be unlinkable from the Linked Accounts UI. Show a "Primary" badge and manage passwords through the Security section.

- **OAuth Error Handling**: Must parse URL params on Settings page load to catch errors returned from OAuth callbacks. Map error codes to friendly messages.

- **Re-linking Trap**: If user unlinks Google and later signs in with Google (not linking), they create a new account. Consider adding this warning to unlink confirmation dialog.

- **ORCID Display**: Show ORCID ID (e.g., `0000-0001-2345-6789`) instead of email, as ORCID may not return email and researchers recognize their ORCID ID.

- **Add Password Flow**: Already exists in Security section. When user completes password reset flow, a credential account is created and linked. No duplication needed in Linked Accounts section - the "+ Email/Password" button can redirect to Security section or trigger the existing flow.
