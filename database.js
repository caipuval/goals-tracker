// Database abstraction layer - supports both SQLite (local) and PostgreSQL (cloud)
require('dotenv').config();

let db = null;
let dbType = process.env.DATABASE_TYPE || 'sqlite'; // 'sqlite' or 'postgres'

if (dbType === 'postgres') {
  // PostgreSQL connection (for cloud database)
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  
  db = {
    type: 'postgres',
    
    async run(sql, params = []) {
      // Convert $1, $2 to $1, $2 (already PostgreSQL format) or ? to $1, $2
      const pgSql = convertToPostgresParams(sql);
      const result = await pool.query(pgSql, params);
      // Get the ID from RETURNING clause or from result
      const returningMatch = pgSql.match(/RETURNING\s+(\w+)/i);
      const id = returningMatch ? result.rows[0]?.[returningMatch[1]] : null;
      return { lastID: id || result.rows[0]?.id || null, changes: result.rowCount };
    },
    
    async get(sql, params = []) {
      const pgSql = convertToPostgresParams(sql);
      const result = await pool.query(pgSql, params);
      return result.rows[0] || null;
    },
    
    async all(sql, params = []) {
      const pgSql = convertToPostgresParams(sql);
      const result = await pool.query(pgSql, params);
      return result.rows;
    },
    
    async serialize(callback) {
      // PostgreSQL doesn't need serialization, just run callback
      await callback();
    },
    
    async close() {
      await pool.end();
    }
  };
  
  // Initialize PostgreSQL tables
  (async () => {
    try {
      await db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Add email column if it doesn't exist (for existing databases)
      try {
        await db.run(`ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE`);
      } catch (err) {
        // Column already exists, ignore
      }
      
      await db.run(`
        CREATE TABLE IF NOT EXISTS goals (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          duration_minutes INTEGER,
          type VARCHAR(20) NOT NULL CHECK(type IN ('daily', 'weekly', 'monthly', 'one-time')),
          start_date DATE NOT NULL,
          end_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      // Try to add duration_minutes if it doesn't exist
      try {
        await db.run(`ALTER TABLE goals ADD COLUMN duration_minutes INTEGER`);
      } catch (err) {
        // Column already exists, ignore
      }
      
      await db.run(`
        CREATE TABLE IF NOT EXISTS goal_completions (
          id SERIAL PRIMARY KEY,
          goal_id INTEGER NOT NULL,
          completion_date DATE NOT NULL,
          duration_minutes INTEGER NOT NULL,
          completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
          UNIQUE(goal_id, completion_date)
        )
      `);
      
      await db.run(`
        CREATE TABLE IF NOT EXISTS competitions (
          id SERIAL PRIMARY KEY,
          creator_id INTEGER NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      await db.run(`
        CREATE TABLE IF NOT EXISTS competition_logs (
          id SERIAL PRIMARY KEY,
          competition_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          duration_minutes INTEGER NOT NULL,
          logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
          logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      await db.run(`
        CREATE TABLE IF NOT EXISTS competition_invitations (
          id SERIAL PRIMARY KEY,
          competition_id INTEGER NOT NULL,
          inviter_id INTEGER NOT NULL,
          invitee_username VARCHAR(255) NOT NULL,
          invitee_id INTEGER,
          status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
          FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Friends (requests + accepted friendships)
      await db.run(`
        CREATE TABLE IF NOT EXISTS friend_requests (
          id SERIAL PRIMARY KEY,
          requester_id INTEGER NOT NULL,
          addressee_id INTEGER NOT NULL,
          status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(requester_id, addressee_id)
        )
      `);

      await db.run(`
        CREATE TABLE IF NOT EXISTS friendships (
          user_id INTEGER NOT NULL,
          friend_id INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
          PRIMARY KEY (user_id, friend_id)
        )
      `);
      
      console.log('✅ PostgreSQL database initialized');
    } catch (error) {
      console.error('❌ Database initialization error:', error.message);
    }
  })().catch(err => {
    console.error('❌ Database init unhandled:', err);
  });
  
} else {
  // SQLite connection (for local development)
  const sqlite3 = require('sqlite3').verbose();
  const { promisify } = require('util');
  
  const sqliteDb = new sqlite3.Database('goals.db');
  
  function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
  
  db = {
    type: 'sqlite',
    
    run: dbRun,
    get: promisify(sqliteDb.get.bind(sqliteDb)),
    all: promisify(sqliteDb.all.bind(sqliteDb)),
    
    async serialize(callback) {
      return new Promise((resolve, reject) => {
        sqliteDb.serialize(async () => {
          try {
            await callback();
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    },
    
    close() {
      return new Promise((resolve, reject) => {
        sqliteDb.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
  
  // Initialize SQLite tables
  (async () => {
    try {
      await db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Add email column if it doesn't exist (for existing databases)
      try {
        await db.run(`ALTER TABLE users ADD COLUMN email TEXT UNIQUE`);
      } catch (err) {
        // Ignore error if column already exists
      }
      
      await db.run(`
        CREATE TABLE IF NOT EXISTS goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          duration_minutes INTEGER,
          type TEXT NOT NULL CHECK(type IN ('daily', 'weekly', 'monthly', 'one-time')),
          start_date DATE NOT NULL,
          end_date DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      
      try {
        await db.run(`ALTER TABLE goals ADD COLUMN duration_minutes INTEGER`);
      } catch (err) {
        // Ignore error if column already exists
      }
      
      await db.run(`
        CREATE TABLE IF NOT EXISTS goal_completions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          goal_id INTEGER NOT NULL,
          completion_date DATE NOT NULL,
          duration_minutes INTEGER NOT NULL,
          completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (goal_id) REFERENCES goals(id),
          UNIQUE(goal_id, completion_date)
        )
      `);
      
      await db.run(`
        CREATE TABLE IF NOT EXISTS competitions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          creator_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (creator_id) REFERENCES users(id)
        )
      `);
      
      await db.run(`
        CREATE TABLE IF NOT EXISTS competition_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          competition_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          duration_minutes INTEGER NOT NULL,
          logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
          logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (competition_id) REFERENCES competitions(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      
      await db.run(`
        CREATE TABLE IF NOT EXISTS competition_invitations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          competition_id INTEGER NOT NULL,
          inviter_id INTEGER NOT NULL,
          invitee_username TEXT NOT NULL,
          invitee_id INTEGER,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (competition_id) REFERENCES competitions(id),
          FOREIGN KEY (inviter_id) REFERENCES users(id),
          FOREIGN KEY (invitee_id) REFERENCES users(id)
        )
      `);

      // Friends (requests + accepted friendships)
      await db.run(`
        CREATE TABLE IF NOT EXISTS friend_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          requester_id INTEGER NOT NULL,
          addressee_id INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(requester_id, addressee_id),
          FOREIGN KEY (requester_id) REFERENCES users(id),
          FOREIGN KEY (addressee_id) REFERENCES users(id)
        )
      `);

      await db.run(`
        CREATE TABLE IF NOT EXISTS friendships (
          user_id INTEGER NOT NULL,
          friend_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, friend_id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (friend_id) REFERENCES users(id)
        )
      `);
      
      console.log('✅ SQLite database initialized');
    } catch (error) {
      console.error('❌ Database initialization error:', error.message);
    }
  })();
}

// Helper function to convert parameter placeholders
function convertToPostgresParams(sql) {
  // If already using $1, $2 format, return as is
  if (sql.includes('$1')) {
    return sql;
  }
  // Convert ? placeholders to $1, $2, $3...
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

// Helper function to convert SQLite syntax to PostgreSQL
function convertSqliteToPostgres(sql) {
  // Replace SQLite-specific syntax with PostgreSQL
  return sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/TEXT/gi, 'TEXT')
    .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    .replace(/INSERT OR REPLACE/gi, 'INSERT')
    .replace(/COALESCE\(/gi, 'COALESCE(');
}

module.exports = db;
