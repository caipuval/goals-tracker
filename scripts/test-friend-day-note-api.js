// Simulates what the server does for GET /api/users/:profileUserId/day-note
// Run: node scripts/test-friend-day-note-api.js
// Uses your .env (Postgres or SQLite). Pass date as arg: node scripts/test-friend-day-note-api.js 2026-02-16

require('dotenv').config();
const db = require('../database');

const profileUserId = 2;  // Meister
const viewerId = 6;       // Robin
const date = process.argv[2] || '2026-02-16';

function normalizeDayNoteResponse(row) {
  if (!row) return null;
  let noteDate = row.note_date;
  if (noteDate instanceof Date) {
    noteDate = `${noteDate.getFullYear()}-${String(noteDate.getMonth() + 1).padStart(2, '0')}-${String(noteDate.getDate()).padStart(2, '0')}`;
  } else if (noteDate != null) {
    const s = String(noteDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) {
      noteDate = s.slice(0, 10);
    } else {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) {
        noteDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else {
        noteDate = s.slice(0, 10);
      }
    }
  }
  return {
    id: row.id,
    note_date: noteDate,
    accomplishments: row.accomplishments ?? null,
    productivity_rating: row.productivity_rating != null ? Number(row.productivity_rating) : null,
    mood_rating: row.mood_rating != null ? Number(row.mood_rating) : null,
    notes: row.notes ?? null
  };
}

async function main() {
  await new Promise(r => setTimeout(r, 800));
  const isPg = db.type === 'postgres';
  const row = await db.get(
    isPg
      ? "SELECT id, to_char(note_date, 'YYYY-MM-DD') as note_date, accomplishments, productivity_rating, mood_rating, notes FROM day_notes WHERE user_id = $1 AND note_date::date = $2::date"
      : "SELECT id, strftime('%Y-%m-%d', note_date) as note_date, accomplishments, productivity_rating, mood_rating, notes FROM day_notes WHERE user_id = ? AND date(note_date) = date(?)",
    [profileUserId, date]
  );
  const note = row ? normalizeDayNoteResponse(row) : null;
  console.log('Date param:', date);
  console.log('Row found:', !!row);
  console.log('Note (for API response):', JSON.stringify({ success: true, note }, null, 2));
  const hasNote = note && (note.accomplishments || note.notes || (note.productivity_rating >= 1) || (note.mood_rating >= 1));
  console.log('hasNote (client would show content):', hasNote);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
