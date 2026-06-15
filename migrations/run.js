// quick migration runner — just reads the SQL file and runs it
// usage: node migrations/run.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const run = async () => {
  const sqlFile = path.join(__dirname, '001_init.sql');
  const sql = fs.readFileSync(sqlFile, 'utf-8');

  console.log('Running migration...');
  try {
    await pool.query(sql);
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

run();
