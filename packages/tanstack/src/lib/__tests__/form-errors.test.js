/**
 * Tests for form error handling utilities
 */

import { describe, it, expect, vi } from 'vitest'
import { createSignal } from 'solid-js'
import {
  handleFormError,
  createFormErrorState,
  createFormErrorSignals,
} from '../form-errors.js'
import {
  createDomainError,
  createValidationError,
  createMultiFieldValidationError,
  createTransportError,
  VALIDATION_ERRORS,
  PROJECT_ERRORS,
} from '@corates/shared'

describe('handleFormError', () => {
  it('should handle single field validation error', () => {
    const error = createValidationError(
      'email',
      'VALIDATION_FIELD_REQUIRED',
      '',
    )
    const setFieldError = vi.fn()
    const setGlobalError = vi.fn()

    const handled = handleFormError(error, setFieldError, setGlobalError)

    expect(handled).toBe(true)
    expect(setFieldError).toHaveBeenCalledWith(
      'email',
      'This field is required',
    )
    expect(setGlobalError).not.toHaveBeenCalled()
  })

  it('should handle multi-field validation error', () => {
    const error = createMultiFieldValidationError([
      {
        field: 'email',
        code: 'VALIDATION_FIELD_REQUIRED',
        message: 'Email is required',
      },
      {
        field: 'password',
        code: 'VALIDATION_FIELD_TOO_SHORT',
        message: 'Password too short',
      },
    ])
    const setFieldError = vi.fn()
    const setGlobalError = vi.fn()

    const handled = handleFormError(error, setFieldError, setGlobalError)

    expect(handled).toBe(true)
    expect(setFieldError).toHaveBeenCalledTimes(2)
    expect(setFieldError).toHaveBeenCalledWith('email', 'Email is required')
    expect(setFieldError).toHaveBeenCalledWith('password', 'Password too short')
    expect(setGlobalError).not.toHaveBeenCalled()
  })

  it('should handle validation error without field details as global error', () => {
    const error = createDomainError(VALIDATION_ERRORS.FAILED)
    const setFieldError = vi.fn()
    const setGlobalError = vi.fn()

    const handled = handleFormError(error, setFieldError, setGlobalError)

    expect(handled).toBe(true)
    expect(setFieldError).not.toHaveBeenCalled()
    expect(setGlobalError).toHaveBeenCalledWith('Validation failed')
  })

  it('should handle non-validation domain errors as global error', () => {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND)
    const setFieldError = vi.fn()
    const setGlobalError = vi.fn()

    const handled = handleFormError(error, setFieldError, setGlobalError)

    expect(handled).toBe(true)
    expect(setFieldError).not.toHaveBeenCalled()
    expect(setGlobalError).toHaveBeenCalledWith('Project not found')
  })

  it('should handle transport errors as global error', () => {
    const error = createTransportError('TRANSPORT_NETWORK_ERROR')
    const setFieldError = vi.fn()
    const setGlobalError = vi.fn()

    const handled = handleFormError(error, setFieldError, setGlobalError)

    expect(handled).toBe(true)
    expect(setFieldError).not.toHaveBeenCalled()
    expect(setGlobalError).toHaveBeenCalled()
  })

  it('should return false for invalid error objects', () => {
    const setFieldError = vi.fn()
    const setGlobalError = vi.fn()

    expect(handleFormError(null, setFieldError, setGlobalError)).toBe(false)
    expect(handleFormError({}, setFieldError, setGlobalError)).toBe(false)
    expect(setFieldError).not.toHaveBeenCalled()
    expect(setGlobalError).not.toHaveBeenCalled()
  })
})

describe('createFormErrorState', () => {
  it('should create form error state manager', () => {
    const state = createFormErrorState()

    expect(state.setFieldError).toBeDefined()
    expect(state.getFieldError).toBeDefined()
    expect(state.clearFieldError).toBeDefined()
    expect(state.clearAll).toBeDefined()
    expect(state.hasFieldError).toBeDefined()
    expect(state.getAllErrors).toBeDefined()
    expect(state.hasErrors).toBeDefined()
  })

  it('should set and get field errors', () => {
    const state = createFormErrorState()

    state.setFieldError('email', 'Email is required')
    expect(state.getFieldError('email')).toBe('Email is required')
    expect(state.hasFieldError('email')).toBe(true)
  })

  it('should clear field errors', () => {
    const state = createFormErrorState()

    state.setFieldError('email', 'Email is required')
    state.clearFieldError('email')
    expect(state.getFieldError('email')).toBeUndefined()
    expect(state.hasFieldError('email')).toBe(false)
  })

  it('should clear all errors', () => {
    const state = createFormErrorState()

    state.setFieldError('email', 'Email is required')
    state.setFieldError('password', 'Password too short')
    state.clearAll()
    expect(state.hasErrors()).toBe(false)
    expect(state.getAllErrors()).toEqual({})
  })

  it('should return all errors as object', () => {
    const state = createFormErrorState()

    state.setFieldError('email', 'Email is required')
    state.setFieldError('password', 'Password too short')
    expect(state.getAllErrors()).toEqual({
      email: 'Email is required',
      password: 'Password too short',
    })
  })
})

describe('createFormErrorSignals', () => {
  it('should create reactive form error signals', () => {
    const signals = createFormErrorSignals(createSignal)

    expect(signals.fieldErrors).toBeDefined()
    expect(signals.globalError).toBeDefined()
    expect(signals.setFieldError).toBeDefined()
    expect(signals.clearFieldError).toBeDefined()
    expect(signals.clearFieldErrors).toBeDefined()
    expect(signals.setGlobalError).toBeDefined()
    expect(signals.clearGlobalError).toBeDefined()
    expect(signals.clearAll).toBeDefined()
    expect(signals.handleError).toBeDefined()
  })

  it('should set and get field errors reactively', () => {
    const signals = createFormErrorSignals(createSignal)

    signals.setFieldError('email', 'Email is required')
    expect(signals.fieldErrors()).toEqual({ email: 'Email is required' })
  })

  it('should set global error reactively', () => {
    const signals = createFormErrorSignals(createSignal)

    signals.setGlobalError('Something went wrong')
    expect(signals.globalError()).toBe('Something went wrong')
  })

  it('should clear field errors', () => {
    const signals = createFormErrorSignals(createSignal)

    signals.setFieldError('email', 'Email is required')
    signals.clearFieldError('email')
    expect(signals.fieldErrors()).toEqual({})
  })

  it('should handle errors using handleFormError', () => {
    const signals = createFormErrorSignals(createSignal)
    const error = createValidationError(
      'email',
      'VALIDATION_FIELD_REQUIRED',
      '',
    )

    signals.handleError(error)

    expect(signals.fieldErrors()).toEqual({ email: 'This field is required' })
  })

  it('should clear all errors', () => {
    const signals = createFormErrorSignals(createSignal)

    signals.setFieldError('email', 'Email is required')
    signals.setGlobalError('Global error')
    signals.clearAll()

    expect(signals.fieldErrors()).toEqual({})
    expect(signals.globalError()).toBe('')
  })
})
