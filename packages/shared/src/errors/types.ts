/**
 * Type definitions for the error system
 * All errors follow a canonical shape with distinct types for domain vs transport errors
 */

// Base error shape
export interface AppError {
  code: string; // Machine-readable error code (e.g., "PROJECT_NOT_FOUND")
  message: string; // User-facing message (localized, can be overridden)
  timestamp?: string; // Error timestamp (for debugging)
}

// Domain errors - business logic errors from backend API
export interface DomainError extends AppError {
  code: DomainErrorCode; // Typed error code
  statusCode: number; // HTTP status code (required for domain errors)
  details?: ErrorDetails; // Typed details based on error code
}

// Transport errors - network/connection errors (frontend only, never from API)
export interface TransportError extends AppError {
  code: TransportErrorCode;
  details?: TransportErrorDetails;
  // Note: Transport errors don't have statusCode (they occur before/after API call)
}

// Error details - strongly typed based on error code
// Each error code has a specific details shape
// Runtime: details shape validated based on error code
// TypeScript: discriminated union based on code for type safety
export type ErrorDetails =
  | ValidationErrorDetails
  | ProjectErrorDetails
  | FileErrorDetails
  | AuthErrorDetails
  | SystemErrorDetails;

// Union of all domain error codes for type safety
export type DomainErrorCode =
  | ValidationErrorCode
  | ProjectErrorCode
  | FileErrorCode
  | AuthErrorCode
  | SystemErrorCode;

// Transport error codes (frontend only)
export type TransportErrorCode =
  | 'TRANSPORT_NETWORK_ERROR'
  | 'TRANSPORT_TIMEOUT'
  | 'TRANSPORT_CORS_ERROR';

// Error definition type (used in domain error definitions)
export type ErrorDefinition = {
  code: string;
  defaultMessage: string;
  statusCode: number;
};

// Details interfaces
export interface ValidationErrorDetails {
  field?: string; // Optional for multi-field errors
  value?: unknown;
  constraint?: string;
  fields?: Array<{ field: string; message: string }>; // For multi-field errors
}

export interface ProjectErrorDetails {
  projectId?: string;
  userId?: string;
  role?: string;
  [key: string]: unknown; // Domain-specific fields
}

export interface FileErrorDetails {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  [key: string]: unknown;
}

export interface AuthErrorDetails {
  provider?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface SystemErrorDetails {
  operation?: string;
  originalError?: unknown;
  [key: string]: unknown;
}

// Transport error details (frontend only)
export interface TransportErrorDetails {
  originalError?: unknown;
  url?: string;
  method?: string;
  statusCode?: number;
}

// Error code type exports (will be defined in domain files)
export type ValidationErrorCode = string;
export type ProjectErrorCode = string;
export type FileErrorCode = string;
export type AuthErrorCode = string;
export type SystemErrorCode = string;
