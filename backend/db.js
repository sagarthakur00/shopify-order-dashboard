const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
  console.log('✅ Connected to the database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err.message);
});

// Test connection on startup
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('🗄️  Database connection verified');
    client.release();
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    console.error('💡 Check your DATABASE_URL in .env file');
  }
}

// Run connection test
testConnection();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Export pool for direct access if needed
};