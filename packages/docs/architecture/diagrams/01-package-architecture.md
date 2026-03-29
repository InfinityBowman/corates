# Package Architecture

Overview of the monorepo structure and how packages relate to each other.

```mermaid
graph TB
    subgraph "Monorepo Packages"
        web["web<br/>(React Frontend)"]
        workers["workers<br/>(Cloudflare Workers API)"]
        shared["shared<br/>(Error Definitions)"]
        mcp["mcp<br/>(Dev Tooling)"]
    end

    subgraph "Cloudflare Infrastructure"
        D1[(D1 Database<br/>SQLite)]
        R2[(R2 Storage<br/>PDFs)]
        DO["Durable Objects"]
    end

    web -->|"API calls"| workers
    shared -->|"error utilities"| web
    shared -->|"error utilities"| workers
    workers --> D1
    workers --> R2
    workers --> DO
```

## Package Details

| Package   | Purpose                                | Tech                                  |
| --------- | -------------------------------------- | ------------------------------------- |
| `web`     | React frontend application             | React, TanStack Start, Vite, Tailwind |
| `workers` | Backend API and real-time sync         | OpenAPIHono, Cloudflare Workers       |
| `shared`  | Shared error definitions and utilities | TypeScript                            |
| `mcp`     | Development tooling (docs, linting)    | Node.js                               |
