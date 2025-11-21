-- Migration to create initial tables
-- Run: wrangler d1 migrations apply corates-db --local

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT 1,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Messages table (for persistent storage beyond Durable Objects)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- text, image, file, etc.
  metadata TEXT, -- JSON string for additional data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Media files table (for R2 bucket references)
CREATE TABLE IF NOT EXISTS media_files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by TEXT,
  bucket_key TEXT NOT NULL, -- R2 object key
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Room memberships
CREATE TABLE IF NOT EXISTS room_members (
  room_id TEXT,
  user_id TEXT,
  role TEXT DEFAULT 'member', -- member, moderator, admin
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_by ON media_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);

-- Insert some default data
INSERT OR IGNORE INTO users (id, username, display_name) VALUES
  ('system', 'system', 'System'),
  ('demo-user', 'demo', 'Demo User');

INSERT OR IGNORE INTO rooms (id, name, description, created_by) VALUES
  ('general', 'General', 'General discussion room', 'system'),
  ('random', 'Random', 'Random conversations', 'system');

INSERT OR IGNORE INTO room_members (room_id, user_id, role) VALUES
  ('general', 'demo-user', 'member'),
  ('random', 'demo-user', 'member');