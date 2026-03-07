/**
 * Auth utilities for the landing page
 * Checks if the user is logged in via the API session endpoint
 */

import { useState, useEffect } from 'react'
import { config } from './config'

interface AuthState {
  isLoggedIn: boolean
  user: { name?: string } | null
  isLoading: boolean
}

let cachedAuth: AuthState | null = null
let checkPromise: Promise<AuthState> | null = null

async function checkSession(): Promise<AuthState> {
  if (cachedAuth) return cachedAuth

  if (checkPromise) return checkPromise

  checkPromise = (async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/auth/session`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        cachedAuth = { isLoggedIn: false, user: null, isLoading: false }
        return cachedAuth
      }

      const data = await response.json()
      const loggedIn = !!data.user
      cachedAuth = {
        isLoggedIn: loggedIn,
        user: data.user || null,
        isLoading: false,
      }
      return cachedAuth
    } catch {
      cachedAuth = { isLoggedIn: false, user: null, isLoading: false }
      return cachedAuth
    }
  })()

  return checkPromise
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    isLoggedIn: cachedAuth?.isLoggedIn ?? false,
    user: cachedAuth?.user ?? null,
    isLoading: !cachedAuth,
  })

  useEffect(() => {
    checkSession().then(setAuth)
  }, [])

  return auth
}
