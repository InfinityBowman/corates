export interface UserAccount {
  providerId: string;
  createdAt?: string | number | Date;
}

export interface UserOrg {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: string;
  billing: { planName: string; accessMode: string };
  membershipCreatedAt?: string | number | Date;
}

export interface UserProject {
  id: string;
  name: string;
  role: string;
  joinedAt?: string | number | Date;
}

export interface UserSession {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt?: string | number | Date;
  expiresAt?: string | number | Date;
}

export interface UserData {
  user: {
    id: string;
    name: string;
    email: string;
    username?: string;
    persona?: string;
    avatarUrl?: string;
    image?: string;
    role?: string;
    banned?: boolean;
    banReason?: string;
    banExpires?: string | number | Date;
    emailVerified?: boolean;
    twoFactorEnabled?: boolean;
    stripeCustomerId?: string;
    createdAt?: string | number | Date;
    updatedAt?: string | number | Date;
  };
  accounts?: UserAccount[];
  orgs?: UserOrg[];
  projects?: UserProject[];
  sessions?: UserSession[];
}
