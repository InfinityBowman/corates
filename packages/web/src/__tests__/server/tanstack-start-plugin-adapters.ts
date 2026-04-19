// Stand-in for the virtual module the tanstackStart vite plugin would
// generate as #tanstack-start-plugin-adapters. CoRATES doesn't use any
// plugin serialization adapters, so we ship the empty form upstream uses
// when adapters are absent.
export const pluginSerializationAdapters = [];
export const hasPluginAdapters = false;
