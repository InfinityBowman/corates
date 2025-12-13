-- Consolidated Corates Database Schema
-- Run: wrangler d1 migrations apply corates-db --local

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS mediaFiles;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS auth_accounts;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS verification;
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS twoFactor;

-- Better Auth user table
CREATE TABLE user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER DEFAULT 0,
  image TEXT,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch()),
  username TEXT UNIQUE,
  displayName TEXT,
  avatarUrl TEXT,
  role TEXT, -- Better Auth admin/plugin role (e.g. 'user', 'admin')
  persona TEXT, -- optional: researcher, student, librarian, other
  profileCompletedAt INTEGER, -- unix timestamp (seconds)
  twoFactorEnabled INTEGER DEFAULT 0,
  -- Admin plugin fields
  banned INTEGER DEFAULT 0,
  banReason TEXT,
  banExpires INTEGER
);

-- Better Auth session table
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  expiresAt INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch()),
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  impersonatedBy TEXT REFERENCES user(id) ON DELETE SET NULL
);

-- Better Auth account table (for OAuth and password)
CREATE TABLE account (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope TEXT,
  password TEXT, -- For email/password auth
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch())
);

-- Better Auth verification table
CREATE TABLE verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch())
);

-- Better Auth two-factor table
CREATE TABLE twoFactor (
  id TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  backupCodes TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch())
);

-- Projects table (for user's research projects)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  createdBy TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch())
);

-- Project membership table (which users have access to which projects)
CREATE TABLE project_members (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- owner, collaborator, member, viewer
  joinedAt INTEGER DEFAULT (unixepoch()),
  
  -- Ensure unique user-project combinations
  UNIQUE(projectId, userId)
);

-- Subscriptions table (Stripe billing)
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  stripeCustomerId TEXT UNIQUE,
  stripeSubscriptionId TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'team', 'enterprise'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'trialing', 'incomplete'
  currentPeriodStart INTEGER,
  currentPeriodEnd INTEGER,
  cancelAtPeriodEnd INTEGER DEFAULT 0,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch()),
  
  UNIQUE(userId)
);

-- Media files table (for uploaded files stored in R2)
CREATE TABLE mediaFiles (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  originalName TEXT,
  fileType TEXT,
  fileSize INTEGER,
  uploadedBy TEXT REFERENCES user(id),
  bucketKey TEXT NOT NULL,
  createdAt INTEGER DEFAULT (unixepoch())
);

-- Create indexes for better performance

-- Auth indexes
CREATE INDEX idx_session_userId ON session(userId);
CREATE INDEX idx_session_token ON session(token);
CREATE INDEX idx_account_userId ON account(userId);
CREATE INDEX idx_account_providerId ON account(providerId);
CREATE INDEX idx_verification_identifier ON verification(identifier);

-- Two-factor indexes
CREATE INDEX idx_twoFactor_userId ON twoFactor(userId);

-- Project indexes
CREATE INDEX idx_projects_createdBy ON projects(createdBy);
CREATE INDEX idx_projects_createdAt ON projects(createdAt);
CREATE INDEX idx_project_members_projectId ON project_members(projectId);
CREATE INDEX idx_project_members_userId ON project_members(userId);

-- Subscription indexes
CREATE INDEX idx_subscriptions_userId ON subscriptions(userId);
CREATE INDEX idx_subscriptions_stripeCustomerId ON subscriptions(stripeCustomerId);
CREATE INDEX idx_subscriptions_stripeSubscriptionId ON subscriptions(stripeSubscriptionId);