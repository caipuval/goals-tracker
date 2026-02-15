const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const db = require('./database');

const app = express();

// Health check (for Render and load balancers – respond immediately)
app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
// Serve premium logo (and other images) from /Images
app.use('/Images', express.static('Images'));

// Helper function to get date range
function getDateRange(type, date) {
  const d = new Date(date);
  if (type === 'daily' || type === 'one-time') {
    return { start: date, end: date };
  } else if (type === 'weekly') {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    };
  } else if (type === 'monthly') {
    return {
      start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
    };
  }
}

// Helper function for INSERT OR REPLACE (PostgreSQL uses ON CONFLICT)
async function insertOrReplace(table, conflictColumns, values, placeholders) {
  if (db.type === 'postgres') {
    // PostgreSQL syntax
    const conflictClause = conflictColumns.join(', ');
    const sql = `
      INSERT INTO ${table} (${values.map((_, i) => placeholders[i].split('=')[0].trim()).join(', ')})
      VALUES (${placeholders.map((_, i) => `$${i + 1}`).join(', ')})
      ON CONFLICT (${conflictClause}) DO UPDATE SET
      ${placeholders.slice(conflictColumns.length).map((p, i) => `${p.split('=')[0].trim()} = $${i + conflictColumns.length + 1}`).join(', ')}
    `;
    return await db.run(sql, values);
  } else {
    // SQLite syntax
    const sql = `INSERT OR REPLACE INTO ${table} VALUES (${placeholders.join(', ')})`;
    return await db.run(sql, values);
  }
}

// API Routes

// Register user
app.post('/api/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.run(
      db.type === 'postgres' 
        ? 'INSERT INTO users (email, username, password) VALUES ($1, $2, $3) RETURNING id'
        : 'INSERT INTO users (email, username, password) VALUES (?, ?, ?)',
      [email, username, hashedPassword]
    );
    
    res.json({ success: true, userId: result.lastID });
  } catch (error) {
    // Handle unique constraint violations
    if (error.message.includes('UNIQUE') || error.message.includes('unique')) {
      if (error.message.includes('email')) {
        return res.status(400).json({ success: false, error: 'Email already registered' });
      } else if (error.message.includes('username')) {
        return res.status(400).json({ success: false, error: 'Username already taken' });
      }
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

// Login user (supports email or username)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body; // username can be email or username
    
    // Check if input is email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = emailRegex.test(username);
    
    let user;
    if (isEmail) {
      // Login with email
      user = await db.get(
        db.type === 'postgres' 
          ? 'SELECT * FROM users WHERE email = $1'
          : 'SELECT * FROM users WHERE email = ?',
        [username]
      );
    } else {
      // Login with username
      user = await db.get(
        db.type === 'postgres' 
          ? 'SELECT * FROM users WHERE username = $1'
          : 'SELECT * FROM users WHERE username = ?',
        [username]
      );
    }
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, error: 'Invalid email/username or password' });
    }
    
    res.json({ success: true, userId: user.id, username: user.username, email: user.email });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get all users (for leaderboard)
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.all('SELECT id, username FROM users');
    res.json(users);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Create goal
app.post('/api/goals', async (req, res) => {
  try {
    const { userId, title, description, durationMinutes, type, startDate } = req.body;
    if (!startDate || typeof startDate !== 'string') {
      return res.status(400).json({ success: false, error: 'Goal date (startDate) is required' });
    }
    const dateRange = getDateRange(type, startDate.trim());
    
    const result = await db.run(
      db.type === 'postgres'
        ? `INSERT INTO goals (user_id, title, description, duration_minutes, type, start_date, end_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`
        : `INSERT INTO goals (user_id, title, description, duration_minutes, type, start_date, end_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, description, durationMinutes, type, dateRange.start, dateRange.end]
    );
    
    res.json({ success: true, goalId: result.lastID });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get goals for user
app.get('/api/goals/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { date, type } = req.query;
    
    const paramStyle = db.type === 'postgres' ? ['$1', '$2', '$3'] : ['?', '?', '?'];
    // Cast DATE columns to text in Postgres so clients always receive YYYY-MM-DD (not ISO timestamps)
    let query = db.type === 'postgres'
      ? `SELECT id, user_id, title, description, duration_minutes, type,
           start_date::text as start_date,
           end_date::text as end_date,
           created_at
         FROM goals WHERE user_id = ${paramStyle[0]}`
      : `SELECT * FROM goals WHERE user_id = ${paramStyle[0]}`;
    const params = [userId];
    
    if (date && type) {
      const dateRange = getDateRange(type, date);
      query += ` AND start_date <= ${paramStyle[1]} AND end_date >= ${paramStyle[2]}`;
      params.push(dateRange.end, dateRange.start);
    }
    
    const goals = await db.all(query, params);
    res.json(goals);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Complete a goal for a specific date
app.post('/api/goals/:goalId/complete', async (req, res) => {
  try {
    const { goalId } = req.params;
    const { date, durationMinutes } = req.body;
    
    if (db.type === 'postgres') {
      // PostgreSQL: Use ON CONFLICT
      await db.run(
        `INSERT INTO goal_completions (goal_id, completion_date, duration_minutes)
         VALUES ($1, $2, $3)
         ON CONFLICT (goal_id, completion_date) 
         DO UPDATE SET duration_minutes = $3`,
        [goalId, date, durationMinutes]
      );
    } else {
      // SQLite: Use INSERT OR REPLACE
      await db.run(
        `INSERT OR REPLACE INTO goal_completions (goal_id, completion_date, duration_minutes)
         VALUES (?, ?, ?)`,
        [goalId, date, durationMinutes]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get completions for a goal
app.get('/api/goals/:goalId/completions', async (req, res) => {
  try {
    const { goalId } = req.params;
    const completions = await db.all(
      db.type === 'postgres'
        ? `SELECT id, goal_id,
             completion_date::text as completion_date,
             duration_minutes,
             completed_at
           FROM goal_completions WHERE goal_id = $1`
        : 'SELECT * FROM goal_completions WHERE goal_id = ?',
      [goalId]
    );
    res.json(completions);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get progress for date range
app.get('/api/progress/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const params = db.type === 'postgres' ? ['$1', '$2', '$3', '$4', '$5'] : ['?', '?', '?', '?', '?'];
    const query = `
      SELECT 
        g.id, g.title, g.type, g.duration_minutes, g.start_date, g.end_date,
        COALESCE(SUM(gc.duration_minutes), 0) as completed_minutes,
        COUNT(gc.id) as completion_count
      FROM goals g
      LEFT JOIN goal_completions gc ON g.id = gc.goal_id AND gc.completion_date BETWEEN ${params[0]} AND ${params[1]}
      WHERE g.user_id = ${params[2]} AND g.start_date <= ${params[3]} AND g.end_date >= ${params[4]}
      GROUP BY g.id
    `;
    
    const progress = await db.all(query, [startDate, endDate, userId, endDate, startDate]);
    res.json(progress);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const params = db.type === 'postgres' ? ['$1', '$2'] : ['?', '?'];
    const query = `
      SELECT 
        u.id, u.username,
        COUNT(DISTINCT gc.id) as goals_completed,
        COALESCE(SUM(gc.duration_minutes), 0) as total_minutes
      FROM users u
      LEFT JOIN goals g ON u.id = g.user_id
      LEFT JOIN goal_completions gc ON g.id = gc.goal_id AND gc.completion_date BETWEEN ${params[0]} AND ${params[1]}
      GROUP BY u.id
      ORDER BY goals_completed DESC, total_minutes DESC
    `;
    
    const leaderboard = await db.all(query, [startDate, endDate]);
    res.json(leaderboard);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete goal
app.delete('/api/goals/:goalId', async (req, res) => {
  try {
    const { goalId } = req.params;
    await db.run(
      db.type === 'postgres' 
        ? 'DELETE FROM goal_completions WHERE goal_id = $1'
        : 'DELETE FROM goal_completions WHERE goal_id = ?',
      [goalId]
    );
    await db.run(
      db.type === 'postgres' 
        ? 'DELETE FROM goals WHERE id = $1'
        : 'DELETE FROM goals WHERE id = ?',
      [goalId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Friends endpoints
async function areFriends(viewerId, profileUserId) {
  if (!viewerId || !profileUserId) return false;
  if (Number(viewerId) === Number(profileUserId)) return true;
  const row = await db.get(
    `SELECT 1 as ok FROM friendships WHERE user_id = ? AND friend_id = ? LIMIT 1`,
    [viewerId, profileUserId]
  );
  return !!row;
}

async function insertFriendshipPair(a, b) {
  if (db.type === 'postgres') {
    await db.run(`INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [a, b]);
    await db.run(`INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [b, a]);
  } else {
    await db.run(`INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)`, [a, b]);
    await db.run(`INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)`, [b, a]);
  }
}

// List friends
app.get('/api/friends', async (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || 0;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID required' });
    const friends = await db.all(
      `SELECT u.id, u.username
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = ?
       ORDER BY LOWER(u.username) ASC`,
      [userId]
    );
    res.json({ success: true, friends });
  } catch (error) {
    console.error('Error listing friends:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Incoming friend requests
app.get('/api/friends/requests', async (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || 0;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID required' });
    const requests = await db.all(
      `SELECT fr.id, fr.requester_id, fr.addressee_id, fr.status, fr.created_at,
              u.username as requester_username
       FROM friend_requests fr
       JOIN users u ON u.id = fr.requester_id
       WHERE fr.addressee_id = ? AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Error listing friend requests:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Send friend request (by username)
app.post('/api/friends/request', async (req, res) => {
  try {
    const { userId, friendUsername } = req.body || {};
    const uid = parseInt(userId) || 0;
    const uname = String(friendUsername || '').trim();
    if (!uid || !uname) return res.status(400).json({ success: false, error: 'User ID and username required' });

    const requester = await db.get(`SELECT id FROM users WHERE id = ?`, [uid]);
    if (!requester) {
      return res.status(401).json({
        success: false,
        error: 'Your session is invalid or your account was removed. Please log out and log in again (or register again).'
      });
    }

    const target = await db.get(`SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)`, [uname]);
    if (!target) return res.status(404).json({ success: false, error: 'User not found' });
    if (Number(target.id) === Number(uid)) return res.status(400).json({ success: false, error: 'You cannot add yourself.' });

    const already = await db.get(`SELECT 1 as ok FROM friendships WHERE user_id = ? AND friend_id = ? LIMIT 1`, [uid, target.id]);
    if (already) return res.json({ success: true, message: 'You are already friends.' });

    const existing = await db.get(
      `SELECT id, requester_id, addressee_id, status
       FROM friend_requests
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
       ORDER BY id DESC LIMIT 1`,
      [uid, target.id, target.id, uid]
    );

    if (existing && existing.status === 'pending') {
      // If they already requested you, accept instantly
      if (Number(existing.requester_id) === Number(target.id) && Number(existing.addressee_id) === Number(uid)) {
        await db.run(`UPDATE friend_requests SET status = 'accepted' WHERE id = ?`, [existing.id]);
        await insertFriendshipPair(uid, target.id);
        return res.json({ success: true, message: `You're now friends with ${target.username}.` });
      }
      return res.status(400).json({ success: false, error: 'Friend request already sent.' });
    }

    if (existing && existing.status === 'accepted') {
      await insertFriendshipPair(uid, target.id);
      return res.json({ success: true, message: `You're now friends with ${target.username}.` });
    }

    const requesterId = Number(uid);
    const addresseeId = Number(target.id);
    await db.run(
      `INSERT INTO friend_requests (requester_id, addressee_id, status) VALUES (?, ?, 'pending')`,
      [requesterId, addresseeId]
    );
    res.json({ success: true, message: `Friend request sent to ${target.username}.` });
  } catch (error) {
    console.error('Error sending friend request:', error);
    const isFkError = error.code === '23503' || (error.message && /foreign key constraint.*requester_id/i.test(error.message));
    if (isFkError) {
      return res.status(401).json({
        success: false,
        error: 'Your session is invalid or your account was removed. Please log out and log in again (or register again).'
      });
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

// Accept/decline friend request
app.post('/api/friends/requests/:requestId/accept', async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId) || 0;
    const { userId } = req.body || {};
    const uid = parseInt(userId) || 0;
    if (!requestId || !uid) return res.status(400).json({ success: false, error: 'Invalid request or user' });

    const request = await db.get(`SELECT * FROM friend_requests WHERE id = ? AND addressee_id = ?`, [requestId, uid]);
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, error: 'Request already processed' });

    await db.run(`UPDATE friend_requests SET status = 'accepted' WHERE id = ?`, [requestId]);
    await insertFriendshipPair(request.requester_id, request.addressee_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/friends/requests/:requestId/decline', async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId) || 0;
    const { userId } = req.body || {};
    const uid = parseInt(userId) || 0;
    if (!requestId || !uid) return res.status(400).json({ success: false, error: 'Invalid request or user' });

    const request = await db.get(`SELECT * FROM friend_requests WHERE id = ? AND addressee_id = ?`, [requestId, uid]);
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, error: 'Request already processed' });

    await db.run(`UPDATE friend_requests SET status = 'declined' WHERE id = ?`, [requestId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error declining friend request:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Friend profile summary (friends-only)
app.get('/api/users/:profileUserId/summary', async (req, res) => {
  try {
    const profileUserId = parseInt(req.params.profileUserId) || 0;
    const viewerId = parseInt(req.query.viewerId) || 0;
    const startDate = req.query.startDate ? String(req.query.startDate) : null;
    const endDate = req.query.endDate ? String(req.query.endDate) : null;
    if (!profileUserId || !viewerId) return res.status(400).json({ success: false, error: 'Invalid user' });
    const allowed = await areFriends(viewerId, profileUserId);
    if (!allowed) return res.status(403).json({ success: false, error: 'Not allowed' });

    const user = await db.get(`SELECT id, username FROM users WHERE id = ?`, [profileUserId]);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const totals = await db.get(
      `SELECT 
         (SELECT COUNT(*) FROM goals WHERE user_id = ?) as total_goals,
         (SELECT COUNT(*) FROM goals WHERE user_id = ? AND start_date <= CURRENT_DATE AND (end_date IS NULL OR end_date >= CURRENT_DATE)) as active_goals`,
      [profileUserId, profileUserId]
    );

    const rangeFilter = startDate && endDate ? 'AND gc.completion_date BETWEEN ? AND ?' : '';
    const rangeParams = startDate && endDate ? [startDate, endDate] : [];

    const timeRow = await db.get(
      `SELECT COALESCE(SUM(gc.duration_minutes), 0) as total_minutes
       FROM goals g
       LEFT JOIN goal_completions gc ON gc.goal_id = g.id
       WHERE g.user_id = ?
         ${rangeFilter}`,
      [profileUserId, ...rangeParams]
    );

    const last7 = await db.get(
      db.type === 'postgres'
        ? `SELECT COALESCE(SUM(gc.duration_minutes), 0) as minutes
           FROM goals g
           JOIN goal_completions gc ON gc.goal_id = g.id
           WHERE g.user_id = ? AND gc.completion_date >= (CURRENT_DATE - INTERVAL '6 days')`
        : `SELECT COALESCE(SUM(gc.duration_minutes), 0) as minutes
           FROM goals g
           JOIN goal_completions gc ON gc.goal_id = g.id
           WHERE g.user_id = ? AND gc.completion_date >= date('now','-6 days')`,
      [profileUserId]
    );

    // Goals active in the selected period, with completion status and total minutes in that period
    const goalRangeFilter = startDate && endDate
      ? 'AND g.start_date <= ? AND (g.end_date IS NULL OR g.end_date >= ?)'
      : '';
    const goalRangeParams = startDate && endDate ? [endDate, startDate] : [];
    const dateGoalsJoin = startDate && endDate
      ? 'LEFT JOIN goal_completions gc ON gc.goal_id = g.id AND gc.completion_date BETWEEN ? AND ?'
      : 'LEFT JOIN goal_completions gc ON gc.goal_id = g.id';
    const dateGoalsParams = startDate && endDate
      // NOTE: placeholders in JOIN come before WHERE placeholders
      ? [startDate, endDate, profileUserId, ...goalRangeParams]
      : [profileUserId, ...goalRangeParams];
    const dateGoals = await db.all(
      `SELECT g.id, g.title, g.duration_minutes as target_minutes, COALESCE(SUM(gc.duration_minutes), 0) as total_minutes
       FROM goals g
       ${dateGoalsJoin}
       WHERE g.user_id = ? ${goalRangeFilter}
       GROUP BY g.id, g.title, g.duration_minutes
       ORDER BY LOWER(g.title) ASC`,
      dateGoalsParams
    );

    const activityRows = await db.all(
      `SELECT g.title as activity, COALESCE(SUM(gc.duration_minutes), 0) as minutes
       FROM goals g
       LEFT JOIN goal_completions gc ON gc.goal_id = g.id
       WHERE g.user_id = ?
         ${rangeFilter}
       GROUP BY g.title
       ORDER BY minutes DESC, LOWER(g.title) ASC`,
      [profileUserId, ...rangeParams]
    );

    res.json({
      success: true,
      user,
      stats: {
        totalGoals: Number(totals?.total_goals || 0),
        activeGoals: Number(totals?.active_goals || 0),
        totalMinutes: Number(timeRow?.total_minutes || 0),
        last7DaysMinutes: Number(last7?.minutes || 0)
      },
      activity: activityRows.map(r => ({
        activity: r.activity,
        minutes: Number(r.minutes || 0)
      })),
      dateGoals: dateGoals.map(g => {
        const rawTarget = g.target_minutes ?? g.targetMinutes;
        return {
          id: g.id,
          title: g.title,
          completed: Number(g.total_minutes || 0) > 0,
          totalMinutes: Number(g.total_minutes || 0),
          targetMinutes: rawTarget != null && rawTarget !== '' ? Number(rawTarget) : null
        };
      })
    });
  } catch (error) {
    console.error('Error fetching user summary:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Competition endpoints

// HELPER FUNCTION: Calculate user's competition time (manual logs + goal completions)
// This is used EVERYWHERE to ensure consistency
async function calculateUserCompetitionTime(userId, competitionId, competitionTitle) {
  // Membership gate: only count time for members (creator or explicitly joined via logs)
  const competition = await db.get(
    db.type === 'postgres'
      ? `SELECT id, creator_id FROM competitions WHERE id = $1`
      : `SELECT id, creator_id FROM competitions WHERE id = ?`,
    [competitionId]
  );
  if (!competition) {
    return { manualTotal: 0, goalTotal: 0, total: 0, manualLogs: [], goalCompletions: [] };
  }
  const isCreator = Number(competition.creator_id) === Number(userId);
  if (!isCreator) {
    const joinedRow = await db.get(
      db.type === 'postgres'
        ? `SELECT 1 as ok FROM competition_logs WHERE competition_id = $1 AND user_id = $2 LIMIT 1`
        : `SELECT 1 as ok FROM competition_logs WHERE competition_id = ? AND user_id = ? LIMIT 1`,
      [competitionId, userId]
    );
    if (!joinedRow) {
      return { manualTotal: 0, goalTotal: 0, total: 0, manualLogs: [], goalCompletions: [] };
    }
  }

  // Get all manual logs for this user
  const manualLogs = await db.all(
    db.type === 'postgres'
      ? `SELECT duration_minutes FROM competition_logs WHERE competition_id = $1 AND user_id = $2`
      : `SELECT duration_minutes FROM competition_logs WHERE competition_id = ? AND user_id = ?`,
    [competitionId, userId]
  );
  
  // Sum all manual logs (positive and negative)
  const manualTotal = manualLogs.reduce((sum, log) => sum + (Number(log.duration_minutes) || 0), 0);
  
  // Get goal completions for goals matching competition title (with full details for display)
  // CRITICAL: Only count completions from goals whose title EXACTLY matches the competition title
  const goalCompletions = await db.all(
    db.type === 'postgres'
      ? `SELECT 
          gc.duration_minutes,
          gc.completion_date,
          g.id as goal_id,
          g.title as goal_title
        FROM goal_completions gc
        JOIN goals g ON g.id = gc.goal_id
        WHERE g.user_id = $1 
          AND LOWER(TRIM(g.title)) = LOWER(TRIM($2))
          AND gc.duration_minutes > 0
        ORDER BY gc.completion_date DESC`
      : `SELECT 
          gc.duration_minutes,
          gc.completion_date,
          g.id as goal_id,
          g.title as goal_title
        FROM goal_completions gc
        JOIN goals g ON g.id = gc.goal_id
        WHERE g.user_id = ? 
          AND LOWER(TRIM(g.title)) = LOWER(TRIM(?))
          AND gc.duration_minutes > 0
        ORDER BY gc.completion_date DESC`,
    [userId, competitionTitle]
  );
  
  // Debug logging to verify filtering is working
  console.log('=== calculateUserCompetitionTime DEBUG ===');
  console.log('UserId:', userId);
  console.log('CompetitionId:', competitionId);
  console.log('CompetitionTitle:', competitionTitle);
  console.log('Goal completions found:', goalCompletions.length);
  if (goalCompletions.length > 0) {
    console.log('Goal completion titles:', goalCompletions.map(gc => gc.goal_title));
    console.log('Goal completion minutes:', goalCompletions.map(gc => gc.duration_minutes));
  }
  console.log('==========================================');
  
  // Sum goal completions
  const goalTotal = goalCompletions.reduce((sum, gc) => sum + (Number(gc.duration_minutes) || 0), 0);
  
  // Total = manual + goals, capped at 0
  const total = Math.max(0, manualTotal + goalTotal);
  
  return {
    manualTotal,
    goalTotal,
    total,
    manualLogs,
    goalCompletions
  };
}

// List all competitions (for competition boxes)
app.get('/api/competitions', async (req, res) => {
  try {
    const userId = Number(parseInt(req.query.userId, 10)) || 0;
    // Only return competitions the user is "in": creator OR explicitly joined (has any log, even 0)
    const rows = await db.all(
      db.type === 'postgres'
        ? `
          SELECT c.id, c.creator_id, c.title, c.description, c.created_at
          FROM competitions c
          WHERE c.creator_id = $1
             OR EXISTS (
               SELECT 1 FROM competition_logs cl
               WHERE cl.competition_id = c.id AND cl.user_id = $1
             )
          ORDER BY c.created_at DESC
        `
        : `
          SELECT c.id, c.creator_id, c.title, c.description, c.created_at
          FROM competitions c
          WHERE c.creator_id = ?
             OR EXISTS (
               SELECT 1 FROM competition_logs cl
               WHERE cl.competition_id = c.id AND cl.user_id = ?
             )
          ORDER BY c.created_at DESC
        `,
      db.type === 'postgres' ? [userId] : [userId, userId]
    );
    const list = [];
    for (const c of rows) {
      const competitionId = c.id;
      const allUserLogs = await db.all(
        db.type === 'postgres'
          ? `SELECT DISTINCT user_id FROM competition_logs WHERE competition_id = $1`
          : `SELECT DISTINCT user_id FROM competition_logs WHERE competition_id = ?`,
        [competitionId]
      );
      const allUserIds = new Set(allUserLogs.map(r => Number(r.user_id)));
      // Ensure creator is always included as a participant
      allUserIds.add(Number(c.creator_id));
      const userTotals = {};
      let totalTime = 0;
      for (const uid of allUserIds) {
        const timeData = await calculateUserCompetitionTime(uid, competitionId, c.title);
        const t = timeData.total;
        userTotals[uid] = t;
        totalTime += t;
      }
      const uidNum = Number(userId);
      // Ensure current user's time is in totals (list only includes competitions they're in)
      if (!(uidNum in userTotals) && !(userId in userTotals)) {
        const timeData = await calculateUserCompetitionTime(uidNum, competitionId, c.title);
        userTotals[uidNum] = timeData.total;
      }
      const userMinutes = userTotals[uidNum] ?? userTotals[userId] ?? 0;
      const sortedTotals = Object.entries(userTotals).sort((a, b) => b[1] - a[1]);
      const usersAbove = sortedTotals.filter(([, m]) => m > userMinutes).length;
      const userRank = Math.max(1, usersAbove + 1);
      const item = {
        id: c.id,
        title: c.title,
        description: c.description || '',
        totalTime,
        participantCount: allUserIds.size,
        hasUserJoined: true,
        isCreator: Number(c.creator_id) === Number(userId),
        userRank: Number(userRank)
      };
      list.push(item);
    }
    if (list.length > 0) {
      console.log('[api/competitions] first item userRank:', list[0].userRank, 'userId:', userId);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ competitions: list });
  } catch (error) {
    console.error('List competitions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get one competition by id (full details)
// NOTE: constrain :competitionId to digits so it doesn't swallow routes like /api/competition/invitations
app.get('/api/competition/:competitionId(\\d+)', async (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || 0;
    const competitionId = parseInt(req.params.competitionId);
    if (!competitionId) return res.status(400).json({ success: false, error: 'Invalid competition ID' });
    const competition = await db.get(`
      SELECT * FROM competitions WHERE id = ${db.type === 'postgres' ? '$1' : '?'}
    `, [competitionId]);
    if (!competition) return res.json({ competition: null });
    const isCreator = Number(competition.creator_id) === Number(userId);
    const joinRow = await db.get(
      db.type === 'postgres'
        ? `SELECT 1 as ok FROM competition_logs WHERE competition_id = $1 AND user_id = $2 LIMIT 1`
        : `SELECT 1 as ok FROM competition_logs WHERE competition_id = ? AND user_id = ? LIMIT 1`,
      [competition.id, userId]
    );
    if (!isCreator && !joinRow) {
      return res.status(403).json({ success: false, error: 'You are not a participant in this competition.' });
    }
    const id = competition.id;
    const allUserLogs = await db.all(
      db.type === 'postgres'
        ? `SELECT id, duration_minutes, logged_date, logged_at FROM competition_logs WHERE competition_id = $1 AND user_id = $2 ORDER BY logged_at DESC`
        : `SELECT id, duration_minutes, logged_date, logged_at FROM competition_logs WHERE competition_id = ? AND user_id = ? ORDER BY logged_at DESC`,
      [id, userId]
    );
    const userTimeData = await calculateUserCompetitionTime(userId, id, competition.title);
    const userTotalMinutes = userTimeData.total;
    const manualLogMinutes = userTimeData.manualTotal;
    const goalCompletionMinutes = userTimeData.goalTotal;
    const hasJoined = isCreator || (allUserLogs && allUserLogs.length > 0);
    const allCompetitionLogs = await db.all(
      db.type === 'postgres'
        ? `SELECT DISTINCT user_id FROM competition_logs WHERE competition_id = $1`
        : `SELECT DISTINCT user_id FROM competition_logs WHERE competition_id = ?`,
      [id]
    );
    const allUserIds = new Set(allCompetitionLogs.map(r => Number(r.user_id)));
    allUserIds.add(Number(competition.creator_id));
    const userTotals = {};
    for (const uid of allUserIds) {
      const timeData = await calculateUserCompetitionTime(uid, id, competition.title);
      userTotals[uid] = timeData.total;
    }
    if (hasJoined) {
      userTotals[userId] = userTotalMinutes;
      userTotals[String(userId)] = userTotalMinutes;
    }
    const userIds = Object.keys(userTotals).map(i => parseInt(i));
    const users = userIds.length ? await db.all(`SELECT id, username FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`, userIds) : [];
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.username; });
    const leaderboard = Object.entries(userTotals).map(([uid, total]) => ({
      id: parseInt(uid),
      username: userMap[parseInt(uid)] || 'Unknown',
      total_minutes: parseInt(uid) === userId ? userTotalMinutes : total
    }));
    leaderboard.sort((a, b) => b.total_minutes - a.total_minutes);
    const userLeaderboardIndex = leaderboard.findIndex(u => u.id === userId);
    if (userLeaderboardIndex !== -1) leaderboard[userLeaderboardIndex].total_minutes = userTotalMinutes;
    else if (hasJoined) {
      const user = await db.get(`SELECT id, username FROM users WHERE id = ${db.type === 'postgres' ? '$1' : '?'}`, [userId]);
      if (user) {
        leaderboard.push({ id: userId, username: user.username, total_minutes: userTotalMinutes });
        leaderboard.sort((a, b) => b.total_minutes - a.total_minutes);
      }
    }
    let rank = '-';
    if (hasJoined && userTotalMinutes > 0) {
      const usersAbove = leaderboard.filter(u => u.total_minutes > userTotalMinutes).length;
      rank = String(usersAbove + 1);
    }
    const totalCompetitionMinutes = Object.values(userTotals).reduce((sum, t) => sum + t, 0);
    const userManualLogs = allUserLogs.filter(log => (Number(log.duration_minutes) || 0) > 0).map(log => ({
      id: log.id,
      duration_minutes: Number(log.duration_minutes) || 0,
      logged_date: log.logged_date,
      logged_at: log.logged_at,
      type: 'manual'
    }));
    const userGoalCompletions = (userTimeData.goalCompletions || []).map(gc => ({
      id: gc.goal_id,
      completion_date: gc.completion_date,
      duration_minutes: gc.duration_minutes,
      goal_title: gc.goal_title,
      type: 'goal'
    }));
    res.json({
      competition,
      leaderboard,
      userStats: {
        totalMinutes: userTotalMinutes,
        rank,
        hasJoined,
        manualLogs: userManualLogs,
        goalCompletions: userGoalCompletions,
        goalCompletionMinutes: goalCompletionMinutes
      },
      totalTime: totalCompetitionMinutes,
      isCreator
    });
  } catch (error) {
    console.error('Get competition by id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active competition (single most recent - kept for backward compat; frontend should use list + get by id)
app.get('/api/competition', async (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || 0;
    const requestedCompetitionId = parseInt(req.query.competitionId) || null;
    
    let competition;
    if (requestedCompetitionId) {
      competition = await db.get(`
        SELECT * FROM competitions WHERE id = ${db.type === 'postgres' ? '$1' : '?'}
      `, [requestedCompetitionId]);
    }
    if (!competition) {
      competition = await db.get(`
        SELECT * FROM competitions 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
    }
    
    if (!competition) {
      return res.json({ competition: null });
    }
    
    const id = competition.id;
    const competitionId = id;
    
    // Step 2: Get ALL competition_logs entries for this user (for display/deletion)
    const allUserLogs = await db.all(
      db.type === 'postgres'
        ? `SELECT id, duration_minutes, logged_date, logged_at
           FROM competition_logs
           WHERE competition_id = $1 AND user_id = $2
           ORDER BY logged_at DESC`
        : `SELECT id, duration_minutes, logged_date, logged_at
           FROM competition_logs
           WHERE competition_id = ? AND user_id = ?
           ORDER BY logged_at DESC`,
      [competitionId, userId]
    );
    
    // Step 3: Calculate current user's time using the helper function
    const userTimeData = await calculateUserCompetitionTime(userId, competitionId, competition.title);
    const userTotalMinutes = userTimeData.total;
    const manualLogMinutes = userTimeData.manualTotal;
    const goalCompletionMinutes = userTimeData.goalTotal;
    
    // Step 4: Check if user has joined (has ANY entry, even 0 minutes)
    const hasJoined = allUserLogs && allUserLogs.length > 0;
    
    // Step 5: Build leaderboard - calculate time for ALL users using the same helper function
    // Get all users who have logs or goal completions
    const allUserIds = new Set();
    
    // Get users from competition logs
    const allCompetitionLogs = await db.all(
      db.type === 'postgres'
        ? `SELECT DISTINCT user_id FROM competition_logs WHERE competition_id = $1`
        : `SELECT DISTINCT user_id FROM competition_logs WHERE competition_id = ?`,
      [competitionId]
    );
    allCompetitionLogs.forEach(log => allUserIds.add(Number(log.user_id)));
    
    // Get users from goal completions - only for goals matching competition title
    const allGoalCompletions = await db.all(
      db.type === 'postgres'
        ? `SELECT DISTINCT g.user_id
           FROM goal_completions gc
           JOIN goals g ON g.id = gc.goal_id
           WHERE LOWER(TRIM(g.title)) = LOWER(TRIM($1)) AND gc.duration_minutes > 0`
        : `SELECT DISTINCT g.user_id
           FROM goal_completions gc
           JOIN goals g ON g.id = gc.goal_id
           WHERE LOWER(TRIM(g.title)) = LOWER(TRIM(?)) AND gc.duration_minutes > 0`,
      [competition.title]
    );
    allGoalCompletions.forEach(gc => allUserIds.add(Number(gc.user_id)));
    
    // Calculate time for each user using the SAME helper function
    const userTotals = {};
    for (const uid of allUserIds) {
      const timeData = await calculateUserCompetitionTime(uid, competitionId, competition.title);
      userTotals[uid] = timeData.total;
    }
    
    // CRITICAL FIX: For the current user, ALWAYS use the EXACT same value as userStats.totalMinutes
    // This ensures "YOUR TIME" and leaderboard entry are perfectly synced
    console.log('=== BEFORE OVERWRITE ===');
    console.log('userId:', userId, 'type:', typeof userId);
    console.log('hasJoined:', hasJoined);
    console.log('userTotalMinutes:', userTotalMinutes);
    console.log('userTotals[userId] before:', userTotals[userId]);
    console.log('All userTotals keys:', Object.keys(userTotals));
    
    if (hasJoined) {
      // Convert userId to string to match Object.keys format, then ensure it's set correctly
      const userIdStr = String(userId);
      const userIdNum = parseInt(userId);
      userTotals[userIdNum] = userTotalMinutes; // Overwrite with the exact same value used for userStats
      userTotals[userIdStr] = userTotalMinutes; // Also set as string key to be safe
      console.log('userTotals[userId] after (num):', userTotals[userIdNum]);
      console.log('userTotals[userId] after (str):', userTotals[userIdStr]);
    }
    
    // Get usernames for users in leaderboard
    const leaderboard = [];
    if (Object.keys(userTotals).length > 0) {
      const userIds = Object.keys(userTotals).map(id => parseInt(id));
      const users = await db.all(`
        SELECT id, username
        FROM users
        WHERE id IN (${userIds.map(() => '?').join(',')})
      `, userIds);
      
      const userMap = {};
      users.forEach(u => { userMap[u.id] = u.username; });
      
      // Build leaderboard array - userTotals[userId] now matches userTotalMinutes exactly
      Object.entries(userTotals).forEach(([uid, total]) => {
        const uidNum = parseInt(uid);
        // For current user, double-check we're using the correct value
        const finalTotal = (uidNum === userId) ? userTotalMinutes : total;
        console.log(`Leaderboard entry: uid=${uidNum}, total=${total}, finalTotal=${finalTotal}, isCurrentUser=${uidNum === userId}`);
        leaderboard.push({
          id: uidNum,
          username: userMap[uidNum] || 'Unknown',
          total_minutes: finalTotal // Force current user to use userTotalMinutes
        });
      });
      
      // Sort by total_minutes descending
      leaderboard.sort((a, b) => b.total_minutes - a.total_minutes);
      
      // CRITICAL: After building leaderboard, ensure current user's entry matches userStats.totalMinutes
      const userLeaderboardIndex = leaderboard.findIndex(u => u.id === userId);
      if (userLeaderboardIndex !== -1) {
        console.log(`FIXING leaderboard entry at index ${userLeaderboardIndex}: changing from ${leaderboard[userLeaderboardIndex].total_minutes} to ${userTotalMinutes}`);
        leaderboard[userLeaderboardIndex].total_minutes = userTotalMinutes;
      } else if (hasJoined) {
        // User not in leaderboard but has joined - add them
        const user = await db.get(`SELECT id, username FROM users WHERE id = ?`, [userId]);
        if (user) {
          leaderboard.push({
            id: userId,
            username: user.username,
            total_minutes: userTotalMinutes
          });
          leaderboard.sort((a, b) => b.total_minutes - a.total_minutes);
        }
      }
    }
    
    // Step 6: Calculate user's rank
    let rank = '-';
    if (hasJoined && userTotalMinutes > 0) {
      const usersAbove = leaderboard.filter(u => u.total_minutes > userTotalMinutes).length;
      rank = String(usersAbove + 1);
    }
    
    // Step 7: Calculate total competition time (sum of all participants)
    const totalCompetitionMinutes = Object.values(userTotals).reduce((sum, total) => sum + total, 0);
    
    // Step 8: Debug logging
    console.log('=== COMPETITION DATA ===');
    console.log('User ID:', userId);
    console.log('Has joined:', hasJoined);
    console.log('Manual total:', manualLogMinutes);
    console.log('Goal total:', goalCompletionMinutes);
    console.log('User total minutes (for YOUR TIME):', userTotalMinutes);
    console.log('User total in leaderboard map:', userTotals[userId]);
    console.log('Leaderboard totals:', Object.entries(userTotals).map(([uid, total]) => `User ${uid}: ${total}m`));
    // Find current user in leaderboard
    const userInLeaderboard = leaderboard.find(u => u.id === userId);
    console.log('Current user in leaderboard:', userInLeaderboard ? `${userInLeaderboard.username}: ${userInLeaderboard.total_minutes}m` : 'NOT FOUND');
    console.log('========================');
    
    // Step 9: Get user's manual log entries (for display/deletion)
    // Only show positive entries - negatives are just for calculation, not display
    const userManualLogs = allUserLogs
      .filter(log => {
        const mins = Number(log.duration_minutes) || 0;
        return mins > 0; // Only show positive entries
      })
      .map(log => ({
        id: log.id,
        duration_minutes: Number(log.duration_minutes) || 0,
        logged_date: log.logged_date,
        logged_at: log.logged_at,
        type: 'manual'
      }));
    
    console.log('=== MANUAL LOGS DEBUG ===');
    console.log('All user logs from DB:', JSON.stringify(allUserLogs, null, 2));
    console.log('Filtered manual logs for breakdown:', JSON.stringify(userManualLogs, null, 2));
    console.log('========================');
    
    // Step 7: Get goal completion entries (for display/deletion) - format for frontend
    const userGoalCompletions = (userTimeData.goalCompletions || []).map(gc => ({
      id: gc.goal_id,
      completion_date: gc.completion_date,
      duration_minutes: gc.duration_minutes,
      goal_title: gc.goal_title,
      type: 'goal'
    }));
    
    // Step 10: Return response
    res.json({
      competition,
      leaderboard,
      userStats: {
        totalMinutes: userTotalMinutes, // Combined: manual logs + goal completions
        rank,
        hasJoined,
        manualLogs: userManualLogs, // Manual log entries (can be deleted)
        goalCompletions: userGoalCompletions, // Goal completion entries (can be deleted)
        goalCompletionMinutes: goalCompletionMinutes // Auto-synced from goals
      },
      totalTime: totalCompetitionMinutes
    });
  } catch (error) {
    console.error('Competition endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create competition
app.post('/api/competition', async (req, res) => {
  try {
    const { userId, title, description } = req.body;
    
    console.log('Creating competition:', { userId, title, description });
    
    if (!userId || !title) {
      return res.status(400).json({ success: false, error: 'User ID and title required' });
    }
    
    const sql = db.type === 'postgres'
      ? `INSERT INTO competitions (creator_id, title, description) VALUES ($1, $2, $3) RETURNING id`
      : `INSERT INTO competitions (creator_id, title, description) VALUES (?, ?, ?)`;
    const result = await db.run(sql, [userId, title, description || '']);
    const competitionId = Number(result.lastID);

    // Auto-join creator (so they can see it immediately, and goal completions count only for members)
    const creatorJoinExists = await db.get(
      db.type === 'postgres'
        ? `SELECT 1 as ok FROM competition_logs WHERE competition_id = $1 AND user_id = $2 LIMIT 1`
        : `SELECT 1 as ok FROM competition_logs WHERE competition_id = ? AND user_id = ? LIMIT 1`,
      [competitionId, userId]
    );
    if (!creatorJoinExists) {
      const joinSql = db.type === 'postgres'
        ? `INSERT INTO competition_logs (competition_id, user_id, duration_minutes, logged_date) VALUES ($1, $2, 0, CURRENT_DATE)`
        : `INSERT INTO competition_logs (competition_id, user_id, duration_minutes, logged_date) VALUES (?, ?, 0, DATE('now'))`;
      await db.run(joinSql, [competitionId, userId]);
    }

    console.log('Competition created successfully:', result);
    res.json({ success: true, competitionId });
  } catch (error) {
    console.error('Error creating competition:', error);
    console.error('Error stack:', error.stack);
    res.status(400).json({ success: false, error: error.message || 'Unknown error' });
  }
});

// Update competition (creator only) - title, description (POST for broad compatibility)
app.post('/api/competition/:competitionId(\\d+)/update', async (req, res) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const body = req.body || {};
    const { userId, title, description } = body;
    if (!competitionId || !userId) {
      return res.status(400).json({ success: false, error: 'Invalid competition or user' });
    }
    const comp = await db.get(
      db.type === 'postgres'
        ? `SELECT id, creator_id FROM competitions WHERE id = $1`
        : `SELECT id, creator_id FROM competitions WHERE id = ?`,
      [competitionId]
    );
    if (!comp) return res.status(404).json({ success: false, error: 'Competition not found' });
    if (Number(comp.creator_id) !== Number(userId)) {
      return res.status(403).json({ success: false, error: 'Only the creator can edit this competition.' });
    }
    const updates = [];
    const params = [];
    let p = 0;
    if (title !== undefined) {
      updates.push(db.type === 'postgres' ? `title = $${++p}` : 'title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push(db.type === 'postgres' ? `description = $${++p}` : 'description = ?');
      params.push(description ?? '');
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Nothing to update' });
    }
    params.push(competitionId);
    const sql = db.type === 'postgres'
      ? `UPDATE competitions SET ${updates.join(', ')} WHERE id = $${++p}`
      : `UPDATE competitions SET ${updates.join(', ')} WHERE id = ?`;
    await db.run(sql, params);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating competition:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add competition time
app.post('/api/competition/log', async (req, res) => {
  try {
    const { userId, competitionId, durationMinutes } = req.body;
    
    if (!userId || !competitionId || durationMinutes === undefined || durationMinutes === null) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const duration = Number(durationMinutes);
    if (Number.isNaN(duration) || duration < 0) {
      return res.status(400).json({ success: false, error: 'Invalid duration' });
    }

    // Ensure competition exists + creator id
    const comp = await db.get(
      db.type === 'postgres'
        ? `SELECT id, creator_id FROM competitions WHERE id = $1`
        : `SELECT id, creator_id FROM competitions WHERE id = ?`,
      [competitionId]
    );
    if (!comp) return res.status(404).json({ success: false, error: 'Competition not found' });

    const isCreator = Number(comp.creator_id) === Number(userId);
    const joinedRow = await db.get(
      db.type === 'postgres'
        ? `SELECT 1 as ok FROM competition_logs WHERE competition_id = $1 AND user_id = $2 LIMIT 1`
        : `SELECT 1 as ok FROM competition_logs WHERE competition_id = ? AND user_id = ? LIMIT 1`,
      [competitionId, userId]
    );
    const isMember = isCreator || !!joinedRow;

    // Join flow: duration === 0 means "join" (creates a 0-minute log entry)
    if (duration === 0 && !isMember) {
      const joinSql = db.type === 'postgres'
        ? `INSERT INTO competition_logs (competition_id, user_id, duration_minutes, logged_date) VALUES ($1, $2, 0, CURRENT_DATE)`
        : `INSERT INTO competition_logs (competition_id, user_id, duration_minutes, logged_date) VALUES (?, ?, 0, DATE('now'))`;
      await db.run(joinSql, [competitionId, userId]);
      return res.json({ success: true, joined: true });
    }
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'You must join this competition first.' });
    }
    
    const dateSql = db.type === 'postgres' 
      ? `INSERT INTO competition_logs (competition_id, user_id, duration_minutes, logged_date) VALUES ($1, $2, $3, CURRENT_DATE)`
      : `INSERT INTO competition_logs (competition_id, user_id, duration_minutes, logged_date) VALUES (?, ?, ?, DATE('now'))`;
    
    await db.run(dateSql, [competitionId, userId, duration]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding competition time:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Leave a competition (removes membership + manual logs)
app.post('/api/competition/leave', async (req, res) => {
  try {
    const { userId, competitionId } = req.body || {};
    if (!userId || !competitionId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const comp = await db.get(
      db.type === 'postgres'
        ? `SELECT id, creator_id FROM competitions WHERE id = $1`
        : `SELECT id, creator_id FROM competitions WHERE id = ?`,
      [competitionId]
    );
    if (!comp) return res.status(404).json({ success: false, error: 'Competition not found' });
    if (Number(comp.creator_id) === Number(userId)) {
      return res.status(400).json({ success: false, error: 'Creators cannot leave their own competition. Delete it instead.' });
    }
    await db.run(
      db.type === 'postgres'
        ? `DELETE FROM competition_logs WHERE competition_id = $1 AND user_id = $2`
        : `DELETE FROM competition_logs WHERE competition_id = ? AND user_id = ?`,
      [competitionId, userId]
    );
    await db.run(
      db.type === 'postgres'
        ? `DELETE FROM competition_invitations WHERE competition_id = $1 AND invitee_id = $2`
        : `DELETE FROM competition_invitations WHERE competition_id = ? AND invitee_id = ?`,
      [competitionId, userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Leave competition error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a competition (creator only)
app.delete('/api/competition/:competitionId(\\d+)', async (req, res) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { userId } = req.body || {};
    if (!competitionId || !userId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const comp = await db.get(
      db.type === 'postgres'
        ? `SELECT id, creator_id FROM competitions WHERE id = $1`
        : `SELECT id, creator_id FROM competitions WHERE id = ?`,
      [competitionId]
    );
    if (!comp) return res.status(404).json({ success: false, error: 'Competition not found' });
    if (Number(comp.creator_id) !== Number(userId)) {
      return res.status(403).json({ success: false, error: 'Only the creator can delete this competition.' });
    }
    // Delete children first for safety (Postgres schema may not cascade)
    await db.run(
      db.type === 'postgres'
        ? `DELETE FROM competition_invitations WHERE competition_id = $1`
        : `DELETE FROM competition_invitations WHERE competition_id = ?`,
      [competitionId]
    );
    await db.run(
      db.type === 'postgres'
        ? `DELETE FROM competition_logs WHERE competition_id = $1`
        : `DELETE FROM competition_logs WHERE competition_id = ?`,
      [competitionId]
    );
    await db.run(
      db.type === 'postgres'
        ? `DELETE FROM competitions WHERE id = $1`
        : `DELETE FROM competitions WHERE id = ?`,
      [competitionId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete competition error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove competition time - COMPLETELY NEW SIMPLE APPROACH
app.post('/api/competition/remove', async (req, res) => {
  try {
    console.log('=== REMOVE TIME REQUEST ===');
    console.log('Body:', req.body);
    
    const { userId, competitionId, durationMinutes } = req.body;
    
    if (!userId || !competitionId || durationMinutes === undefined || durationMinutes <= 0) {
      console.log('Validation failed');
      return res.status(400).json({ success: false, error: 'Missing required fields or invalid duration' });
    }
    
    const removeAmount = Number(durationMinutes);
    console.log('Remove amount:', removeAmount);
    
    // Get current total (manual logs + goal completions)
    const competition = await db.get(`SELECT title FROM competitions WHERE id = ?`, [competitionId]);
    if (!competition) {
      return res.status(404).json({ success: false, error: 'Competition not found' });
    }
    
    // Get manual logs total
    const manualStats = await db.get(`
      SELECT COALESCE(SUM(duration_minutes), 0) as total
      FROM competition_logs
      WHERE competition_id = ? AND user_id = ?
    `, [competitionId, userId]);
    
    // Get goal completions total
    const goalCompletions = await db.all(`
      SELECT gc.duration_minutes
      FROM goal_completions gc
      JOIN goals g ON g.id = gc.goal_id
      WHERE g.user_id = ? 
        AND LOWER(TRIM(g.title)) = LOWER(TRIM(?))
        AND gc.duration_minutes > 0
    `, [userId, competition.title]);
    
    const goalTotal = goalCompletions.reduce((sum, gc) => sum + (Number(gc.duration_minutes) || 0), 0);
    const manualTotal = Number(manualStats?.total || 0);
    const currentTotal = Math.max(0, manualTotal) + goalTotal;
    
    console.log('Manual total:', manualTotal);
    console.log('Goal total:', goalTotal);
    console.log('Current total:', currentTotal);
    
    // Check if we can remove this amount
    if (removeAmount > currentTotal) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot remove ${removeAmount} minutes. You only have ${Math.round(currentTotal)} minutes.` 
      });
    }
    
    // Insert negative value to subtract
    const dateSql = db.type === 'postgres' 
      ? `INSERT INTO competition_logs (competition_id, user_id, duration_minutes, logged_date) VALUES ($1, $2, $3, CURRENT_DATE)`
      : `INSERT INTO competition_logs (competition_id, user_id, duration_minutes, logged_date) VALUES (?, ?, ?, DATE('now'))`;
    
    await db.run(dateSql, [competitionId, userId, -removeAmount]);
    console.log('Negative value inserted successfully');
    console.log('========================');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing competition time:', error);
    console.error('Stack:', error.stack);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get participant details (daily breakdown) - Uses SAME calculation as everything else
app.get('/api/competition/:competitionId(\\d+)/participant/:userId(\\d+)', async (req, res) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const userId = parseInt(req.params.userId);
    
    if (!competitionId || !userId) {
      return res.status(400).json({ success: false, error: 'Invalid competition or user ID' });
    }
    
    // Get competition title
    const competition = await db.get(`SELECT title FROM competitions WHERE id = ?`, [competitionId]);
    if (!competition) {
      return res.status(404).json({ success: false, error: 'Competition not found' });
    }
    
    // Use the SAME helper function to calculate total (for consistency)
    const userTimeData = await calculateUserCompetitionTime(userId, competitionId, competition.title);
    
    // Get manual logs for daily breakdown (only positive for display)
    const manualLogs = await db.all(`
      SELECT 
        logged_date,
        duration_minutes
      FROM competition_logs
      WHERE competition_id = ? AND user_id = ? AND duration_minutes > 0
      ORDER BY logged_date DESC
    `, [competitionId, userId]);
    
    // Get goal completions for daily breakdown
    const goalCompletions = await db.all(`
      SELECT 
        gc.completion_date as logged_date,
        gc.duration_minutes
      FROM goal_completions gc
      JOIN goals g ON g.id = gc.goal_id
      WHERE g.user_id = ? 
        AND LOWER(TRIM(g.title)) = LOWER(TRIM(?))
        AND gc.duration_minutes > 0
      ORDER BY gc.completion_date DESC
    `, [userId, competition.title]);
    
    // Combine both sources and group by date
    const dailyTotals = {};
    
    // Add manual logs
    if (manualLogs && manualLogs.length > 0) {
      manualLogs.forEach(log => {
        const date = log.logged_date;
        const mins = Number(log.duration_minutes) || 0;
        if (mins > 0) {
          dailyTotals[date] = (dailyTotals[date] || 0) + mins;
        }
      });
    }
    
    // Add goal completions
    if (goalCompletions && goalCompletions.length > 0) {
      goalCompletions.forEach(gc => {
        const date = gc.logged_date;
        const mins = Number(gc.duration_minutes) || 0;
        if (mins > 0) {
          dailyTotals[date] = (dailyTotals[date] || 0) + mins;
        }
      });
    }
    
    // Convert to array format
    const dailyLogs = Object.entries(dailyTotals).map(([date, total]) => ({
      logged_date: date,
      total_minutes: total
    })).sort((a, b) => new Date(b.logged_date) - new Date(a.logged_date));
    
    // Use the SAME total from helper function (includes negatives in calculation)
    res.json({
      dailyLogs: dailyLogs || [],
      totalMinutes: userTimeData.total, // Use the SAME calculation
      daysActive: dailyLogs.length
    });
  } catch (error) {
    console.error('Error getting participant details:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete competition log entry - SYNCED with goal completions
app.delete('/api/competition/log/:logId', async (req, res) => {
  try {
    const logId = parseInt(req.params.logId);
    const { userId, competitionId } = req.body;
    
    if (!logId || !userId) {
      return res.status(400).json({ success: false, error: 'Missing log ID or user ID' });
    }
    
    // Get the log entry and competition info
    const log = await db.get(`
      SELECT cl.user_id, cl.duration_minutes, cl.logged_date, c.title as competition_title
      FROM competition_logs cl
      JOIN competitions c ON c.id = cl.competition_id
      WHERE cl.id = ?
    `, [logId]);
    
    if (!log) {
      return res.status(404).json({ success: false, error: 'Log entry not found' });
    }
    
    if (log.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this log' });
    }
    
    // Delete the competition log entry
    await db.run(`DELETE FROM competition_logs WHERE id = ?`, [logId]);
    
    // SYNC: Also remove from goal completions if goal title matches competition title
    // Find goal with matching title
    const goal = await db.get(`
      SELECT id FROM goals 
      WHERE user_id = ? AND title = ?
      LIMIT 1
    `, [userId, log.competition_title]);
    
    if (goal) {
      // Remove goal completion for the same date and duration
      // We'll remove the most recent matching completion
      const completion = await db.get(`
        SELECT id FROM goal_completions
        WHERE goal_id = ? 
          AND completion_date = ?
          AND duration_minutes = ?
        ORDER BY completed_at DESC
        LIMIT 1
      `, [goal.id, log.logged_date, log.duration_minutes]);
      
      if (completion) {
        await db.run(`DELETE FROM goal_completions WHERE id = ?`, [completion.id]);
        console.log(`Synced: Removed goal completion for goal "${log.competition_title}"`);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting competition log:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete goal completion time (removes from both goal and competition)
app.delete('/api/competition/goal-completion/:goalId/:completionDate', async (req, res) => {
  try {
    const goalId = parseInt(req.params.goalId);
    const completionDate = req.params.completionDate;
    const { userId } = req.body;
    
    if (!goalId || !completionDate || !userId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    // Verify goal belongs to user
    const goal = await db.get(`
      SELECT id, title FROM goals WHERE id = ? AND user_id = ?
    `, [goalId, userId]);
    
    if (!goal) {
      return res.status(404).json({ success: false, error: 'Goal not found' });
    }
    
    // Get the completion to get its duration
    const completion = await db.get(`
      SELECT duration_minutes FROM goal_completions
      WHERE goal_id = ? AND completion_date = ?
    `, [goalId, completionDate]);
    
    if (!completion) {
      return res.status(404).json({ success: false, error: 'Completion not found' });
    }
    
    // Delete goal completion
    await db.run(`
      DELETE FROM goal_completions 
      WHERE goal_id = ? AND completion_date = ?
    `, [goalId, completionDate]);
    
    // Also remove from competition logs if competition title matches goal title
    const competition = await db.get(`
      SELECT id FROM competitions 
      WHERE title = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [goal.title]);
    
    if (competition) {
      // Remove matching competition log (get ID first, then delete)
      const matchingLog = await db.get(`
        SELECT id FROM competition_logs
        WHERE competition_id = ?
          AND user_id = ?
          AND logged_date = ?
          AND duration_minutes = ?
        ORDER BY logged_at DESC
        LIMIT 1
      `, [competition.id, userId, completionDate, completion.duration_minutes]);
      
      if (matchingLog) {
        await db.run(`DELETE FROM competition_logs WHERE id = ?`, [matchingLog.id]);
        console.log(`Synced: Removed competition log for competition "${goal.title}"`);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal completion:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Invite user to competition
app.post('/api/competition/invite', async (req, res) => {
  try {
    const { competitionId, inviterId, inviteeUsername } = req.body;
    
    if (!competitionId || !inviterId || !inviteeUsername) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    // Check if competition exists
    const competition = await db.get(`SELECT id FROM competitions WHERE id = ?`, [competitionId]);
    if (!competition) {
      return res.status(404).json({ success: false, error: 'Competition not found' });
    }
    
    // Check if invitee user exists (case-insensitive; Postgres usernames are case-sensitive by default)
    const invitee = await db.get(
      `SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)`,
      [inviteeUsername.trim()]
    );
    if (!invitee) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Check if user is already in competition (has logs)
    const existingLogs = await db.get(`
      SELECT id FROM competition_logs 
      WHERE competition_id = ? AND user_id = ?
      LIMIT 1
    `, [competitionId, invitee.id]);
    
    if (existingLogs) {
      return res.status(400).json({ success: false, error: 'User is already in this competition' });
    }
    
    // Check if invitation already exists
    const existingInvite = await db.get(`
      SELECT id FROM competition_invitations 
      WHERE competition_id = ? AND invitee_id = ? AND status = 'pending'
    `, [competitionId, invitee.id]);
    
    if (existingInvite) {
      return res.status(400).json({ success: false, error: 'Invitation already sent' });
    }
    
    // Create invitation
    await db.run(`
      INSERT INTO competition_invitations (competition_id, inviter_id, invitee_username, invitee_id, status)
      VALUES (?, ?, ?, ?, 'pending')
    `, [competitionId, inviterId, invitee.username, invitee.id]);
    
    res.json({ success: true, message: `Invitation sent to ${inviteeUsername}` });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get pending invitations for current user
app.get('/api/competition/invitations', async (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || 0;
    const username = req.query.username ? String(req.query.username).trim() : '';
    if (!userId && !username) {
      return res.status(400).json({ success: false, error: 'User ID or username required' });
    }
    
    // Some older rows may have invitee_id NULL (or clients may send a mismatched userId).
    // To ensure invites always show for the right user, match by invitee_id OR invitee_username (case-insensitive).
    let whereClause = `ci.status = 'pending' AND ci.invitee_id = ?`;
    let params = [userId];
    if (username) {
      whereClause = `ci.status = 'pending' AND (ci.invitee_id = ? OR LOWER(ci.invitee_username) = LOWER(?))`;
      params = [userId, username];
    }

    const invitations = await db.all(`
      SELECT 
        ci.id,
        ci.competition_id,
        ci.inviter_id,
        ci.invitee_username,
        ci.status,
        ci.created_at,
        c.title as competition_title,
        c.description as competition_description,
        u.username as inviter_username
      FROM competition_invitations ci
      JOIN competitions c ON c.id = ci.competition_id
      JOIN users u ON u.id = ci.inviter_id
      WHERE ${whereClause}
      ORDER BY ci.created_at DESC
    `, params);
    
    res.json({ success: true, invitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Accept invitation
app.post('/api/competition/invitations/:inviteId/accept', async (req, res) => {
  try {
    const inviteId = parseInt(req.params.inviteId);
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }
    
    // Get invitation
    const invitation = await db.get(`
      SELECT * FROM competition_invitations WHERE id = ? AND invitee_id = ?
    `, [inviteId, userId]);
    
    if (!invitation) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }
    
    if (invitation.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Invitation already processed' });
    }
    
    // Update invitation status
    await db.run(`
      UPDATE competition_invitations SET status = 'accepted' WHERE id = ?
    `, [inviteId]);
    
    // Add user to competition by creating a 0-minute log entry (marks them as joined)
    await db.run(`
      INSERT INTO competition_logs (competition_id, user_id, duration_minutes, logged_date)
      VALUES (?, ?, 0, CURRENT_DATE)
    `, [invitation.competition_id, userId]);
    
    res.json({ success: true, competitionId: invitation.competition_id });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Decline invitation
app.post('/api/competition/invitations/:inviteId/decline', async (req, res) => {
  try {
    const inviteId = parseInt(req.params.inviteId);
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }
    
    const invitation = await db.get(`
      SELECT id FROM competition_invitations WHERE id = ? AND invitee_id = ?
    `, [inviteId, userId]);
    
    if (!invitation) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }
    
    await db.run(`
      UPDATE competition_invitations SET status = 'declined' WHERE id = ?
    `, [inviteId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error declining invitation:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`🚀 Goals Tracker running on http://${HOST}:${PORT}`);
  console.log(`📊 Using ${db.type.toUpperCase()} database`);
});
