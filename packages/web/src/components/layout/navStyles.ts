/** Row and group-label styling shared by the app sidebar and the settings sidebar. */

const ROW_BASE = 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium';

export const NAV_GROUP_LABEL =
  'text-muted-foreground flex h-7 items-center justify-between px-2.5 text-xs font-medium';

export function navRowClass(isActive: boolean) {
  return isActive ?
      `bg-muted text-foreground ${ROW_BASE}`
    : `text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${ROW_BASE}`;
}
