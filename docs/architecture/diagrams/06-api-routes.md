# API Routes Overview

Backend API structure and middleware.

```mermaid
flowchart LR
    subgraph API["Hono API (/api)"]
        direction TB
        auth["/auth/*<br/>BetterAuth"]
        projects["/projects/*"]
        members["/members/*"]
        users["/users/*"]
        pdfs["/pdfs/*"]
        billing["/billing/*"]
        admin["/admin/*"]
        avatars["/avatars/*"]
    end

    subgraph Middleware
        CORS
        SecurityHeaders
        requireAuth
        CSRF[requireTrustedOrigin]
    end

    Client -->|"Request"| Middleware
    Middleware --> API

    projects --> ProjectDoc
    pdfs --> R2[(R2 Storage)]
    auth --> D1[(D1 Database)]
```

## Middleware Stack

| Middleware             | Purpose                       |
| ---------------------- | ----------------------------- |
| `CORS`                 | Cross-origin request handling |
| `securityHeaders`      | Security headers (CSP, etc.)  |
| `requireAuth`          | JWT/session validation        |
| `requireTrustedOrigin` | CSRF protection               |

## API Endpoints

### Authentication (`/auth/*`)

Handled by BetterAuth. Includes signin, signup, session management.

### Projects (`/projects/*`)

- `GET /projects` - List user's projects
- `POST /projects` - Create new project
- `GET /projects/:id` - Get project details
- `DELETE /projects/:id` - Delete project

### PDFs (`/pdfs/*`)

- `POST /pdfs/upload` - Upload PDF to R2
- `GET /pdfs/:key` - Download PDF from R2
- `DELETE /pdfs/:key` - Remove PDF

### Billing (`/billing/*`)

Stripe integration for subscriptions and payments.

### Admin (`/admin/*`)

Admin-only endpoints for user management and system stats.
