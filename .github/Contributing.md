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
| `packages/web`     | Main SolidJS frontend application      |
| `packages/workers` | Cloudflare Workers backend (Hono)      |
| `packages/landing` | Landing/marketing site (SolidJS Start) |
| `packages/ui`      | Shared UI component library (Zag.js)   |
| `packages/shared`  | Shared error definitions and utilities |
| `packages/mcp`     | MCP server for AI agent integration    |

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
   cp packages/workers/.env.example packages/workers/.env
   cp packages/web/.env.example packages/web/.env
   cp packages/landing/.env.example packages/landing/.env
   ```

4. **Start development servers:**

   ```sh
   # Terminal 1: Start the frontend
   pnpm dev:front

   # Terminal 2: Start the Cloudflare Workers backend
   pnpm dev:workers
   ```

5. **Access the application:**
   - Frontend Landing: http://localhost:3010
   - Frontend SPA: http://localhost:5173
   - API: http://localhost:8787
   - Docs: http://localhost:8787/docs [API Docs](#api-documentation)

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

See [packages/web/TESTING.md](packages/web/TESTING.md) for detailed testing guidelines.

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

## MCP Server (AI Agent Integration)

This repository is optimized for AI agent workflows. It includes copilot-instructions, claude instructions, and cursor instructions.
If asked to create a plan file, agents will create them in docs/plans
This project includes a custom MCP server for AI agent context:

```sh
pnpm run initialize-mcp

# In VS Code:
# 1. Press Cmd+Shift+P
# 2. Type "MCP: List Servers"
# 3. Find 'corates' and start it
```

## Useful Commands

| Command                                           | Description                     |
| ------------------------------------------------- | ------------------------------- |
| `pnpm dev:front`                                  | Start frontend (landing + web)  |
| `pnpm dev:workers`                                | Start backend workers           |
| `pnpm build`                                      | Build all packages              |
| `pnpm test`                                       | Run all tests                   |
| `pnpm lint`                                       | Run ESLint                      |
| `pnpm format`                                     | Run Prettier                    |
| `pnpm clear-workers`                              | Clear local worker storage      |
| `pnpm logs`                                       | View worker logs                |
| `pnpm docs`                                       | View architecture documentation |
| `pnpm loc`                                        | Lines of code report            |
| `pnpm user:make-admin:local -- email@example.com` | Make a user admin (local)       |

## Code Style

- Follow existing patterns in the codebase
- Remove dev console logs before PRs

See [style-guide.md](style-guide.md) for detailed conventions.

## Architecture Documentation

```sh
pnpm run docs
```

This serves the architecture documentation at http://localhost:3020.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](.github/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to support@corates.org.

## Security

If you discover a security vulnerability, please review our [Security Policy](.github/SECURITY.md) and report it responsibly to support@corates.org rather than opening a public issue.

## Need Help?

- Check existing issues or open a new one
- Review the architecture docs with `pnpm run docs`
- Review the API docs by running the backend with `pnpm dev:workers`, generating openapi schema with `pnpm openapi` and visiting http://localhost:8787/docs
- You may notice that the package.json file acts like a folder in your IDE, this is configured by the .vscode settings.
