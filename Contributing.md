# Contributing to CoRATES

### Prerequisites

- [Git](https://git-scm.com/downloads)
- [Node](https://nodejs.org/en/download)
- [Caddy](https://caddyserver.com/download)
- [pnpm](https://pnpm.io/installation)

## Quick Start

1. **Fork the repository** and clone it to your local machine and cd into that directory:

   ```sh
   git clone https://github.com/InfinityBowman/corates.git
   cd corates
   ```

2. **Start the Application**

```bash
# IMPORTANT - real urls and https is used in development
# to make this work, your dns file will be edited by the pnpm dev script
# See scripts/swap-dns.js
# This is reversable by running `pnpm prod:dns`

# Copy environments
# copy .dev.vars.example into .dev.vars (in packages/workers)
# copy .env.example into .env (in packages/web)

# Install packages
pnpm i

# Start the frontend
pnpm dev

# Start the Cloudflare services
pnpm dev:workers

# All done!


```

## MCP

This project utilizes a custom MCP server to provide agents with context
To set this up do:

```bash
cd packages/mcp
pnpm run scrape:all
# Ensure you have the .vscode folder with the mcp.json
# Press cmd + shift + p
# Type MCP: List Servers
# Find 'corates' and start it
# Make sure it says 'running' afterwards
```

## Tips

Clear worker storage

```bash
cd packages/workers
pnpm clear-workers
pnpm db:migrate
# db migrate may prompt for confirmation


# See worker logs
cd packages/workers
pnpm wrangler tail corates-workers-prod
```
