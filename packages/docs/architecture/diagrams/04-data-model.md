# Data Model

The hierarchical structure of data within CoRATES, including organizations, projects, and collaborative content.

```mermaid
erDiagram
    ORGANIZATION ||--o{ PROJECT : owns
    ORGANIZATION ||--o{ ORG_MEMBER : has
    ORGANIZATION ||--o| SUBSCRIPTION : has
    ORGANIZATION ||--o| ORG_ACCESS_GRANT : has
    PROJECT ||--o{ STUDY : contains
    PROJECT ||--o{ PROJECT_MEMBER : has
    PROJECT ||--o{ PROJECT_INVITATION : has
    STUDY ||--o{ CHECKLIST : has
    CHECKLIST ||--o{ ANSWER : contains
    USER ||--o{ TWO_FACTOR : has

    ORGANIZATION {
        string id PK
        string name
        string slug UK
        string logo
        date createdAt
    }

    ORG_MEMBER {
        string id PK
        string userId FK
        string organizationId FK
        string role "owner, admin, member"
        date createdAt
    }

    SUBSCRIPTION {
        string id PK
        string orgId FK
        string planId
        string stripeSubscriptionId
        string status
        date currentPeriodStart
        date currentPeriodEnd
    }

    ORG_ACCESS_GRANT {
        string id PK
        string orgId FK
        string grantType "trial, single_project"
        string projectId FK "nullable"
        date expiresAt
        date createdAt
    }

    PROJECT {
        string id PK
        string name
        string description
        string orgId FK
        string createdBy FK
        date createdAt
    }

    PROJECT_MEMBER {
        string id PK
        string projectId FK
        string userId FK
        string role "owner, member"
        date joinedAt
    }

    PROJECT_INVITATION {
        string id PK
        string projectId FK
        string email
        string role
        bool grantOrgMembership
        string orgRole "nullable"
        date expiresAt
    }

    STUDY {
        string id PK
        string title
        string pdfKey
        date createdAt
    }

    CHECKLIST {
        string id PK
        string title
        string assignedTo
        string status
        string type "AMSTAR2, ROBINS-I"
    }

    ANSWER {
        string questionKey PK
        string value
        string notes
        string updatedBy
        date updatedAt
    }
```

## Entity Details

### Organization

Top-level workspace container. Organizations group projects and team members. Managed by Better Auth organization plugin. Stored in D1.

**Role hierarchy:** `owner > admin > member`

### Project

Research project container belonging to an organization. Basic metadata (id, name, orgId, createdBy) stored in D1 for authorization. Content stored as sync-engine rows in the project's workspace Durable Object (WorkspaceDO).

**Role hierarchy:** `owner > member`

### Study

A systematic review or research paper being assessed. Stored entirely in the workspace Durable Object (sync-engine rows). Can have an associated PDF stored in R2.

### Checklist

An assessment using a specific tool (AMSTAR-2, ROBINS-I). Stored entirely in the workspace Durable Object (sync-engine rows). Assigned to a team member.

### Answer

Individual response to a checklist question. Stored entirely in the workspace Durable Object as flat-keyed answer rows. Tracks who made the change and when.

## Storage Split

| Entity                       | Storage                       | Reason                                                                                            |
| ---------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Users                        | D1 (SQLite)                   | User accounts, authentication                                                                     |
| Organizations                | D1 (SQLite)                   | Org metadata, Better Auth plugin                                                                  |
| Org Members                  | D1 (SQLite)                   | Org membership and roles                                                                          |
| Subscriptions                | D1 (SQLite)                   | Stripe subscriptions per org (Better Auth Stripe plugin)                                          |
| Org Access Grants            | D1 (SQLite)                   | Time-limited access (trials, single project purchases)                                            |
| Projects (metadata)          | D1 (SQLite)                   | Basic project info (id, name, description, orgId, createdBy) - source of truth for access control |
| Project Members              | D1 (SQLite)                   | Project-level access control (who can access which projects)                                      |
| Project Invitations          | D1 (SQLite)                   | Pending invitations with org and project context, optional org membership grant                   |
| Two-Factor Auth              | D1 (SQLite)                   | 2FA secrets and backup codes (Better Auth plugin)                                                 |
| Stripe Event Ledger          | D1 (SQLite)                   | Webhook audit log with two-phase trust model                                                      |
| Studies, Checklists, Answers | Durable Objects (WorkspaceDO) | All project content - sync-engine rows, real-time sync, offline collaboration                     |
| PDFs                         | R2                            | Large binary files                                                                                |

## Architecture Notes

- **Organizations** are the top-level multi-tenant boundary. Users can belong to multiple orgs.
- **D1** stores organization, project metadata, membership relationships, subscriptions, and access grants. This is the source of truth for authorization and access control.
- **Durable Objects** (one WorkspaceDO per project) store the actual project content (studies, checklists, answers) as sync-engine row collections. Membership, profile, and project metadata are never mirrored into the workspace - they are D1 facts, read at authorize time on connect.
- **Project invitations** include `orgId`, `orgRole`, and `grantOrgMembership` flag so accepting an invitation can optionally grant both org and project membership.
- **Subscriptions** are managed via Better Auth's Stripe plugin and synced via webhooks.
- **Access grants** provide time-limited upgrades (trials, single-project purchases) that override the base plan.
- The sync engine enables real-time collaboration and offline support: last-writer-wins rows written through named mutators, with Yjs CRDTs retained only for reconciliation consolidated notes.
