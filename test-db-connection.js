// Test script to check Railway PostgreSQL connection
require('dotenv').config();
const { Pool } = require('pg');

console.log('🔍 Testing Railway Database Connection...\n');

console.log('DATABASE_TYPE:', process.env.DATABASE_TYPE);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (hidden)' : 'NOT SET');
console.log('DATABASE_SSL:', process.env.DATABASE_SSL);
console.log('');

if (!process.env.DATABASE_URL) {
  console.log('❌ DATABASE_URL is not set in .env file!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

console.log('🔄 Attempting to connect...\n');

pool.query('SELECT NOW() as current_time, version() as pg_version')
  .then(result => {
    console.log('✅ SUCCESS! Connected to Railway PostgreSQL!');
    console.log('');
    console.log('📊 Database Info:');
    console.log('  Current Time:', result.rows[0].current_time);
    console.log('  PostgreSQL Version:', result.rows[0].pg_version.split(',')[0]);
    console.log('');
    console.log('✅ Railway connection is working perfectly!');
    pool.end();
    process.exit(0);
  })
  .catch(error => {
    console.log('❌ CONNECTION FAILED!');
    console.log('');
    console.log('Error:', error.message);
    console.log('');
    console.log('🔧 Possible Issues:');
    console.log('  1. DATABASE_URL uses internal Railway address (postgres.railway.internal)');
    console.log('  2. Need to use DATABASE_PUBLIC_URL instead');
    console.log('  3. Or database might not be accessible from outside Railway');
    console.log('');
    console.log('💡 Solution: Get DATABASE_PUBLIC_URL from Railway Variables tab');
    pool.end();
    process.exit(1);
  });
