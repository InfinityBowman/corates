```markdown
---
name: Data Safety Analysis
description: This skill should be used when auditing data safety, migration reversibility, backup strategies, destructive operations, and data integrity for production readiness.
version: 1.0.0
---

# Data Safety Analysis Framework

Use this framework when auditing data handling, migrations, and backup strategies. Focus on preventing irreversible data mistakes.

## Analysis Criteria

### 1. Write Path Audit

**What to check:**

- All database write operations (INSERT, UPDATE, DELETE)
- Bulk operations and batch processing
- Data transformations and migrations
- Import/export functionality

**Dangerous patterns:**
```

// Hard delete without soft delete option
DELETE FROM users WHERE id = ?

// Bulk update without WHERE clause validation
UPDATE projects SET status = 'archived'

// Cascade delete that might remove too much
DELETE FROM organizations -- cascades to members, projects, etc.

```

**Safe patterns:**

```

// Soft delete
UPDATE users SET deleted_at = NOW() WHERE id = ?

// Scoped bulk operations
UPDATE projects SET status = 'archived' WHERE org_id = ? AND created_at < ?

// Explicit cascade with logging
BEGIN TRANSACTION
-- Log what will be deleted
INSERT INTO deletion_log SELECT \* FROM related_table WHERE parent_id = ?
DELETE FROM related_table WHERE parent_id = ?
COMMIT

````

### 2. Migration Safety

**What to check:**

- Are migrations reversible (both up and down)?
- Are migrations idempotent (safe to run multiple times)?
- Do migrations lock tables for extended periods?
- Is data preserved during schema changes?

**Red flags:**

- `DROP TABLE` without backup
- `DROP COLUMN` with data loss
- `ALTER TABLE` on large tables without online DDL
- No down migration defined
- Migrations that depend on application state

**Safe migration patterns:**

```sql
-- Reversible column add
-- Up
ALTER TABLE users ADD COLUMN phone TEXT;

-- Down
ALTER TABLE users DROP COLUMN phone;

-- Data migration with backup
-- Up
CREATE TABLE users_backup AS SELECT * FROM users;
ALTER TABLE users ADD COLUMN full_name TEXT;
UPDATE users SET full_name = first_name || ' ' || last_name;

-- Down
UPDATE users SET first_name = split_part(full_name, ' ', 1);
ALTER TABLE users DROP COLUMN full_name;
DROP TABLE users_backup;
````

### 3. Backup and Recovery

**What to check:**

- Is there an automated backup strategy?
- How often are backups taken?
- Are backups tested regularly?
- Can you restore to a point in time?
- How long does restoration take?

**Questions to answer:**

1. If the database is corrupted, can you restore it?
2. How much data would be lost? (RPO - Recovery Point Objective)
3. How long would restoration take? (RTO - Recovery Time Objective)
4. Has restoration been tested in the last 30 days?

### 4. Data Versioning and Audit

**What to check:**

- Is there an audit trail for sensitive data changes?
- Can you see who changed what and when?
- Is there versioning for critical entities?
- Can you recover previous versions?

**Audit trail pattern:**

```sql
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT,
  record_id TEXT,
  action TEXT,  -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  user_id TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### 5. Destructive Operation Protection

**What to check:**

- Are destructive operations behind confirmation?
- Is there a "trash" or "archive" before permanent deletion?
- Are bulk operations rate-limited or batched?
- Is there an undo mechanism for recent actions?

**Protection layers:**

1. Soft delete first (can be restored)
2. Retention period before hard delete (30 days)
3. Backup before any bulk destructive operation
4. Confirmation for operations affecting >N records

## Report Structure

```markdown
# Data Safety Audit Report

## Risk Summary

[Overall data safety assessment]

## Critical Data Risks

### Risk 1: [Title]

- **Severity**: Critical/High/Medium/Low
- **Location**: [file:line or migration name]
- **Issue**: [What the risk is]
- **Scenario**: [How data could be lost/corrupted]
- **Recommendation**: [How to mitigate]

## Migration Assessment

| Migration  | Reversible | Idempotent | Data Safe | Notes        |
| ---------- | ---------- | ---------- | --------- | ------------ |
| 0001_init  | Yes        | Yes        | Yes       | Safe         |
| 0002_add_X | No         | Yes        | No        | Drops column |

## Backup Assessment

- Backup frequency: [value]
- Last backup test: [date]
- Estimated RPO: [value]
- Estimated RTO: [value]

## Recommendations

### Immediate

[Critical fixes needed before launch]

### Pre-Launch

[Important improvements for launch safety]

### Post-Launch

[Improvements for ongoing safety]
```

## Analysis Process

1. **Map write paths**: Find all database writes
2. **Audit migrations**: Check each migration for reversibility
3. **Review backup strategy**: Check backup configuration and testing
4. **Identify destructive operations**: Find deletes and bulk updates
5. **Check audit trails**: Verify logging of sensitive changes
6. **Test recovery**: Verify backup restoration actually works

```

```
