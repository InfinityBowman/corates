# Package Architecture

Overview of the monorepo structure and how packages relate to each other.

```mermaid
graph TB
    subgraph "Monorepo Packages"
        landing["landing<br/>(Marketing Site)"]
        web["web<br/>(SolidJS App)"]
        workers["workers<br/>(Cloudflare Workers API)"]
        ui["ui<br/>(Shared Components)"]
        mcp["mcp<br/>(Dev Tooling)"]
    end

    subgraph "Cloudflare Infrastructure"
        D1[(D1 Database<br/>SQLite)]
        R2[(R2 Storage<br/>PDFs)]
        DO["Durable Objects"]
    end

    web -->|"copied into"| landing
    web -->|"API calls"| workers
    ui -->|"shared components"| web
    workers --> D1
    workers --> R2
    workers --> DO
```

## Package Details

| Package   | Purpose                             | Tech                     |
| --------- | ----------------------------------- | ------------------------ |
| `web`     | Main SolidJS application            | SolidJS, Vite, Tailwind  |
| `workers` | Backend API and real-time sync      | Hono, Cloudflare Workers |
| `landing` | Marketing site (includes web app)   | SolidStart               |
| `ui`      | Shared component library            | SolidJS, Zag.js          |
| `mcp`     | Development tooling (docs, linting) | Node.js                  |
