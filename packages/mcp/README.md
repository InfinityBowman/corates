# CoRATES MCP Server

An MCP server providing tools for development assistance.

## Tools

### `search_icons`

Search for icons in the solid-icons library by name. Returns matching icon names with import statements.

**Parameters:**

- `query` (required) - Search query (case-insensitive)
- `limit` (optional) - Maximum results to return (default: 20)

### `run_lint`

Run `pnpm lint` from the repository root.

**Parameters:**

- `fix` (optional) - Set to `true` to apply autofixes

### `docs_list`

List local documentation sources under `docs/` that have an `llms.txt` file.

### `docs_get_llms_txt`

Return the contents of `docs/<doc>/llms.txt` for local documentation.

**Parameters:**

- `doc` (required) - Docs folder name (e.g. "solidjs", "hono")

### `better_auth_docs`

Fetch Better Auth documentation from the official website.

**Parameters:**

- `path` (optional) - Doc path (e.g. "docs/plugins/organization.md"). Omit for index.

### `drizzle_docs`

Fetch Drizzle ORM documentation.

**Parameters:**

- `path` (optional) - Component name (e.g. "accordion", "dialog", "tooltip"). Omit for index.

### `code_review`

Get a structured code review of current git changes or branch diff. Returns the diff with project-specific review criteria and an expected output format (summary, issues, suggestions, verdict).

**Parameters:**

- `base` (optional) - Base branch to compare against (default: `"main"`)
- `staged` (optional) - Boolean. When `true`, review only staged changes (default: `true`)
- `filesOnly` (optional) - Boolean. When `true`, return only the list of changed files without the full diff (default: `false`)

**Notes:**

- Automatically filters out lock files (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`)
- Excludes common binary/generated files (`.txt`, `.png`, `.jpg`, `.svg`, fonts, etc.)
- Branch names are validated to prevent command injection

## Resources

- `icon://libraries` - List all available icon libraries with icon counts
- `docs://llms` - List all local docs with an `llms.txt`
