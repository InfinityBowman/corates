/**
 * Structured logger for Workers observability
 * Provides consistent JSON logging with correlation IDs and Stripe-specific fields
 */

/**
 * Log levels in order of severity
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

/**
 * Create a structured logger instance for a request
 * @param {Object} options - Logger options
 * @param {Object} options.c - Hono context
 * @param {string} options.service - Service name (e.g., 'stripe-webhook', 'billing')
 * @param {Object} [options.env] - Environment object
 * @returns {Object} Logger instance with log methods
 */
export function createLogger({ c, service, env }) {
  const requestId = getOrCreateRequestId(c);
  const cfRay = c?.req?.header('cf-ray') || null;
  const environment = env?.ENVIRONMENT || 'development';

  // Set request ID on response header for tracing
  if (c?.header) {
    c.header('X-Request-Id', requestId);
  }

  /**
   * Build the base log entry with common fields
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   * @returns {Object} Structured log entry
   */
  function buildLogEntry(level, message, data = {}) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      service,
      env: environment,
      requestId,
      cfRay,
      message,
      ...data,
    };

    // Add route/method if available from context
    if (c?.req) {
      entry.route = c.req.path;
      entry.method = c.req.method;
    }

    return entry;
  }

  /**
   * Output log entry to console in JSON format
   * @param {string} level - Log level
   * @param {Object} entry - Log entry
   */
  function output(level, entry) {
    const json = JSON.stringify(entry);
    switch (level) {
      case LogLevel.ERROR:
        console.error(json);
        break;
      case LogLevel.WARN:
        console.warn(json);
        break;
      case LogLevel.DEBUG:
        console.debug(json);
        break;
      default:
        console.log(json);
    }
  }

  return {
    requestId,
    cfRay,

    debug(message, data) {
      const entry = buildLogEntry(LogLevel.DEBUG, message, data);
      output(LogLevel.DEBUG, entry);
      return entry;
    },

    info(message, data) {
      const entry = buildLogEntry(LogLevel.INFO, message, data);
      output(LogLevel.INFO, entry);
      return entry;
    },

    warn(message, data) {
      const entry = buildLogEntry(LogLevel.WARN, message, data);
      output(LogLevel.WARN, entry);
      return entry;
    },

    error(message, data) {
      const entry = buildLogEntry(LogLevel.ERROR, message, data);
      output(LogLevel.ERROR, entry);
      return entry;
    },

    /**
     * Log a Stripe-specific event with relevant fields
     * @param {string} action - Action being performed (e.g., 'webhook_received', 'checkout_initiated')
     * @param {Object} data - Stripe-specific data
     */
    stripe(action, data = {}) {
      const stripeData = {
        action,
        // Only include Stripe fields that are present
        ...(data.stripeEventId && { stripeEventId: data.stripeEventId }),
        ...(data.stripeEventType && { stripeEventType: data.stripeEventType }),
        ...(data.stripeMode && { stripeMode: data.stripeMode }),
        ...(data.stripeCustomerId && { stripeCustomerId: data.stripeCustomerId }),
        ...(data.stripeSubscriptionId && { stripeSubscriptionId: data.stripeSubscriptionId }),
        ...(data.stripeCheckoutSessionId && {
          stripeCheckoutSessionId: data.stripeCheckoutSessionId,
        }),
        ...(data.stripeRequestId && { stripeRequestId: data.stripeRequestId }),
        // Business identifiers
        ...(data.orgId && { orgId: data.orgId }),
        ...(data.userId && { userId: data.userId }),
        ...(data.plan && { plan: data.plan }),
        // Outcome fields
        ...(data.outcome && { outcome: data.outcome }),
        ...(data.errorCode && { errorCode: data.errorCode }),
        ...(data.status && { status: data.status }),
        ...(data.durationMs !== undefined && { durationMs: data.durationMs }),
        // Additional context
        ...(data.error && { error: truncateError(data.error) }),
        ...(data.payloadHash && { payloadHash: data.payloadHash }),
        ...(data.signaturePresent !== undefined && { signaturePresent: data.signaturePresent }),
      };

      const level = data.outcome === 'failed' || data.errorCode ? LogLevel.ERROR : LogLevel.INFO;
      const entry = buildLogEntry(level, `stripe.${action}`, stripeData);
      output(level, entry);
      return entry;
    },

    /**
     * Create a child logger with additional context
     * @param {Object} context - Additional context to merge into all log entries
     * @returns {Object} Child logger instance
     */
    child(context) {
      const parent = this;
      return {
        requestId,
        cfRay,
        debug(message, data) {
          return parent.debug(message, { ...context, ...data });
        },
        info(message, data) {
          return parent.info(message, { ...context, ...data });
        },
        warn(message, data) {
          return parent.warn(message, { ...context, ...data });
        },
        error(message, data) {
          return parent.error(message, { ...context, ...data });
        },
        stripe(action, data) {
          return parent.stripe(action, { ...context, ...data });
        },
        child(additionalContext) {
          return parent.child({ ...context, ...additionalContext });
        },
      };
    },
  };
}

/**
 * Get or create a request ID from context
 * Checks for existing X-Request-Id header, otherwise generates new UUID
 * @param {Object} c - Hono context
 * @returns {string} Request ID
 */
export function getOrCreateRequestId(c) {
  // Check for existing request ID header
  const existingId = c?.req?.header('x-request-id');
  if (existingId) {
    return existingId;
  }

  // Generate new UUID
  return crypto.randomUUID();
}

/**
 * Truncate error message/object to prevent excessive log size
 * @param {Error|string|Object} error - Error to truncate
 * @param {number} maxLength - Maximum length (default 500)
 * @returns {string} Truncated error string
 */
export function truncateError(error, maxLength = 500) {
  if (!error) return null;

  let errorStr;
  if (error instanceof Error) {
    errorStr = error.message;
  } else if (typeof error === 'string') {
    errorStr = error;
  } else {
    try {
      errorStr = JSON.stringify(error);
    } catch {
      errorStr = String(error);
    }
  }

  if (errorStr.length > maxLength) {
    return errorStr.slice(0, maxLength) + '...[truncated]';
  }
  return errorStr;
}

/**
 * Compute SHA-256 hash of a string (for payload hashing)
 * @param {string} data - Data to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function sha256(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Measure duration of an async operation
 * @param {Function} fn - Async function to measure
 * @returns {Promise<{result: any, durationMs: number}>} Result and duration
 */
export async function withTiming(fn) {
  const start = Date.now();
  try {
    const result = await fn();
    return { result, durationMs: Date.now() - start };
  } catch (error) {
    error.durationMs = Date.now() - start;
    throw error;
  }
}
