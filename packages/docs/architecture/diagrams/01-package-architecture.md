# Package Architecture

Overview of the monorepo structure and how packages relate to each other.

```mermaid
graph TB
    subgraph "Monorepo Packages"
        web["web<br/>(Main app Worker)"]
        stripePurchases["stripe-purchases<br/>(Webhook Worker)"]
        workers["workers<br/>(Backend library)"]
        db["db<br/>(Drizzle schema)"]
        shared["shared<br/>(Errors & types)"]
        ai["ai<br/>(AI utilities)"]
        stripeDev["stripe-dev<br/>(Local Stripe)"]
    end

    subgraph "Cloudflare Infrastructure"
        D1[(D1 Database<br/>SQLite)]
        R2[(R2 Storage<br/>PDFs)]
        DO["Durable Objects"]
    end

    web -->|"imports"| workers
    web -->|"imports"| db
    web -->|"imports"| shared
    stripePurchases -->|"imports"| workers
    stripePurchases -->|"imports"| db
    stripePurchases -->|"imports"| shared
    workers -->|"imports"| db
    workers -->|"imports"| shared
    web --> D1
    web --> R2
    web --> DO
    stripePurchases --> D1
```

## Package Details

| Package            | Purpose                                                          | Tech                                                |
| ------------------ | ---------------------------------------------------------------- | --------------------------------------------------- |
| `web`              | Main app Worker: SPA + `/api/*` routes                           | React 19, TanStack Start, Vite, Tailwind, shadcn/ui |
| `stripe-purchases` | Isolated Stripe webhook Worker                                   | Hono, Cloudflare Workers                            |
| `workers`          | Backend library: Durable Objects, auth, policies, billing logic  | Cloudflare Workers, Better Auth, Drizzle            |
| `db`               | Drizzle schema, client, typed helpers                            | Drizzle ORM                                         |
| `shared`           | Shared TypeScript types and domain error definitions             | TypeScript                                          |
| `ai`               | AI-adjacent utilities                                            | TypeScript                                          |
| `stripe-dev`       | Local Stripe listener setup (Turbo-only, not deployed)           | Node scripts                                        |
| `docs`             | VitePress documentation                                          | VitePress                                           |
