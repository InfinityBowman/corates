// Ensures @tanstack/start-client-core's module augmentation is loaded into
// the TypeScript program so `server: { handlers: {...} }` is recognized on
// `createFileRoute(...)` options. The app otherwise imports only from
// `@tanstack/react-start/server` and `@tanstack/react-start/client`, neither
// of which re-exports start-client-core, so the augmentation needs an
// explicit import here.
import type {} from '@tanstack/react-start';
