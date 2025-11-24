-- Better Auth with Drizzle Schema Migration
-- Run: wrangler d1 migrations apply corates-db --local

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS room_members;
DROP TABLE IF EXISTS media_files;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS auth_accounts;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS users;

-- Better Auth user table
CREATE TABLE user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER DEFAULT 0,
  image TEXT,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch()),
  
  -- Custom fields for your app
  username TEXT UNIQUE,
  displayName TEXT,
  avatarUrl TEXT
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
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
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

-- Application-specific tables
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  isPublic INTEGER DEFAULT 1,
  createdBy TEXT REFERENCES user(id),
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch())
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  roomId TEXT NOT NULL REFERENCES rooms(id),
  userId TEXT NOT NULL REFERENCES user(id),
  content TEXT NOT NULL,
  messageType TEXT DEFAULT 'text',
  metadata TEXT, -- JSON string
  createdAt INTEGER DEFAULT (unixepoch())
);

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

CREATE TABLE roomMembers (
  id TEXT PRIMARY KEY,
  roomId TEXT NOT NULL REFERENCES rooms(id),
  userId TEXT NOT NULL REFERENCES user(id),
  role TEXT DEFAULT 'member',
  joinedAt INTEGER DEFAULT (unixepoch())
);

-- Create indexes for better performance
CREATE INDEX idx_session_userId ON session(userId);
CREATE INDEX idx_session_token ON session(token);
CREATE INDEX idx_account_userId ON account(userId);
CREATE INDEX idx_account_providerId ON account(providerId);
CREATE INDEX idx_verification_identifier ON verification(identifier);
CREATE INDEX idx_messages_roomId ON messages(roomId);
CREATE INDEX idx_messages_userId ON messages(userId);
CREATE INDEX idx_messages_createdAt ON messages(createdAt);
CREATE INDEX idx_mediaFiles_uploadedBy ON mediaFiles(uploadedBy);
CREATE INDEX idx_roomMembers_roomId ON roomMembers(roomId);
CREATE INDEX idx_roomMembers_userId ON roomMembers(userId);

-- Insert default data
INSERT OR IGNORE INTO user (id, name, email, emailVerified, username, displayName) VALUES
  ('system', 'System', 'system@corates.com', 1, 'system', 'System'),
  ('demo-user', 'Demo User', 'demo@corates.com', 1, 'demo', 'Demo User');

INSERT OR IGNORE INTO rooms (id, name, description, createdBy) VALUES
  ('general', 'General', 'General discussion room', 'system'),
  ('random', 'Random', 'Random conversations', 'system');

INSERT OR IGNORE INTO roomMembers (id, roomId, userId, role) VALUES
  ('rm_1', 'general', 'demo-user', 'member'),
  ('rm_2', 'random', 'demo-user', 'member');