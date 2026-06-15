const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/docmanager';
const isRemote = connectionString.includes('neon.tech') || connectionString.includes('supabase.co') || connectionString.includes('render.com');

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  // keep idle connections alive — handy for long-running servers
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected postgres pool error:', err.message);
});

// quick helper so controllers don't have to import pool directly
const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
