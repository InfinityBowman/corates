/**
 * The ephemeral presence payload — what a connected tab announces about
 * itself, relayed peer-to-peer by the engine (never stored, so changing this
 * schema needs no app version bump). Identity attestation is the engine's:
 * peers carry a server-stamped `principal`; `user` here is display data
 * (name, avatar) the client volunteers about itself.
 *
 * Every top-level field is optional so `presence.update(partial)` from one
 * call site (cursor moves) can never fail validation against fields another
 * call site owns (page changes). Consumers skip peers that have not yet
 * announced `user`.
 */

import { z } from 'zod';
import { CHECKLIST_TYPE_VALUES } from './schema.js';

export const presenceSchema = z.object({
  user: z
    .object({
      userId: z.string(),
      name: z.string(),
      image: z.string().nullable(),
    })
    .optional(),
  /** Where in a reconciliation session this tab is. */
  reconciliation: z
    .object({
      currentPage: z.number(),
      checklistType: z.enum(CHECKLIST_TYPE_VALUES),
    })
    .optional(),
  /**
   * Container-relative pointer position; null after mouse-leave. `timestamp`
   * is the sender's clock, used only for fading stale cursors client-side.
   */
  cursor: z
    .object({
      x: z.number(),
      y: z.number(),
      scrollY: z.number(),
      timestamp: z.number(),
    })
    .nullable()
    .optional(),
});

export type PresenceState = z.infer<typeof presenceSchema>;
