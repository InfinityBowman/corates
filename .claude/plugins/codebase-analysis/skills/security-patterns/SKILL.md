---
name: Security Patterns Analysis
description: This skill should be used when the user asks to "analyze security", "security audit", "check for vulnerabilities", "review authentication", "check authorization", "find security issues", "OWASP review", or mentions security patterns, input validation, secrets handling, or secure coding practices.
version: 1.0.0
---

# Security Patterns Analysis Framework

Use this framework when analyzing a codebase for security concerns. Focus on identifying vulnerabilities and insecure patterns.

## Analysis Criteria

### 1. Input Validation and Sanitization

**What to check:**
- All user input is validated before use
- Validation happens at system boundaries (API endpoints, form handlers)
- Schema validation using libraries like Zod, Yup, or similar
- Type coercion is handled safely

**Common vulnerabilities:**
- SQL Injection: User input in database queries without parameterization
- XSS: User input rendered in HTML without escaping
- Command Injection: User input in shell commands
- Path Traversal: User input in file paths without validation

**Look for:**
```
// Dangerous patterns
query(`SELECT * FROM users WHERE id = ${userId}`)
element.innerHTML = userInput
exec(`ls ${userPath}`)
readFile(basePath + userInput)

// Safe patterns
query('SELECT * FROM users WHERE id = ?', [userId])
element.textContent = userInput
execFile('ls', [validatedPath])
readFile(path.join(basePath, path.basename(userInput)))
```

### 2. Authentication

**What to check:**
- Password hashing uses modern algorithms (bcrypt, argon2, scrypt)
- Session management is secure (httpOnly, secure, sameSite cookies)
- Token expiration and refresh patterns
- Multi-factor authentication support
- Account lockout after failed attempts

**Warning signs:**
- Plain text password storage
- MD5 or SHA1 for password hashing
- Passwords in logs or error messages
- Session tokens in URLs
- No session expiration

### 3. Authorization

**What to check:**
- Access control on every protected resource
- Role-based or attribute-based access control
- Authorization checked server-side, not just client-side
- Principle of least privilege applied

**Warning signs:**
- Missing authorization checks on endpoints
- Client-side only access control
- Overly permissive default access
- Role checks scattered inconsistently

### 4. Secrets Management

**What to check:**
- No hardcoded secrets, API keys, or credentials
- Environment variables or secret managers for sensitive config
- Secrets not logged or exposed in errors
- .env files in .gitignore

**Search for patterns:**
```
// Dangerous
const apiKey = "sk-1234567890abcdef"
password: "hardcoded123"
Authorization: "Bearer actual-token"

// Safe
const apiKey = process.env.API_KEY
password: config.get('db.password')
```

### 5. Data Exposure

**What to check:**
- Sensitive data not in logs
- Error messages don't leak internal details
- API responses don't include unnecessary sensitive fields
- Database queries select only needed columns

**Warning signs:**
- Stack traces exposed to users
- Internal IDs or paths in error messages
- Returning full user objects including passwords
- Verbose logging of request/response bodies

### 6. HTTPS and Transport Security

**What to check:**
- All external communications use HTTPS
- Certificate validation not disabled
- Secure headers (HSTS, CSP, X-Frame-Options)
- No mixed content

### 7. Dependency Security

**What to check:**
- Dependencies are up to date
- Known vulnerabilities in dependencies (npm audit, etc.)
- Lock files committed
- Minimal dependency surface

### 8. OWASP Top 10 Checklist

1. **Broken Access Control**: Authorization bypasses, privilege escalation
2. **Cryptographic Failures**: Weak crypto, exposed sensitive data
3. **Injection**: SQL, NoSQL, OS command, LDAP injection
4. **Insecure Design**: Missing security controls by design
5. **Security Misconfiguration**: Default configs, verbose errors
6. **Vulnerable Components**: Outdated dependencies
7. **Authentication Failures**: Weak auth, credential stuffing
8. **Data Integrity Failures**: Insecure deserialization, unsigned updates
9. **Logging Failures**: Missing audit logs, log injection
10. **SSRF**: Server-side request forgery

## Report Structure

```markdown
# Security Analysis Report

## Risk Summary
[High/Medium/Low overall risk assessment]

## Critical Findings
[Issues requiring immediate attention]

### Finding 1: [Title]
- **Severity**: Critical/High/Medium/Low
- **Location**: [file:line]
- **Description**: [What the issue is]
- **Impact**: [What could happen if exploited]
- **Recommendation**: [How to fix]

## Security Strengths
[Positive security patterns found]

## Recommendations by Priority

### Immediate Actions
[Critical fixes needed now]

### Short-term Improvements
[Important but less urgent]

### Long-term Hardening
[Defense in depth improvements]

## OWASP Top 10 Assessment
[Status for each category]
```

## Analysis Process

1. **Map attack surface**: Identify entry points (APIs, forms, file uploads)
2. **Review authentication flow**: Trace login, session, and token handling
3. **Check authorization**: Verify access control on sensitive operations
4. **Search for secrets**: Grep for hardcoded credentials and keys
5. **Audit input handling**: Trace user input through the system
6. **Review dependencies**: Check for known vulnerabilities
7. **Examine error handling**: Look for information leakage
8. **Document findings**: Create prioritized report with remediation steps
