PRAGMA foreign_keys=ON;

DROP TABLE IF EXISTS videos;
DROP TABLE IF EXISTS scenes;
DROP TABLE IF EXISTS scenario_versions;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  idea TEXT NOT NULL DEFAULT '',
  genre TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'ar',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE scenario_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, version_no)
);

CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene_no INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  time_of_day TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  dialogue TEXT NOT NULL DEFAULT '',
  visual_prompt TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, scene_no)
);

CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'generating',
  error TEXT,
  mime_type TEXT DEFAULT 'video/mp4',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);
