import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine database path based on environment
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'tournaments.db')
  : path.join(__dirname, '../tournaments.db'); // Local development

console.log(`📁 Database path: ${dbPath}`);

// Initialize database
export const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Create tournaments table
db.exec(`
  CREATE TABLE IF NOT EXISTS tournaments (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    archived_by_ip TEXT,
    size_bytes INTEGER,
    player_count INTEGER,
    status TEXT
  );
`);

// Create indexes for performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_expires_at ON tournaments(expires_at);
  CREATE INDEX IF NOT EXISTS idx_created_at ON tournaments(created_at);
`);

console.log('✅ Database initialized');

// Prepared statements for common operations
export const queries = {
  // Insert or replace tournament
  saveTournament: db.prepare(`
    INSERT OR REPLACE INTO tournaments 
    (code, name, data, created_at, expires_at, archived_by_ip, size_bytes, player_count, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  // Get tournament by code
  getTournament: db.prepare(`
    SELECT * FROM tournaments WHERE code = ?
  `),

  // Delete expired tournaments
  deleteExpired: db.prepare(`
    DELETE FROM tournaments WHERE expires_at < ?
  `),

  // Get tournament count
  getCount: db.prepare(`
    SELECT COUNT(*) as count FROM tournaments
  `),

  // Get total size
  getTotalSize: db.prepare(`
    SELECT SUM(size_bytes) as total_size FROM tournaments
  `),

  // Get oldest tournaments
  getOldest: db.prepare(`
    SELECT code FROM tournaments 
    ORDER BY created_at ASC 
    LIMIT ?
  `),

  // Delete by code
  deleteByCode: db.prepare(`
    DELETE FROM tournaments WHERE code = ?
  `),

  // Get stats for health check
  getStats: db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(size_bytes) as total_size,
      MIN(expires_at) as next_expiration
    FROM tournaments
  `),

  // Count archives by IP in last 24 hours
  countRecentByIP: db.prepare(`
    SELECT COUNT(*) as count 
    FROM tournaments 
    WHERE archived_by_ip = ? 
    AND created_at > ?
  `)
};

export default db;
