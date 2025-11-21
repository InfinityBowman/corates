# Corates

A modern, collaborative rating platform built with cutting-edge web technologies.

## 🚀 Features

- **Real-time Collaboration** - Built with Yjs CRDT for seamless multi-user experiences
- **Fast & Reactive** - Powered by SolidJS and Vite for optimal performance
- **Edge Computing** - Cloudflare Workers for global, low-latency API responses
- **Strongly Consistent State** - Durable Objects for coordinated, stateful operations
- **Modern UI** - Tailwind CSS for beautiful, responsive designs
- **Data Visualization** - D3.js for powerful, interactive charts
- **Type-Safe** - Full TypeScript support across all packages
- **Well-Tested** - Vitest for fast, reliable testing

## 📦 Technologies

### Frontend

- **[SolidJS](https://www.solidjs.com/)** - A declarative, efficient JavaScript UI library
- **[Vite](https://vitejs.dev/)** - Next-generation frontend build tool
- **[Solid Router](https://github.com/solidjs/solid-router)** - Declarative routing for SolidJS
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[D3.js](https://d3js.org/)** - Data visualization library
- **[Yjs](https://docs.yjs.dev/)** - CRDT framework for building collaborative applications

### Backend

- **[Cloudflare Workers](https://workers.cloudflare.com/)** - Serverless edge compute platform
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)** - Strongly consistent coordination primitives
- **[Hono](https://hono.dev/)** - Ultrafast web framework for Workers

### Development

- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Vitest](https://vitest.dev/)** - Fast unit test framework
- **[Prettier](https://prettier.io/)** - Opinionated code formatter
- **[pnpm](https://pnpm.io/)** - Fast, disk space efficient package manager

## 🏗️ Project Structure

This project uses a pnpm workspace monorepo structure:

```
corates/
├── packages/
│   ├── app/              # Main SolidJS application
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── pages/       # Route pages
│   │   │   └── index.tsx    # App entry point
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── ui/               # Shared UI component library
│       ├── src/
│       └── package.json
├── workers/
│   ├── api/              # Cloudflare Workers API
│   │   ├── src/
│   │   ├── wrangler.toml
│   │   └── package.json
│   └── durable-objects/  # Durable Objects implementation
│       ├── src/
│       ├── wrangler.toml
│       └── package.json
├── .env.example          # Environment variables template
├── .prettierrc           # Prettier configuration
├── pnpm-workspace.yaml   # Workspace configuration
├── package.json          # Root package with scripts
├── CONTRIBUTING.md       # Contribution guidelines
└── README.md             # This file
```

## 🛠️ Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0

### Installation

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
   # Edit .env with your Cloudflare credentials
   ```

### Development

Start all packages in development mode:

```bash
pnpm dev
```

Or run individual packages:

**Frontend (SolidJS app):**

```bash
cd packages/app
pnpm dev
# Opens at http://localhost:3000
```

**API Worker:**

```bash
cd workers/api
pnpm dev
# Runs at http://localhost:8787
```

**Durable Objects Worker:**

```bash
cd workers/durable-objects
pnpm dev
# Runs at http://localhost:8788
```

### Building

Build all packages:

```bash
pnpm build
```

### Testing

Run tests across all packages:

```bash
pnpm test
```

### Formatting

Check code formatting:

```bash
pnpm format:check
```

Auto-format code:

```bash
pnpm format
```

### Type Checking

Run TypeScript type checking:

```bash
pnpm typecheck
```

## 📝 Available Scripts

From the root directory:

- `pnpm dev` - Start all packages in development mode
- `pnpm build` - Build all packages
- `pnpm test` - Run all tests
- `pnpm format` - Format all code with Prettier
- `pnpm format:check` - Check code formatting
- `pnpm typecheck` - Run TypeScript type checking

## 🌐 Deployment

### Frontend (SolidJS App)

The frontend can be deployed to any static hosting service:

- **Cloudflare Pages:**
  ```bash
  cd packages/app
  pnpm build
  # Deploy dist/ folder
  ```

### Workers

Deploy to Cloudflare:

**API Worker:**

```bash
cd workers/api
pnpm deploy
```

**Durable Objects:**

```bash
cd workers/durable-objects
pnpm deploy
```

Make sure to set up your Cloudflare credentials in `.env` before deploying.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Format code: `pnpm format`
6. Commit your changes: `git commit -m 'feat: add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with amazing open-source technologies
- Inspired by modern collaborative tools
- Community-driven development

## 📮 Contact

For questions or feedback, please open an issue on GitHub.

---

Made with ❤️ by the Corates team
