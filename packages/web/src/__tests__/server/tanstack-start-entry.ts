// Stand-in for the virtual module the tanstackStart vite plugin would
// generate as #tanstack-start-entry. The vitest server config aliases
// '#tanstack-start-entry' to this file so createStartHandler can boot
// without the vite plugin running. CoRATES doesn't define a custom Start
// instance (no startInstance options), so the default is undefined.
export const startInstance = undefined;
