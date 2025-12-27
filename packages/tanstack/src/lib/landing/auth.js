/**
 * Auth utilities for the landing page
 * Checks if the user is logged in via the API session endpoint
 */

import { createSignal } from 'solid-js'
import { config } from './config'

// Global auth state
const [isLoggedIn, setIsLoggedIn] = createSignal(false)
const [user, setUser] = createSignal(null)
const [isLoading, setIsLoading] = createSignal(true)

let hasChecked = false

/**
 * Check if the user has an active session
 * @returns {Promise<{isLoggedIn: boolean, user: Object|null}>}
 */
export async function checkSession() {
  // Only check once per page load
  if (hasChecked) {
    return { isLoggedIn: isLoggedIn(), user: user() }
  }

  try {
    const response = await fetch(`${config.apiUrl}/api/auth/session`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      setIsLoggedIn(false)
      setUser(null)
      return { isLoggedIn: false, user: null }
    }

    const data = await response.json()
    const loggedIn = !!data.user
    setIsLoggedIn(loggedIn)
    setUser(data.user || null)
    return {
      isLoggedIn: loggedIn,
      user: data.user || null,
    }
  } catch (error) {
    console.error('Failed to check session:', error)
    setIsLoggedIn(false)
    setUser(null)
    return { isLoggedIn: false, user: null }
  } finally {
    hasChecked = true
    setIsLoading(false)
  }
}

/**
 * Get auth state signals for reactive components
 * @returns {{ isLoggedIn: () => boolean, user: () => Object|null, isLoading: () => boolean }}
 */
export function useAuth() {
  return { isLoggedIn, user, isLoading }
}
