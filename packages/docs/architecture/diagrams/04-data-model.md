# Data Model

The hierarchical structure of data within CoRATES, including organizations, projects, and collaborative content.

```mermaid
erDiagram
    ORGANIZATION ||--o{ PROJECT : owns
    ORGANIZATION ||--o{ ORG_MEMBER : has
    PROJECT ||--o{ STUDY : contains
    PROJECT ||--o{ PROJECT_MEMBER : has
    STUDY ||--o{ CHECKLIST : has
    CHECKLIST ||--o{ ANSWER : contains

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
        string role "owner, collaborator, member, viewer"
        date joinedAt
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

Research project container belonging to an organization. Basic metadata (id, name, description, orgId, createdBy) stored in D1 for authorization. Content stored in Durable Objects via Yjs.

**Role hierarchy:** `owner > collaborator > member > viewer`

### Study

A systematic review or research paper being assessed. Stored entirely in Durable Objects (Yjs Document). Can have an associated PDF stored in R2.

### Checklist

An assessment using a specific tool (AMSTAR-2, ROBINS-I). Stored entirely in Durable Objects (Yjs Document). Assigned to a team member.

### Answer

Individual response to a checklist question. Stored entirely in Durable Objects (Yjs Document). Tracks who made the change and when.

## Storage Split

| Entity                          | Storage                        | Reason                                                                                                 |
| ------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Users                           | D1 (SQLite)                    | User accounts, authentication                                                                          |
| Organizations                   | D1 (SQLite)                    | Org metadata, Better Auth plugin                                                                       |
| Org Members                     | D1 (SQLite)                    | Org membership and roles                                                                               |
| Projects (metadata)             | D1 (SQLite)                    | Basic project info (id, name, description, orgId, createdBy) - source of truth for access control      |
| Project Members                 | D1 (SQLite)                    | Project-level access control (who can access which projects)                                           |
| Project Invitations             | D1 (SQLite)                    | Pending invitations with org and project context                                                       |
| Studies, Checklists, Answers    | Durable Objects (Yjs Document) | All project content - real-time sync, offline collaboration                                            |
| Project Metadata (synced)       | Durable Objects (Yjs Document) | Synced copy from D1 for real-time access                                                               |
| Project Members (synced)        | Durable Objects (Yjs Document) | Synced copy from D1 for real-time access                                                               |
| PDFs                            | R2                             | Large binary files                                                                                     |

## Architecture Notes

- **Organizations** are the top-level multi-tenant boundary. Users can belong to multiple orgs.
- **D1** stores organization, project metadata, and membership relationships. This is the source of truth for authorization and access control.
- **Durable Objects** store the actual project content (studies, checklists, answers) in a Yjs Document, plus synced copies of metadata and members for real-time collaborative access.
- When a project is created, it's written to D1 first (with orgId), then metadata is synced to the Durable Object.
- **Project invitations** include `orgId` and `orgRole` so accepting an invitation grants both org and project membership.
- The Yjs Document enables real-time collaboration and offline support through CRDTs.
