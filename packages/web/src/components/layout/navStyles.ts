/** Row and group-label styling shared by the app sidebar and the settings nav. */

const ROW_BASE = 'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium';

export const NAV_GROUP_LABEL =
  'text-muted-foreground/80 px-2.5 pb-1.5 text-[11px] font-semibold tracking-wider uppercase';

export const NAV_FOOTER = 'border-border text-muted-foreground/70 border-t px-5 py-3 text-xs';

export function navRowClass(isActive: boolean) {
  return isActive ?
      `bg-primary/10 text-primary ${ROW_BASE}`
    : `text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${ROW_BASE}`;
}
