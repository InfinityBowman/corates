export interface ProjectMember {
  id: string;
  userId: string;
  role: string;
  userAvatar?: string;
  userDisplayName?: string;
  userName?: string;
  userEmail?: string;
  joinedAt?: string | number | Date;
}

export interface ProjectFile {
  id: string;
  originalName?: string;
  filename?: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy?: string;
  uploaderDisplayName?: string;
  uploaderName?: string;
  createdAt?: string | number | Date;
}

export interface ProjectInvitation {
  id: string;
  email: string;
  role: string;
  grantOrgMembership?: boolean;
  acceptedAt?: string | number | Date | null;
  expiresAt?: number;
  invitedBy: string;
  inviterDisplayName?: string;
  inviterName?: string;
  createdAt?: string | number | Date;
}

export interface ProjectData {
  project: {
    id: string;
    name: string;
    description?: string;
    orgId: string;
    orgName: string;
    orgSlug: string;
    createdBy: string;
    creatorDisplayName?: string;
    creatorName?: string;
    creatorEmail?: string;
    createdAt?: string | number | Date;
    updatedAt?: string | number | Date;
  };
  stats: {
    memberCount: number;
    fileCount: number;
    totalStorageBytes: number;
  };
  members?: ProjectMember[];
  files?: ProjectFile[];
  invitations?: ProjectInvitation[];
}

export interface ProjectDocStats {
  rows: {
    total: number;
    snapshot: number;
    update: number;
    snapshotBytes: number;
    updateBytes: number;
    totalBytes: number;
  };
  encodedSnapshotBytes: number;
  memoryUsagePercent: number;
  content: { members: number; studies: number; checklists: number; pdfs: number };
  timestamps: { oldestRowAt: number | null; newestRowAt: number | null };
}
