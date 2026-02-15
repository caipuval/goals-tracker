// Removes ONLY known test data: Meister's "Seed Target Goal" and users
// created explicitly for testing (by username only - never by ID).
// Run from project root: node scripts/cleanup_test_data.js

require('dotenv').config();
const db = require('../database');

const TEST_USERNAMES_ONLY = ['testuser20260212', 'invitee_0215', 'inviter_0215'];

async function main() {
  // 1. Delete Meister's Seed Target Goal only
  const meister = await db.get(
    `SELECT id FROM users WHERE LOWER(username) = LOWER(?)`,
    ['Meister']
  );
  if (meister) {
    const r = await db.run(
      `DELETE FROM goals WHERE user_id = ? AND LOWER(title) = LOWER(?)`,
      [meister.id, 'Seed Target Goal']
    );
    console.log('Deleted Meister seed goal, rows affected:', r.changes ?? r.rowCount ?? 0);
  } else {
    console.log('Meister not found; skipped seed goal delete.');
  }

  // 2. Delete users ONLY by these exact test usernames (never by ID)
  for (const username of TEST_USERNAMES_ONLY) {
    const r = await db.run(`DELETE FROM users WHERE LOWER(username) = LOWER(?)`, [username]);
    const n = r.changes ?? r.rowCount ?? 0;
    if (n) console.log('Deleted test user by username:', username);
  }
  console.log('Cleanup done.');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
