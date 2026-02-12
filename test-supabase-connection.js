// Test script to check Supabase PostgreSQL connection
require('dotenv').config();
const { Pool } = require('pg');

console.log('🔍 Testing Supabase Database Connection...\n');

console.log('Environment Variables:');
console.log('  DATABASE_TYPE:', process.env.DATABASE_TYPE || 'NOT SET (defaults to sqlite)');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'Set (hidden for security)' : '❌ NOT SET');
console.log('  DATABASE_SSL:', process.env.DATABASE_SSL || 'NOT SET');
console.log('');

if (!process.env.DATABASE_URL) {
  console.log('❌ DATABASE_URL is not set in .env file!');
  console.log('');
  console.log('📝 To connect to Supabase:');
  console.log('  1. Go to Supabase Dashboard → Settings → Database');
  console.log('  2. Copy the Connection Pooling URL (port 6543)');
  console.log('  3. Replace [YOUR-PASSWORD] with your database password');
  console.log('  4. Add to .env file:');
  console.log('     DATABASE_TYPE=postgres');
  console.log('     DATABASE_SSL=true');
  console.log('     DATABASE_URL=your_connection_string_here');
  process.exit(1);
}

if (process.env.DATABASE_TYPE !== 'postgres') {
  console.log('⚠️  DATABASE_TYPE is not set to "postgres"');
  console.log('   Your app will use SQLite instead of Supabase');
  console.log('');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

console.log('🔄 Attempting to connect to Supabase...\n');

pool.query('SELECT NOW() as current_time, version() as pg_version, current_database() as db_name')
  .then(result => {
    console.log('✅ SUCCESS! Connected to Supabase PostgreSQL!');
    console.log('');
    console.log('📊 Database Info:');
    console.log('  Database Name:', result.rows[0].db_name);
    console.log('  Current Time:', result.rows[0].current_time);
    console.log('  PostgreSQL Version:', result.rows[0].pg_version.split(',')[0]);
    console.log('');
    
    // Check if tables exist
    return pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
  })
  .then(result => {
    if (result.rows.length > 0) {
      console.log('📋 Tables found in database:');
      result.rows.forEach(row => {
        console.log('  ✅', row.table_name);
      });
    } else {
      console.log('📋 No tables found (they will be created on first app start)');
    }
    console.log('');
    console.log('✅ Supabase connection is working perfectly!');
    console.log('   Your app is ready to use Supabase! 🚀');
    pool.end();
    process.exit(0);
  })
  .catch(error => {
    console.log('❌ CONNECTION FAILED!');
    console.log('');
    console.log('Error:', error.message);
    console.log('');
    console.log('🔧 Possible Issues:');
    console.log('  1. DATABASE_URL is incorrect or missing password');
    console.log('  2. Using wrong connection string (need Connection Pooling URL)');
    console.log('  3. Database password is incorrect');
    console.log('  4. Supabase project might be paused');
    console.log('');
    console.log('💡 How to fix:');
    console.log('  1. Go to Supabase Dashboard → Settings → Database');
    console.log('  2. Scroll to "Connection Pooling" section');
    console.log('  3. Copy the Connection string (should have port 6543)');
    console.log('  4. Make sure [YOUR-PASSWORD] is replaced with your actual password');
    console.log('  5. Update your .env file');
    pool.end();
    process.exit(1);
  });
