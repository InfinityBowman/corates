/** URL builders for in-workspace routes; the slug is always the first segment. */

export type WorkspaceSettingsPage = 'general' | 'members' | 'billing' | 'plans';

export function projectPath(slug: string, projectId: string) {
  return `/${slug}/projects/${projectId}`;
}

export function workspaceSettingsPath(slug: string, page: WorkspaceSettingsPage) {
  return `/${slug}/settings/${page}`;
}

/** Settings page in a workspace, or the legacy path that redirects to the default one. */
export function workspaceSettingsPathOrLegacy(
  workspace: { slug: string } | null,
  page: 'billing' | 'plans',
) {
  return workspace ? workspaceSettingsPath(workspace.slug, page) : `/settings/${page}`;
}
