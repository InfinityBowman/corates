````markdown
---
name: Performance Analysis
description: This skill should be used when auditing performance, scalability, hot paths, algorithmic complexity, caching, and load readiness for production.
version: 1.0.0
---

# Performance Analysis Framework

Use this framework when auditing performance and scalability. Focus on identifying what will break under real production load.

## Analysis Criteria

### 1. Hot Path Identification

**What to check:**

- High-frequency operations (every request)
- User-facing latency-sensitive operations
- Operations that run on every page load
- Background jobs processing large volumes

**Prioritize by:**

1. Frequency x Latency = Total time spent
2. User-facing vs background
3. Revenue-impacting paths

### 2. Algorithmic Complexity

**What to check:**

- O(n^2) or worse operations on user data
- Nested loops over collections
- Repeated database queries in loops (N+1)
- String concatenation in loops

**Dangerous patterns:**

```javascript
// O(n^2) - nested loop
for (const user of users) {
  for (const project of projects) {
    if (project.userId === user.id) { ... }
  }
}

// N+1 queries
for (const user of users) {
  const projects = await db.query('SELECT * FROM projects WHERE user_id = ?', [user.id])
}

// Unbounded fetch
const allUsers = await db.query('SELECT * FROM users') // No LIMIT
```
````

**Improved patterns:**

```javascript
// O(n) with Map
const projectsByUser = new Map(projects.map(p => [p.userId, p]));
for (const user of users) {
  const project = projectsByUser.get(user.id);
}

// Single query with JOIN
const usersWithProjects = await db.query(`
  SELECT u.*, p.* FROM users u 
  LEFT JOIN projects p ON p.user_id = u.id
`);

// Paginated fetch
const users = await db.query('SELECT * FROM users LIMIT 100 OFFSET ?', [offset]);
```

### 3. Database Query Performance

**What to check:**

- Missing indexes on filtered/sorted columns
- SELECT \* when only specific columns needed
- Missing pagination on list queries
- Expensive JOINs on large tables
- Queries without LIMIT

**Index checklist:**

- Foreign keys (user_id, project_id, etc.)
- Columns in WHERE clauses
- Columns in ORDER BY clauses
- Columns in JOIN conditions

### 4. Caching Strategy

**What to check:**

- What is cached vs computed on every request?
- Are cache keys correct (no over/under caching)?
- Is cache invalidation handled properly?
- What is the cold cache penalty?

**Caching checklist:**

- [ ] User session data cached
- [ ] Frequently accessed static data cached
- [ ] Expensive computations cached
- [ ] Cache invalidation on data changes
- [ ] Cache TTLs appropriate for data freshness needs

### 5. Resource Limits and Backpressure

**What to check:**

- Are there limits on upload sizes?
- Are there limits on query result sizes?
- Is there pagination for large lists?
- Are concurrent operations limited?
- Is there backpressure when downstream is slow?

**Unbounded operation risks:**

```javascript
// Unbounded file upload
app.post('/upload', (req, res) => {
  // No size limit!
  const file = await req.file()
})

// Unbounded query results
const allRecords = await db.query('SELECT * FROM large_table')

// Unbounded concurrent operations
const results = await Promise.all(urls.map(url => fetch(url)))
// Could be 10,000 concurrent requests!
```

### 6. Cold Start and Initialization

**What to check:**

- How long does the application take to start?
- Are there expensive operations at startup?
- Is there lazy loading where appropriate?
- What is the first-request latency?

**Cold start concerns:**

- Database connection establishment
- Cache warming
- Config loading
- Dependency injection setup

### 7. Memory and Resource Usage

**What to check:**

- Are large objects held in memory unnecessarily?
- Are streams used for large file processing?
- Are database connections pooled?
- Are there memory leaks in long-running processes?

**Memory patterns:**

```javascript
// Bad: Load entire file into memory
const content = await fs.readFile(largefile);

// Good: Stream processing
const stream = fs.createReadStream(largefile);
stream.pipe(processor);
```

## Report Structure

```markdown
# Performance Audit Report

## Risk Summary

[Overall performance risk assessment]

## Hot Paths Identified

| Path          | Frequency | Current Latency | Risk   |
| ------------- | --------- | --------------- | ------ |
| /api/projects | High      | 200ms           | Medium |
| /api/search   | Medium    | 500ms           | High   |

## Critical Performance Issues

### Issue 1: [Title]

- **Location**: [file:line]
- **Issue**: [What's slow]
- **Impact**: [User experience / scale limit]
- **Current**: [Current behavior/complexity]
- **Recommendation**: [How to fix]

## Scaling Concerns

[What breaks at 10x, 100x current load]

## Caching Assessment

| Data          | Cached | TTL | Invalidation |
| ------------- | ------ | --- | ------------ |
| User sessions | Yes    | 1h  | On logout    |
| Project list  | No     | -   | -            |

## Resource Limits

| Resource      | Limit | Current     |
| ------------- | ----- | ----------- |
| Upload size   | None! | Unlimited   |
| Query results | 1000  | Appropriate |

## Recommendations

### Immediate (pre-launch)

[Must fix for launch]

### Short-term (first month)

[Should fix soon after launch]

### Long-term (as you scale)

[Will need as traffic grows]
```

## Analysis Process

1. **Identify hot paths**: Find high-frequency, latency-sensitive operations
2. **Review complexity**: Look for O(n^2)+, N+1, unbounded operations
3. **Check indexes**: Verify database queries have appropriate indexes
4. **Audit caching**: Review what's cached and cache invalidation
5. **Check limits**: Verify resource limits and pagination
6. **Profile if possible**: Use actual timing data if available

```

```
