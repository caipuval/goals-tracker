// Read-only check: list users and their day notes so you can see if a friend
// has any day note data (to tell "no input" vs "display bug").
// Run from project root: node scripts/check_day_notes.js
// Optional: node scripts/check_day_notes.js <userId_or_username>

require('dotenv').config();
const db = require('../database');

const isPg = db.type === 'postgres';

async function main() {
  const filter = process.argv[2]; // optional: userId (number) or username

  // List users (id, username) for reference
  const users = await db.all(
    isPg
      ? 'SELECT id, username, email FROM users ORDER BY id'
      : 'SELECT id, username, email FROM users ORDER BY id',
    []
  );
  console.log('--- Users ---');
  if (!users.length) {
    console.log('No users in database.');
    return;
  }
  users.forEach((u) => {
    console.log(`  id=${u.id}  username=${u.username}  email=${u.email || '(none)'}`);
  });

  // Build day_notes query: all rows, or filter by user
  let notes;
  if (filter) {
    const byId = /^\d+$/.test(String(filter).trim());
    if (byId) {
      notes = await db.all(
        isPg
          ? 'SELECT id, user_id, note_date, accomplishments, productivity_rating, mood_rating, notes FROM day_notes WHERE user_id = $1 ORDER BY note_date DESC'
          : 'SELECT id, user_id, note_date, accomplishments, productivity_rating, mood_rating, notes FROM day_notes WHERE user_id = ? ORDER BY note_date DESC',
        [parseInt(filter, 10)]
      );
    } else {
      const user = await db.get(
        isPg ? 'SELECT id FROM users WHERE username = $1' : 'SELECT id FROM users WHERE username = ?',
        [filter.trim()]
      );
      if (!user) {
        console.log('\nNo user found with username:', filter);
        return;
      }
      notes = await db.all(
        isPg
          ? 'SELECT id, user_id, note_date, accomplishments, productivity_rating, mood_rating, notes FROM day_notes WHERE user_id = $1 ORDER BY note_date DESC'
          : 'SELECT id, user_id, note_date, accomplishments, productivity_rating, mood_rating, notes FROM day_notes WHERE user_id = ? ORDER BY note_date DESC',
        [user.id]
      );
      console.log('\n--- Day notes for user id=' + user.id + ' (' + filter + ') ---');
    }
  } else {
    notes = await db.all(
      isPg
        ? 'SELECT id, user_id, note_date, accomplishments, productivity_rating, mood_rating, notes FROM day_notes ORDER BY user_id, note_date DESC'
        : 'SELECT id, user_id, note_date, accomplishments, productivity_rating, mood_rating, notes FROM day_notes ORDER BY user_id, note_date DESC',
      []
    );
    if (!filter) console.log('\n--- All day notes ---');
  }

  if (!notes.length) {
    console.log('No day notes found.');
    if (filter) {
      console.log('So this user has not saved any day note (or the filter did not match).');
    }
    return;
  }

  notes.forEach((n) => {
    const acc = n.accomplishments != null ? String(n.accomplishments).trim() : '';
    const noteText = n.notes != null ? String(n.notes).trim() : '';
    const prod = n.productivity_rating != null ? Number(n.productivity_rating) : null;
    const mood = n.mood_rating != null ? Number(n.mood_rating) : null;
    const hasContent = acc.length > 0 || noteText.length > 0 || (prod >= 1 && prod <= 5) || (mood >= 1 && mood <= 5);
    const username = users.find((u) => u.id === n.user_id)?.username || '?';
    // note_date as stored (e.g. YYYY-MM-DD) - important for API date matching
    const rawDate = n.note_date != null ? String(n.note_date).slice(0, 10) : '?';
    console.log('');
    console.log(`  note_date="${rawDate}"  user_id=${n.user_id} (${username})  id=${n.id}`);
    console.log(`    productivity_rating=${prod}  mood_rating=${mood}`);
    console.log(`    accomplishments length=${acc.length}  notes length=${noteText.length}`);
    if (acc.length || noteText.length) {
      const preview = (acc || noteText).slice(0, 80);
      console.log(`    preview: ${preview}${(acc.length + noteText.length) > 80 ? '...' : ''}`);
    }
    console.log(`    has any content: ${hasContent}`);
  });
  console.log('\nDone. If your friend has rows here with content, the data exists and the issue is display/date. If there are no rows (or only empty ones), they have not saved a day note for that period.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
