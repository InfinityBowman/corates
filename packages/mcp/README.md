# Corates MCP Server

An MCP server providing tools for:

1. **Icon Search** - Search through all icons in solid-icons without overwhelming the context window

## Tools

### `search_icons`

Search for icons in the solid-icons library by name.

### `run_lint`

Run pnpm lint from the repository root. Set fix=true to apply autofixes.

### `docs_list`

List local documentation sources available under the repo `docs/` folder (only those with an `llms.txt`).

### `docs_get_llms_txt`

Return the contents of `docs/<doc>/llms.txt` from this repository.

## Resources

- `icon://libraries` - List all available icon libraries
- `docs://llms` - List all local docs with an `llms.txt`
