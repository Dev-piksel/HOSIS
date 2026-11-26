const { Pool } = require('pg')
require('dotenv').config()

async function testConnection() {
  const url = process.env.DATABASE_URL
  console.log('Testing connection to:', url ? url.replace(/:[^:@]+@/, ':****@') : 'undefined')

  if (!url || url.includes('[YOUR-PASSWORD]')) {
    console.log('❌ DATABASE_URL still contains [YOUR-PASSWORD]. Please supply your actual Supabase DB password.')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  })

  try {
    const res = await pool.query('SELECT NOW() as now, version() as version;')
    console.log('✅ Connected successfully to database!')
    console.log('Time:', res.rows[0].now)
    console.log('PostgreSQL Version:', res.rows[0].version)
    await pool.end()
  } catch (err) {
    console.error('❌ Connection error:', err.message)
    await pool.end()
    process.exit(1)
  }
}

testConnection()
