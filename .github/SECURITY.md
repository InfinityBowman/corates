# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in CoRATES, please report it responsibly.

- **Do not** open a public GitHub issue for security-related concerns.
- Email details to **support@corates.org** (or contact the maintainer directly if unavailable).
- Include a clear description, steps to reproduce, and potential impact if possible.

We will acknowledge receipt and work to address the issue as quickly as possible.

## Scope

This policy applies to:

- The CoRATES web application
- Cloudflare Workers and Durable Objects
- Client-side synchronization and storage logic
- PDF handling and storage

## Data Protection

- Project data is isolated per workspace
- Authentication and authorization are enforced at the API level
- No third-party analytics are required for core functionality
- Offline data is stored locally and synchronized securely when online

## Responsible Disclosure

We appreciate responsible disclosure and ask that vulnerabilities are not publicly disclosed until a fix is available.
