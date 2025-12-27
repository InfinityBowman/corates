/**
 * Tests for error parsing and handling utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseApiError,
  handleFetchError,
  handleDomainError,
  handleTransportError,
  handleError,
  parseError,
  isErrorCode,
} from '../error-utils.js'
import {
  createDomainError,
  createTransportError,
  PROJECT_ERRORS,
  AUTH_ERRORS,
} from '@corates/shared'

// Mock showToast
vi.mock('@corates/ui', () => ({
  showToast: {
    error: vi.fn(),
  },
}))

describe('parseApiError', () => {
  it('should parse valid domain error response', async () => {
    const response = new Response(
      JSON.stringify({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found',
        statusCode: 404,
        details: { projectId: '123' },
      }),
      { status: 404 },
    )

    const error = await parseApiError(response)

    expect(error.code).toBe('PROJECT_NOT_FOUND')
    expect(error.message).toBe('Project not found')
    expect(error.statusCode).toBe(404)
    expect(error.details).toEqual({ projectId: '123' })
  })

  it('should validate error response shape', async () => {
    const response = new Response(
      JSON.stringify({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found',
        statusCode: 404,
      }),
      { status: 404 },
    )

    const error = await parseApiError(response)

    expect(error.code).toBe('PROJECT_NOT_FOUND')
    expect(error.statusCode).toBe(404)
  })

  it('should handle invalid JSON response', async () => {
    const response = new Response('invalid json', { status: 500 })

    const error = await parseApiError(response)

    expect(error.code).toBe('UNKNOWN_INVALID_RESPONSE')
    expect(error.statusCode).toBe(500)
  })

  it('should reject transport error codes from API', async () => {
    const response = new Response(
      JSON.stringify({
        code: 'TRANSPORT_NETWORK_ERROR',
        message: 'Network error',
        statusCode: 500,
      }),
      { status: 500 },
    )

    const error = await parseApiError(response)

    // Should be converted to unknown error since transport codes shouldn't come from API
    expect(error.code).toBe('UNKNOWN_INVALID_RESPONSE')
  })
})

describe('handleFetchError', () => {
  it('should return response if successful', async () => {
    const response = new Response(JSON.stringify({ success: true }), {
      status: 200,
    })
    const fetchPromise = Promise.resolve(response)

    const result = await handleFetchError(fetchPromise, { showToast: false })

    expect(result).toBe(response)
  })

  it('should parse and throw domain error for non-ok response', async () => {
    const response = new Response(
      JSON.stringify({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found',
        statusCode: 404,
      }),
      { status: 404 },
    )
    const fetchPromise = Promise.resolve(response)

    await expect(
      handleFetchError(fetchPromise, { showToast: false }),
    ).rejects.toThrow()
  })

  it('should handle network errors as transport errors', async () => {
    const fetchPromise = Promise.reject(new Error('Failed to fetch'))

    await expect(
      handleFetchError(fetchPromise, { showToast: false }),
    ).rejects.toThrow()
  })
})

describe('handleDomainError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call onError callback if provided', async () => {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND)
    const onError = vi.fn()

    await handleDomainError(error, { onError, showToast: false })

    expect(onError).toHaveBeenCalledWith(error)
  })

  it('should update error state if setter provided', async () => {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND)
    const setError = vi.fn()

    await handleDomainError(error, { setError, showToast: false })

    expect(setError).toHaveBeenCalledWith('Project not found')
  })

  it('should navigate on auth errors', async () => {
    const error = createDomainError(AUTH_ERRORS.REQUIRED)
    const navigate = vi.fn()

    await handleDomainError(error, { navigate, showToast: false })

    expect(navigate).toHaveBeenCalledWith('/signin', { replace: true })
  })
})

describe('handleTransportError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call onError callback if provided', async () => {
    const error = createTransportError('TRANSPORT_NETWORK_ERROR')
    const onError = vi.fn()

    await handleTransportError(error, { onError, showToast: false })

    expect(onError).toHaveBeenCalledWith(error)
  })

  it('should update error state if setter provided', async () => {
    const error = createTransportError('TRANSPORT_NETWORK_ERROR')
    const setError = vi.fn()

    await handleTransportError(error, { setError, showToast: false })

    expect(setError).toHaveBeenCalled()
  })
})

describe('handleError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle domain errors', async () => {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND)
    const result = await handleError(error, { showToast: false })

    expect(result).toBe(error)
    expect(result.code).toBe('PROJECT_NOT_FOUND')
  })

  it('should handle transport errors', async () => {
    const error = createTransportError('TRANSPORT_NETWORK_ERROR')
    const result = await handleError(error, { showToast: false })

    expect(result).toBe(error)
    expect(result.code).toBe('TRANSPORT_NETWORK_ERROR')
  })

  it('should normalize and handle Error objects', async () => {
    const error = new Error('Failed to fetch')
    const result = await handleError(error, { showToast: false })

    expect(result.code).toBe('TRANSPORT_NETWORK_ERROR')
  })
})

describe('parseError', () => {
  it('should normalize Error objects', () => {
    const error = new Error('Failed to fetch')
    const result = parseError(error)

    expect(result.code).toBe('TRANSPORT_NETWORK_ERROR')
  })

  it('should normalize strings', () => {
    const result = parseError('Some error')

    expect(result.code).toBe('UNKNOWN_UNHANDLED_ERROR')
  })
})

describe('isErrorCode', () => {
  it('should check if error code matches', () => {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND)

    expect(isErrorCode(error, 'PROJECT_NOT_FOUND')).toBe(true)
    expect(isErrorCode(error, 'PROJECT_ACCESS_DENIED')).toBe(false)
  })

  it('should handle null/undefined errors', () => {
    expect(isErrorCode(null, 'PROJECT_NOT_FOUND')).toBe(false)
    expect(isErrorCode(undefined, 'PROJECT_NOT_FOUND')).toBe(false)
  })
})
