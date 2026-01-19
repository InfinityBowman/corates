````markdown
---
name: Observability Analysis
description: This skill should be used when auditing logging, metrics, monitoring, alerting, and debuggability for production readiness.
version: 1.0.0
---

# Observability Analysis Framework

Use this framework when auditing logging, monitoring, and debugging capabilities. Focus on ensuring the team can diagnose and fix production issues quickly.

## Analysis Criteria

### 1. Logging Quality

**What to check:**

- Are errors logged with sufficient context?
- Are logs structured (JSON) or unstructured (text)?
- Is there a consistent log level strategy?
- Are sensitive data excluded from logs?

**Good logging patterns:**

```javascript
// Structured logging with context
logger.error('Payment failed', {
  userId: user.id,
  orderId: order.id,
  errorCode: error.code,
  errorMessage: error.message,
  // NOT: creditCardNumber, password, etc.
});

// Request context included
logger.info('Request completed', {
  requestId: req.id,
  path: req.path,
  duration: endTime - startTime,
  statusCode: res.statusCode,
});
```
````

**Bad logging patterns:**

```javascript
// No context
logger.error('Something went wrong');

// Sensitive data exposure
logger.info('User login', { password: user.password });

// Inconsistent format
console.log('Error: ' + err);
```

### 2. Request Tracing

**What to check:**

- Are requests assigned correlation/trace IDs?
- Can you trace a request across services?
- Are trace IDs included in all logs?
- Can you trace a user's journey through the system?

**Correlation ID pattern:**

```javascript
// Generate or extract trace ID
const traceId = req.headers['x-trace-id'] || generateUUID();

// Include in all logs
logger.info('Processing request', { traceId, ...data });

// Pass to downstream services
await fetch(url, {
  headers: { 'x-trace-id': traceId },
});

// Include in error responses
res.json({ error: message, traceId });
```

### 3. Metrics and Monitoring

**What to check:**

- Are key business metrics tracked?
- Are infrastructure metrics available?
- Is there real-time visibility into system health?
- Are there dashboards for key metrics?

**Key metrics to track:**

- **Request rate**: Requests per second by endpoint
- **Error rate**: Errors per second, error percentage
- **Latency**: p50, p95, p99 response times
- **Saturation**: CPU, memory, connection pool usage
- **Business metrics**: Signups, conversions, revenue

### 4. Alerting Strategy

**What to check:**

- Are critical failures surfaced immediately?
- Is there alert fatigue (too many alerts)?
- Are alerts actionable (clear what to do)?
- Is there escalation for unacknowledged alerts?

**Good alert criteria:**

- **Specific**: Points to what's wrong
- **Actionable**: Clear what to do
- **Significant**: Worth waking someone up
- **Timely**: Fires before users notice

**Alert checklist:**

- [ ] Error rate spike
- [ ] Latency p99 > threshold
- [ ] Service unavailable
- [ ] Database connection failures
- [ ] External dependency failures
- [ ] Security events (auth failures)
- [ ] Business metric anomalies

### 5. Error Reporting

**What to check:**

- Are errors aggregated and deduplicated?
- Can you see error trends over time?
- Are errors linked to releases?
- Do error reports include stack traces and context?

**Error context to capture:**

- Stack trace
- Request information (path, method, headers - not sensitive)
- User information (ID, not PII)
- Environment (version, region, instance)
- Related trace ID

### 6. Health Checks

**What to check:**

- Is there a health check endpoint?
- Does it check downstream dependencies?
- Is it used for load balancer health?
- Does it distinguish between "healthy" and "ready"?

**Health check pattern:**

```javascript
// Liveness: Is the process alive?
app.get('/health/live', (req, res) => {
  res.json({ status: 'ok' });
});

// Readiness: Can it serve traffic?
app.get('/health/ready', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    cache: await checkCache(),
    // external: await checkExternalService() // Optional
  };
  const healthy = Object.values(checks).every(c => c.ok);
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'unhealthy', checks });
});
```

### 7. Debug Access

**What to check:**

- Can you access logs quickly during an incident?
- Can you query logs by trace ID, user ID, time range?
- Are there debug endpoints for internal state?
- Can you enable verbose logging without redeploy?

**Debug capabilities:**

- Log search and filtering
- Request replay or inspection
- State inspection endpoints (admin only)
- Dynamic log level adjustment
- Feature flags to enable debug mode

## Anti-Patterns to Flag

**Log privacy violations:**

- Passwords in logs
- Credit card numbers
- Personal information (SSN, etc.)
- Auth tokens or API keys

**Observability gaps:**

- Console.log instead of structured logging
- No error aggregation
- No request tracing
- Silent failures (catch without log)

## Report Structure

```markdown
# Observability Audit Report

## Risk Summary

[Overall observability assessment]

## Logging Assessment

| Aspect              | Status         | Notes |
| ------------------- | -------------- | ----- |
| Structured logging  | Yes/No         |       |
| Error context       | Yes/Partial/No |       |
| Sensitive data      | Clean/At Risk  |       |
| Request correlation | Yes/No         |       |

## Monitoring Gaps

### Gap 1: [Title]

- **Issue**: [What's missing]
- **Risk**: [Why it matters]
- **Recommendation**: [How to fix]

## Alerting Assessment

| Alert            | Configured | Actionable | Notes   |
| ---------------- | ---------- | ---------- | ------- |
| Error rate spike | No         | -          | Missing |
| Latency > 2s     | Yes        | Yes        | Good    |

## Debug Capabilities

- Log access: [Easy/Difficult/None]
- Log search: [Available/Limited/None]
- Trace lookup: [Yes/No]
- Debug endpoints: [Yes/No]

## Recommendations

### Before Launch

[Critical observability gaps to address]

### First Week

[Important improvements for production operations]

### Ongoing

[Observability maturity improvements]
```

## Analysis Process

1. **Audit logging**: Check log statements for structure, context, privacy
2. **Check tracing**: Verify correlation IDs are present and propagated
3. **Review metrics**: Identify what's tracked and what's missing
4. **Assess alerting**: Check for critical alerts and alert quality
5. **Test debug flow**: Can you find logs for a specific request/error?
6. **Check health endpoints**: Verify health checks exist and are comprehensive

```

```
