---
name: Error Handling Analysis
description: This skill should be used when the user asks to "analyze error handling", "review exception handling", "check error patterns", "audit error recovery", "review logging", "check error boundaries", or mentions error handling patterns, exception management, graceful degradation, or error reporting.
version: 1.0.0
---

# Error Handling Analysis Framework

Use this framework when analyzing a codebase for error handling quality. Focus on consistency, user experience, and debuggability.

## Analysis Criteria

### 1. Error Capture and Propagation

**What to check:**
- Errors are caught at appropriate boundaries
- Error context is preserved when re-throwing
- Async errors are properly handled (try/catch with await, .catch())
- Promise rejections don't go unhandled

**Patterns to evaluate:**
```javascript
// Poor: Swallowing errors
try {
  await riskyOperation();
} catch (e) {
  // silently ignored
}

// Poor: Losing context
try {
  await riskyOperation();
} catch (e) {
  throw new Error('Operation failed');
}

// Good: Preserving context
try {
  await riskyOperation();
} catch (e) {
  throw new Error('Operation failed', { cause: e });
}

// Good: Handling at boundary with recovery
try {
  await riskyOperation();
} catch (e) {
  logger.error('Operation failed', { error: e });
  return fallbackValue;
}
```

### 2. Error Types and Classification

**What to check:**
- Custom error types for different failure categories
- Distinction between operational errors and programmer errors
- Error codes or types for programmatic handling
- Consistent error structure across the codebase

**Good patterns:**
- Typed/custom error classes
- Error codes for API responses
- Distinction between user errors and system errors
- Recoverable vs non-recoverable error handling

### 3. User-Facing Error Messages

**What to check:**
- User sees helpful, actionable messages
- Technical details hidden from users
- Consistent error message format
- Localization support if needed

**Warning signs:**
- Stack traces shown to users
- Generic "Something went wrong" everywhere
- Technical jargon in user messages
- Inconsistent error presentation

### 4. Error Boundaries (Frontend)

**What to check:**
- Component-level error boundaries
- Graceful degradation when components fail
- Error boundary placement strategy
- Recovery mechanisms (retry, refresh)

**Framework-specific patterns:**
- React: ErrorBoundary components
- SolidJS: ErrorBoundary components
- Vue: errorCaptured hook
- Angular: ErrorHandler service

### 5. API Error Responses

**What to check:**
- Consistent error response format
- Appropriate HTTP status codes
- Error codes for client handling
- Helpful error messages for developers

**Standard pattern:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

### 6. Logging and Observability

**What to check:**
- Errors logged with sufficient context
- Log levels used appropriately
- Structured logging format
- Correlation IDs for request tracing
- No sensitive data in logs

**Good logging includes:**
- Timestamp
- Error type/code
- Stack trace (in logs, not to users)
- Request context (user, endpoint, params)
- Correlation/request ID

### 7. Retry and Recovery Patterns

**What to check:**
- Transient failures have retry logic
- Exponential backoff for retries
- Circuit breaker for failing services
- Fallback values where appropriate
- Idempotency for retried operations

### 8. Validation Errors

**What to check:**
- Input validation happens early
- Validation errors are specific and helpful
- All invalid fields reported together
- Client and server validation aligned

## Report Structure

```markdown
# Error Handling Analysis Report

## Summary
[Overall assessment of error handling maturity]

## Coverage Assessment

### Error Boundaries
- Frontend: [Present/Missing/Partial]
- API Layer: [Present/Missing/Partial]
- Background Jobs: [Present/Missing/Partial]

### Logging
- Structure: [Structured/Unstructured]
- Context: [Sufficient/Insufficient]
- Levels: [Appropriate/Inconsistent]

## Issues Found

### Critical
[Errors that could cause crashes or data loss]

### Improvements Needed
[Inconsistencies and gaps]

## Positive Patterns
[Good error handling found]

## Recommendations

### Quick Wins
[Easy improvements with high impact]

### Systematic Improvements
[Larger refactoring suggestions]

## Error Flow Diagram
[Key error paths through the system]
```

## Analysis Process

1. **Map error boundaries**: Identify where errors should be caught
2. **Trace error flows**: Follow how errors propagate through layers
3. **Review logging**: Check what gets logged and how
4. **Check API responses**: Verify consistent error format
5. **Test edge cases**: Consider what happens when things fail
6. **Evaluate recovery**: Assess retry and fallback mechanisms
7. **Review user experience**: Check what users see when errors occur
8. **Document findings**: Create actionable improvement plan
