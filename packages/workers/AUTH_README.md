# Authentication Setup for Corates

## Overview

This setup provides comprehensive user authentication using BetterAuth with email/password authentication, storing users in D1 database, and protecting all Durable Objects and Workers endpoints.

## Features

- Email/password authentication with BetterAuth
- User data stored in D1 database
- Session management with secure tokens
- Protected Durable Objects (ChatRoom, CollaborativeDoc, UserSession)
- Auth middleware for all API endpoints
- WebSocket authentication support

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/verify` - Verify current session

### Protected Resources

- `GET|POST /api/rooms/{id}` - Chat room access (requires auth)
- `GET|PUT|POST|DELETE /api/sessions/{id}` - User session management (requires auth)
- `GET /api/docs/{id}` - Document collaboration (requires auth)
- `POST /api/media/upload` - File upload (requires auth)
- `GET /api/db/users` - Get users list (requires auth)

## Usage Examples

### Register a new user

```bash
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "username": "johndoe",
    "displayName": "John Doe"
  }'
```

### Login

```bash
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'
```

### Access protected resource

```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### WebSocket Authentication

For WebSocket connections, you can authenticate in two ways:

1. **Via URL parameter:**

```javascript
const ws = new WebSocket('ws://localhost:8787/api/rooms/general?token=YOUR_SESSION_TOKEN');
```

2. **Via initial message:**

```javascript
const ws = new WebSocket('ws://localhost:8787/api/rooms/general');
ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: 'auth',
      token: 'YOUR_SESSION_TOKEN',
    }),
  );
};
```

## Database Schema

The authentication system uses these tables:

- `users` - User profiles with email/password
- `auth_sessions` - Active user sessions
- `auth_accounts` - OAuth provider accounts (future)
- `email_verification_tokens` - Email verification tokens
- `password_reset_tokens` - Password reset tokens

## Security Features

1. **Password Hashing**: Uses BetterAuth's secure password hashing
2. **Session Tokens**: Secure JWT-like tokens for session management
3. **CORS Protection**: Proper CORS headers with credential support
4. **Auth Middleware**: Every Durable Object checks authentication
5. **User Isolation**: Users can only access their own sessions

## Development Setup

1. Install dependencies:

```bash
cd packages/workers
pnpm install
```

2. Run database migration:

```bash
pnpm run db:migrate
```

3. Start development server:

```bash
pnpm run dev
```

4. Test the setup:

```bash
# Run migration
curl -X POST http://localhost:8787/api/db/migrate

# Register a user
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","username":"testuser"}'

# Login
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## Production Deployment

1. Update `wrangler.toml` with production secrets:
   - Set `AUTH_SECRET` to a long, random string
   - Set `AUTH_BASE_URL` to your production domain
   - Update database and bucket IDs

2. Deploy:

```bash
pnpm run deploy
```

## Configuration

Environment variables in `wrangler.toml`:

- `AUTH_SECRET` - Secret key for token signing (change in production!)
- `AUTH_BASE_URL` - Base URL for your application
- `ENVIRONMENT` - Current environment (development/production)

## Next Steps

- Add email verification
- Implement OAuth providers (Google, GitHub, etc.)
- Add role-based access control
- Implement rate limiting
- Add audit logging
