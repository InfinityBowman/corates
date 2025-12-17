# Contributing to CoRATES

### Prerequisites

- [Git](https://git-scm.com/downloads)
- [Node](https://nodejs.org/en/download)
- [pnpm](https://pnpm.io/installation) If you have Node installed I recommend: `npm install -g pnpm`

## Quick Start

1. **Fork the repository** and clone it to your local machine and cd into that directory:

   ```sh
   git clone https://github.com/InfinityBowman/corates.git
   cd corates
   ```

2. **Start the Application**

```bash
# Copy environments
# copy .env.example into .env (in packages/workers)
# copy .env.example into .env (in packages/web)
# copy .env.example into .env (in packages/landing)

# Install packages
pnpm i

# Start the frontend
pnpm dev:front

# Start the Cloudflare services
pnpm dev:workers

# All done!
```

## API Documentation

**Important:** For secured endpoints, you must first sign in via the frontend UI (http://localhost:5173).  
Once signed in, the API documentation endpoints will behave as if the requests are coming from your logged-in user.

Run the following command to generate the OpenAPI docs:

```bash
pnpm openapi
```

## MCP

This project utilizes a custom MCP server to provide agents with context  
To set this up do:

```bash
pnpm run initialize-mcp

# in VS CODE
# Press cmd + shift + p
# Type MCP: List Servers
# Find 'corates' and start it
# Make sure it says 'running' afterwards
```

## Tips

```bash

# Useful scripts for the respective packages are in /scripts

# Clear worker storage
pnpm clear-workers

# See worker logs
pnpm logs

# See architecture docs
pnpm run docs

# Check lines of code
pnpm loc

# Test
pnpm test

# Lint
pnpm lint

# Format
pnpm format

# Make an email admin
pnpm user:make-admin:local -- test@example.com
```
