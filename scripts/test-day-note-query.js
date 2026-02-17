require('dotenv').config();
const db = require('../database');

async function run() {
  await new Promise(r => setTimeout(r, 800));
  const row = await db.get(
    'SELECT id, note_date, productivity_rating, mood_rating FROM day_notes WHERE user_id = ? LIMIT 1',
    [2]
  );
  console.log('Row:', JSON.stringify(row, null, 2));
  const dateParam = '2026-02-16';
  const row2 = await db.get(
    "SELECT id, strftime('%Y-%m-%d', note_date) as note_date FROM day_notes WHERE user_id = ? AND date(note_date) = date(?)",
    [2, dateParam]
  );
  console.log('Query with strftime and date(?) with 2026-02-16:', row2);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
