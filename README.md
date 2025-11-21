# Corates

A collaborative rating platform built with modern web technologies.

## Tech Stack

- **SolidJS** - Reactive UI library
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling (no config needed)
- **D3.js** - Data visualization
- **Yjs** - CRDT for collaboration
- **Solid Router** - Client-side routing
- **Cloudflare Workers** - Edge API
- **Durable Objects** - Stateful serverless
- **Vitest** - Testing

## Structure

```
corates/
├── packages/
│   ├── app/              # Main SolidJS application
│   └── ui/               # Shared UI components
└── workers/
    ├── api/              # Cloudflare Workers API
    └── durable-objects/  # Durable Objects
```

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start development:

```bash
pnpm dev
```

## Available Scripts

- `pnpm dev` - Start all dev servers
- `pnpm build` - Build all packages
- `pnpm test` - Run tests
- `pnpm format` - Format code

## Environment Variables

Copy `.env.example` to `.env` and configure your Cloudflare credentials.

## License

MIT
