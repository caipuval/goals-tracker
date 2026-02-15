// Seeds a "today" daily goal with a time target for user "Meister".
// Used only to verify the Friends -> Today's Goals target display.
//
// Safe to run multiple times (idempotent).

const db = require('../database');

async function main() {
  const meister = await db.get(
    `SELECT id, username FROM users WHERE LOWER(username)=LOWER(?)`,
    ['Meister']
  );

  if (!meister) {
    console.log('No user "Meister" found; nothing to seed.');
    return;
  }

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const title = 'Seed Target Goal';

  const existing = await db.get(
    `SELECT id FROM goals WHERE user_id=? AND LOWER(title)=LOWER(?) AND start_date=?`,
    [meister.id, title, date]
  );

  if (existing) {
    console.log('Seed goal already exists:', existing.id);
    return;
  }

  const res = await db.run(
    `INSERT INTO goals (user_id, title, description, duration_minutes, type, start_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [meister.id, title, 'Seeded to verify target display', 60, 'daily', date]
  );

  console.log('Inserted seed goal:', res.lastID);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

