/**
 * Back-Forward Cache (bfcache) Handler
 *
 * Detects when a page is restored from the browser's back-forward cache
 * and triggers state refresh to ensure auth session and project data are current.
 */

import { useBetterAuth } from '@api/better-auth-store.js'
import projectStore from '@/stores/projectStore.js'

/**
 * Initialize bfcache restoration handler
 * Should be called once on app initialization
 */
export function initBfcacheHandler() {
  if (typeof window === 'undefined') return

  // Get auth instance once (it's a singleton)
  const auth = useBetterAuth()

  const handlePageshow = async (event) => {
    // event.persisted === true means the page was restored from bfcache
    if (!event.persisted) return

    console.log(
      '[bfcache] Page restored from back-forward cache, refreshing state...',
    )

    // Wait for auth to finish loading if it's currently loading
    // This ensures we have the current user before validating project cache
    if (auth.authLoading()) {
      // Wait for auth to complete (with timeout)
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Auth loading timeout'))
        }, 5000)

        const checkAuth = () => {
          if (!auth.authLoading()) {
            clearTimeout(timeout)
            resolve()
          } else {
            setTimeout(checkAuth, 100)
          }
        }

        checkAuth()
      }).catch((err) => {
        console.warn('[bfcache] Auth loading timeout:', err)
      })
    }

    // Force refresh the auth session to ensure it's current
    try {
      await auth.forceRefreshSession()
    } catch (err) {
      console.warn('[bfcache] Failed to refresh auth session:', err)
    }

    // Wait a bit for session to update
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Validate and refresh project list if user is authenticated
    const currentUser = auth.user()
    if (currentUser?.id) {
      // Validate project list cache against current user
      projectStore.validateProjectListCache(currentUser.id)

      // Refresh project list to ensure it's current
      try {
        await projectStore.refreshProjectList(currentUser.id)
      } catch (err) {
        console.warn('[bfcache] Failed to refresh project list:', err)
      }
    } else {
      // User is not authenticated, clear project list
      projectStore.clearProjectList()
    }
  }

  window.addEventListener('pageshow', handlePageshow)

  // Return cleanup function (though typically not needed for singleton)
  return () => {
    window.removeEventListener('pageshow', handlePageshow)
  }
}
