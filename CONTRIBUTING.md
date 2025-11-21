# Contributing to Corates

Thank you for your interest in contributing to Corates!

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Configure environment:

   ```bash
   cp .env.example .env
   ```

3. Start development:
   ```bash
   pnpm dev
   ```

## Project Structure

- `packages/app` - SolidJS application
- `packages/ui` - Shared UI components
- `workers/api` - Cloudflare Workers API
- `workers/durable-objects` - Durable Objects

## Development Commands

- `pnpm dev` - Start all dev servers
- `pnpm build` - Build all packages
- `pnpm test` - Run tests
- `pnpm format` - Format code

## Tech Stack

- SolidJS
- Vite
- Tailwind CSS v4
- D3.js
- Yjs
- Solid Router
- Cloudflare Workers
- Durable Objects
- Vitest

## Code Style

We use Prettier for code formatting. Run `pnpm format` before committing.
