# Contributing to CoRATES

## Prerequisites

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en/download) v24.0.0 or higher
- [pnpm](https://pnpm.io/installation) v10.0.0 or higher

```sh
# Recommended pnpm install if you have node
npm install -g pnpm
```

## Project Structure

This is a pnpm monorepo with the following packages:

| Package            | Description                            |
| ------------------ | -------------------------------------- |
| `packages/web`     | React/TanStack Start frontend          |
| `packages/workers` | Cloudflare Workers backend (Hono)      |
| `packages/ui`      | Shared UI component library            |
| `packages/shared`  | Shared error definitions and utilities |

## Quick Start

1. **Fork and clone the repository:**

   ```sh
   git clone https://github.com/YOUR_USERNAME/corates.git
   cd corates
   ```

2. **Install dependencies:**

   ```sh
   # IMPORTANT: npm will NOT work as CoRATES relies on special pnpm workspace monorepo features
   pnpm i
   ```

3. **Set up environment files:**

   ```sh
   cp packages/web/.env.example packages/web/.env
   ```

4. **Start development servers:**

   ```sh
   # Run the dev server
   turbo dev
   ```

5. **Access the application:**
   - Frontend Landing: http://localhost:3010
   - Frontend SPA: http://localhost:5173
   - API: http://localhost:8787
   - Docs: http://localhost:8787/docs [API Docs](#api-documentation)

### Stripe Local Development

Prices are addressed by Stripe lookup key (`team_monthly`, `team_yearly`, `lab_monthly`, `lab_yearly`), so local development needs no price ids. The setup script creates the products and prices in your Stripe test account from `@corates/shared/plans`.

1. Get a test secret key from https://dashboard.stripe.com/test/apikeys
2. From `packages/web`, run `STRIPE_SECRET_KEY=sk_test_... pnpm stripe:setup`. It writes the key to `packages/web/.env`. Re-run it after changing prices in `@corates/shared/plans`; it moves each lookup key to a new price.
3. Install the Stripe CLI (https://stripe.com/docs/stripe-cli) and run `stripe login`.
4. Forward webhooks to the app with `stripe listen --forward-to <app url>/api/auth/stripe/webhook`. `pnpm dev:test` in `packages/web` starts this listener for you against port 3010.
5. Copy the `whsec_...` value the listener prints into `packages/web/.env` as `STRIPE_WEBHOOK_SECRET_AUTH`. It stays valid for that Stripe CLI session.

## Development Workflow

### Code Quality

Before submitting a PR, ensure your code passes linting and formatting:

```sh
pnpm lint        # Check for linting errors
pnpm lint:fix    # Auto-fix linting issues
pnpm format      # Format code with Prettier
```

A GitHub Action automatically runs Prettier on non-main branches and commits any formatting changes.
This means you may need to pull any applied formatting changes after you push if you did not format beforehand.

### Testing

```sh
pnpm test        # Run all tests
pnpm test:ui     # Run tests with browser UI (broken sort of)
```

Tests use Vitest. Place test files alongside source files in `__tests__/` using the pattern `*.test.{js,jsx,ts,tsx}`.

See `packages/docs/guides/testing.md` for detailed testing guidelines.

### Submitting Changes

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm lint` and `pnpm test`
4. Push your branch and open a Pull Request

## API Documentation

Run the following to generate OpenAPI docs (required to view them at http://localhost:8787/docs):

```sh
pnpm openapi
```

For secured endpoints, sign in via the frontend first (http://localhost:3010). The API docs will use your authenticated session.

## AI Agent Integration

This repository is optimized for AI agent workflows. It includes copilot-instructions, claude instructions, and cursor instructions.
If asked to create a plan file, agents will create them in `packages/docs/audits`.

## Useful Commands

| Command                                           | Description                       |
| ------------------------------------------------- | --------------------------------- |
| `pnpm dev`                                        | Start frontend dev server         |
| `pnpm dev:workers`                                | Start backend workers             |
| `pnpm build`                                      | Build all packages                |
| `pnpm test`                                       | Run all tests                     |
| `pnpm lint`                                       | Run ESLint                        |
| `pnpm format`                                     | Run Prettier                      |
| `pnpm clear-workers`                              | Clear local worker storage        |
| `pnpm logs`                                       | View worker logs                  |
| `pnpm docs`                                       | View architecture documentation   |
| `pnpm loc`                                        | Lines of code report              |
| `pnpm user:make-admin:local -- email@example.com` | Make a user admin (local)         |
| `pnpm stripe:setup`                               | Setup Stripe test products/prices |

## Code Style

- Follow existing patterns in the codebase
- Remove development console logs before PRs

See [style-guide.md](style-guide.md) for detailed conventions.

## Architecture Documentation

```sh
pnpm run docs
```

This serves the architecture documentation at http://localhost:8080.
Note: these docs are not the Open API docs which are served by the Workers backend.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](.github/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to support@corates.org.

## Security

If you discover a security vulnerability, please review our [Security Policy](.github/SECURITY.md) and report it responsibly to support@corates.org rather than opening a public issue.

## Need Help?

- Check existing issues or open a new one
- Review the architecture docs with `pnpm run docs`
- Review the API docs by running the backend with `pnpm dev:workers`, generating openapi schema with `pnpm openapi` and visiting http://localhost:8787/docs
- You may notice that the package.json file acts like a folder in your IDE, this is configured by the .vscode settings.
