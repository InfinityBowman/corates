# Settings Page with Sidebar Implementation Plan

## Overview

Create a settings page with a sidebar navigation that allows users to toggle between different settings sections (billing, plans, auth, notifications, org management, etc.). The sidebar should be similar to the existing main sidebar but tailored for settings navigation.

## Current State

### Existing Components
- **Sidebar** (`packages/web/src/components/sidebar/Sidebar.jsx`): Main app sidebar with projects, checklists, and navigation
- **SettingsPage** (`packages/web/src/components/profile/SettingsPage.jsx`): Single-page settings with all sections in one view
- **BillingPage** (`packages/web/src/components/billing/BillingPage.jsx`): Standalone billing page
- **BillingPlansPage** (`packages/web/src/components/billing/BillingPlansPage.jsx`): Standalone plans page
- **Layout** (`packages/web/src/Layout.jsx`): Main layout that conditionally shows/hides sidebar based on route

### Current Routing
- `/settings` → SettingsPage (all settings in one page)
- `/settings/billing` → BillingPage
- `/settings/billing/plans` → BillingPlansPage

### Current Behavior
- Settings routes hide the main sidebar (via `shouldHideSidebar` in Layout.jsx)
- Settings pages are standalone with no navigation between sections

## Goals

1. Create a reusable sidebar component that can be used for both main app and settings
2. Create a SettingsLayout component that wraps settings pages with a settings-specific sidebar
3. Implement nested routing for settings sections
4. Make it easy to add new settings sections in the future
5. Maintain backward compatibility with existing settings pages

## Architecture

### Component Structure

```
components/
  sidebar/
    Sidebar.jsx (existing - main app sidebar)
    SettingsSidebar.jsx (new - settings-specific sidebar)
    BaseSidebar.jsx (new - shared sidebar logic/UI)
  settings/
    SettingsLayout.jsx (new - layout wrapper with sidebar)
    SettingsSidebar.jsx (new - settings navigation sidebar)
    pages/
      BillingSettings.jsx (new - refactored from BillingPage)
      PlansSettings.jsx (new - refactored from BillingPlansPage)
      AuthSettings.jsx (new - extracted from SettingsPage)
      NotificationsSettings.jsx (new - extracted from SettingsPage)
      OrgManagementSettings.jsx (new - future)
      GeneralSettings.jsx (new - about/version info)
```

### Routing Structure

```
/settings
  /settings/billing → BillingSettings
  /settings/plans → PlansSettings
  /settings/auth → AuthSettings (security, 2FA, linked accounts)
  /settings/notifications → NotificationsSettings
  /settings/organizations → OrgManagementSettings (future)
  /settings/general → GeneralSettings (about, version)
```

## Implementation Plan

### Phase 1: Create Reusable Base Sidebar Component

**Goal**: Extract common sidebar logic into a reusable component

1. **Create `BaseSidebar.jsx`**
   - Extract common sidebar UI patterns (header, toggle buttons, mobile overlay)
   - Accept props for:
     - `items`: Array of sidebar items with `id`, `label`, `icon`, `path`, `badge?`
     - `currentPath`: Current route path
     - `desktopMode`: 'expanded' | 'collapsed'
     - `mobileOpen`: boolean
     - `onToggleDesktop`: callback
     - `onCloseMobile`: callback
     - `width`: number
     - `onWidthChange`: callback
   - Handle expand/collapse, mobile overlay, resize
   - Render navigation items based on props

2. **Refactor `Sidebar.jsx`**
   - Use `BaseSidebar` for common UI
   - Keep project-specific logic (projects list, checklists, recents)
   - Pass project-specific items to BaseSidebar

### Phase 2: Create Settings Sidebar Component

**Goal**: Create a settings-specific sidebar component

1. **Create `SettingsSidebar.jsx`**
   - Use `BaseSidebar` for common functionality
   - Define settings navigation items:
     ```javascript
     const settingsItems = [
       { id: 'billing', label: 'Billing', icon: FiCreditCard, path: '/settings/billing' },
       { id: 'plans', label: 'Plans', icon: FiZap, path: '/settings/plans' },
       { id: 'auth', label: 'Security', icon: FiShield, path: '/settings/auth' },
       { id: 'notifications', label: 'Notifications', icon: FiBell, path: '/settings/notifications' },
       { id: 'organizations', label: 'Organizations', icon: FiUsers, path: '/settings/organizations' },
       { id: 'general', label: 'General', icon: FiSettings, path: '/settings/general' },
     ];
     ```
   - Handle active state based on current route
   - Support badges/indicators (e.g., "New" badge, notification count)

### Phase 3: Create Settings Layout Component

**Goal**: Create a layout wrapper for settings pages

1. **Create `SettingsLayout.jsx`**
   - Similar structure to main `Layout.jsx` but for settings
   - Manages sidebar state (expanded/collapsed, mobile open/closed)
   - Persists sidebar preferences to localStorage
   - Renders `SettingsSidebar` on the left
   - Renders settings page content on the right
   - Handles responsive behavior (mobile overlay)

2. **Update `Layout.jsx`**
   - Keep existing logic for main app sidebar
   - Settings routes will use SettingsLayout instead

### Phase 4: Refactor Settings Pages

**Goal**: Split SettingsPage into individual route-based pages

1. **Create `AuthSettings.jsx`**
   - Extract security section from SettingsPage:
     - Password change/add
     - Two-factor authentication
     - Linked accounts
   - Keep all existing functionality

2. **Create `NotificationsSettings.jsx`**
   - Extract notifications section from SettingsPage:
     - Email notifications toggle
     - Project updates toggle
   - Keep all existing functionality

3. **Create `GeneralSettings.jsx`**
   - Extract about section from SettingsPage:
     - App version
     - Links to website
   - Can add more general settings later

4. **Refactor `BillingPage.jsx` → `BillingSettings.jsx`**
   - Move to `components/settings/pages/`
   - Update imports
   - Keep all existing functionality

5. **Refactor `BillingPlansPage.jsx` → `PlansSettings.jsx`**
   - Move to `components/settings/pages/`
   - Update imports
   - Keep all existing functionality

6. **Create `OrgManagementSettings.jsx`** (placeholder for future)
   - Basic structure
   - Can be implemented later

### Phase 5: Update Routing

**Goal**: Set up nested routing for settings

1. **Update `Routes.jsx`**
   - Create a settings route group:
     ```jsx
     <Route path="/settings" component={SettingsLayout}>
       <Route path="/" component={SettingsIndex} /> // Redirect or overview
       <Route path="/billing" component={BillingSettings} />
       <Route path="/plans" component={PlansSettings} />
       <Route path="/auth" component={AuthSettings} />
       <Route path="/notifications" component={NotificationsSettings} />
       <Route path="/organizations" component={OrgManagementSettings} />
       <Route path="/general" component={GeneralSettings} />
     </Route>
     ```

2. **Create `SettingsIndex.jsx`** (optional)
   - Overview page or redirect to first section
   - Could show quick links to all sections

3. **Update Layout.jsx**
   - Remove `/settings` from `shouldHideSidebar` check
   - Settings routes will use SettingsLayout which has its own sidebar

### Phase 6: Update Navigation Links

**Goal**: Update all links to settings to use new routes

1. **Update Navbar**
   - Update settings link if it exists
   - Ensure it points to `/settings` or a default section

2. **Update SettingsPage references**
   - Find all links to `/settings` and update if needed
   - Update links within settings pages to use sidebar navigation

3. **Add redirects for backward compatibility**
   - `/settings` → `/settings/billing` (or first section)
   - Keep old routes working temporarily with redirects

## Technical Details

### BaseSidebar Component API

```typescript
interface SidebarItem {
  id: string;
  label: string;
  icon: Component;
  path: string;
  badge?: string | number; // Optional badge/indicator
  disabled?: boolean;
}

interface BaseSidebarProps {
  items: SidebarItem[];
  currentPath: string;
  desktopMode: 'expanded' | 'collapsed';
  mobileOpen: boolean;
  onToggleDesktop: () => void;
  onCloseMobile: () => void;
  width: number;
  onWidthChange: (width: number) => void;
  title?: string; // Default: 'CoRATES'
  onNavigate?: (path: string) => void; // Optional custom navigation
}
```

### SettingsSidebar Component API

```typescript
interface SettingsSidebarProps {
  currentPath: string;
  desktopMode: 'expanded' | 'collapsed';
  mobileOpen: boolean;
  onToggleDesktop: () => void;
  onCloseMobile: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}
```

### SettingsLayout Component API

```typescript
interface SettingsLayoutProps {
  children: JSX.Element; // Settings page content
}
```

## File Structure

```
packages/web/src/
  components/
    sidebar/
      Sidebar.jsx (refactored to use BaseSidebar)
      BaseSidebar.jsx (new - shared sidebar component)
      ProjectTreeItem.jsx (existing)
      LocalChecklistItem.jsx (existing)
      ...
    settings/
      SettingsLayout.jsx (new)
      SettingsSidebar.jsx (new)
      pages/
        BillingSettings.jsx (moved from billing/)
        PlansSettings.jsx (moved from billing/)
        AuthSettings.jsx (new - extracted from SettingsPage)
        NotificationsSettings.jsx (new - extracted from SettingsPage)
        GeneralSettings.jsx (new - extracted from SettingsPage)
        OrgManagementSettings.jsx (new - placeholder)
      SettingsIndex.jsx (new - optional overview/redirect)
```

## Styling Considerations

1. **Consistent with main sidebar**
   - Use same color scheme, spacing, typography
   - Same expand/collapse behavior
   - Same mobile overlay behavior

2. **Settings-specific styling**
   - Active state highlighting for current section
   - Icons for each section
   - Optional badges/indicators

3. **Responsive design**
   - Mobile: Overlay sidebar (same as main sidebar)
   - Desktop: Persistent sidebar (expandable/collapsible)

## Migration Strategy

1. **Backward compatibility**
   - Keep old routes working with redirects
   - Gradually migrate links to new routes

2. **Incremental rollout**
   - Phase 1-2: Create base components (no breaking changes)
   - Phase 3-4: Create settings layout and pages (old routes still work)
   - Phase 5-6: Update routing and links (with redirects for old routes)

3. **Testing**
   - Test all settings functionality still works
   - Test navigation between sections
   - Test mobile responsiveness
   - Test sidebar expand/collapse

## Future Enhancements

1. **Settings search**
   - Add search bar to find specific settings

2. **Settings categories**
   - Group related settings (e.g., "Account", "Privacy", "Billing")

3. **Settings breadcrumbs**
   - Show current section in header

4. **Settings shortcuts**
   - Quick actions from sidebar (e.g., "Upgrade Plan" button)

5. **Settings preferences**
   - Remember last visited section
   - Customize visible sections

## Implementation Checklist

### Phase 1: Base Sidebar Component
- [ ] Create `BaseSidebar.jsx` with common sidebar logic
- [ ] Extract shared UI patterns (header, toggle, mobile overlay)
- [ ] Test BaseSidebar in isolation
- [ ] Refactor `Sidebar.jsx` to use BaseSidebar
- [ ] Verify main sidebar still works correctly

### Phase 2: Settings Sidebar
- [ ] Create `SettingsSidebar.jsx` using BaseSidebar
- [ ] Define settings navigation items
- [ ] Add icons for each section
- [ ] Test sidebar navigation

### Phase 3: Settings Layout
- [ ] Create `SettingsLayout.jsx`
- [ ] Implement sidebar state management
- [ ] Add localStorage persistence
- [ ] Test responsive behavior

### Phase 4: Settings Pages
- [ ] Create `AuthSettings.jsx` (extract from SettingsPage)
- [ ] Create `NotificationsSettings.jsx` (extract from SettingsPage)
- [ ] Create `GeneralSettings.jsx` (extract from SettingsPage)
- [ ] Move `BillingPage.jsx` → `BillingSettings.jsx`
- [ ] Move `BillingPlansPage.jsx` → `PlansSettings.jsx`
- [ ] Create `OrgManagementSettings.jsx` placeholder
- [ ] Test all pages render correctly

### Phase 5: Routing
- [ ] Update `Routes.jsx` with nested settings routes
- [ ] Create `SettingsIndex.jsx` (optional)
- [ ] Add redirects for old routes
- [ ] Test all routes work

### Phase 6: Navigation Updates
- [ ] Update Navbar settings link
- [ ] Update internal settings links
- [ ] Test navigation flow
- [ ] Remove old SettingsPage component (after migration)

### Testing
- [ ] Test all settings functionality
- [ ] Test sidebar navigation
- [ ] Test mobile responsiveness
- [ ] Test sidebar expand/collapse
- [ ] Test localStorage persistence
- [ ] Test route redirects

## Estimated Timeline

- **Phase 1**: 2-3 hours (BaseSidebar + refactor)
- **Phase 2**: 1-2 hours (SettingsSidebar)
- **Phase 3**: 2-3 hours (SettingsLayout)
- **Phase 4**: 3-4 hours (Extract/create pages)
- **Phase 5**: 1-2 hours (Routing)
- **Phase 6**: 1-2 hours (Navigation updates)
- **Testing**: 2-3 hours

**Total**: ~12-19 hours

## Notes

- The BaseSidebar approach allows reuse but may be overkill if settings sidebar is simple
- Alternative: Create SettingsSidebar independently if it's significantly different
- Consider using TanStack Router's nested routing features if available
- Settings sidebar can be simpler than main sidebar (no tree structure, just flat list)
- Can start with simpler implementation and add BaseSidebar later if needed
