# Contributing to Corates

Thank you for considering contributing to Corates! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)

## Getting Started

Before you begin:

- Make sure you have [Node.js](https://nodejs.org/) (v18 or higher) installed
- Install [pnpm](https://pnpm.io/) package manager: `npm install -g pnpm`
- Familiarize yourself with the technologies we use:
  - [SolidJS](https://www.solidjs.com/)
  - [Vite](https://vitejs.dev/)
  - [Tailwind CSS](https://tailwindcss.com/)
  - [Cloudflare Workers](https://workers.cloudflare.com/)
  - [Durable Objects](https://developers.cloudflare.com/durable-objects/)
  - [Yjs](https://docs.yjs.dev/)

## Development Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/InfinityBowman/corates.git
   cd corates
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development servers:**

   ```bash
   # Start all packages in development mode
   pnpm dev

   # Or start individual packages
   cd packages/app && pnpm dev
   cd workers/api && pnpm dev
   ```

## Project Structure

```
corates/
├── packages/
│   ├── app/           # Main SolidJS application
│   └── ui/            # Shared UI components
├── workers/
│   ├── api/           # Cloudflare Worker API
│   └── durable-objects/ # Durable Objects implementation
├── .env.example       # Environment variables template
├── pnpm-workspace.yaml # pnpm workspace configuration
└── package.json       # Root package configuration
```

## Development Workflow

1. **Create a new branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Write clean, readable code
   - Follow existing code patterns
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes:**

   ```bash
   # Run all tests
   pnpm test

   # Run tests for a specific package
   cd packages/app && pnpm test
   ```

4. **Check code formatting:**

   ```bash
   pnpm format:check
   pnpm format  # to auto-format
   ```

5. **Build the project:**

   ```bash
   pnpm build
   ```

6. **Commit your changes:**

   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Adding or updating tests
   - `chore:` - Maintenance tasks

## Code Style

- **Formatting:** We use Prettier for code formatting. Run `pnpm format` before committing.
- **TypeScript:** Use TypeScript for type safety. Avoid `any` types when possible.
- **Naming:**
  - Use PascalCase for component names and classes
  - Use camelCase for functions and variables
  - Use UPPER_CASE for constants
- **Components:**
  - Keep components small and focused
  - Use functional components with hooks
  - Extract reusable logic into custom hooks

## Testing

- Write tests for all new features and bug fixes
- Place test files next to the code they test with `.test.ts` or `.test.tsx` extension
- Aim for good test coverage
- Run tests locally before pushing:
  ```bash
  pnpm test
  ```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('ComponentName', () => {
  it('should do something', () => {
    // Arrange
    // Act
    // Assert
    expect(result).toBe(expected);
  });
});
```

## Pull Request Process

1. **Update documentation:** Ensure README and other docs reflect your changes
2. **Add tests:** Make sure your code is tested
3. **Run all checks:**
   ```bash
   pnpm format:check
   pnpm typecheck
   pnpm test
   pnpm build
   ```
4. **Create a Pull Request:**
   - Use a clear, descriptive title
   - Describe what changes you made and why
   - Reference any related issues
   - Add screenshots for UI changes
5. **Code Review:**
   - Address reviewer feedback promptly
   - Keep the PR updated with the main branch
6. **Merge:** Once approved, your PR will be merged

## Questions?

If you have questions or need help:

- Open an issue on GitHub
- Check existing issues and discussions
- Review the documentation

Thank you for contributing! 🎉
