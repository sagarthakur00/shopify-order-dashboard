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

// Initialize database tables
async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database tables...');
    
    // Create shops table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        shop_domain VARCHAR(255) UNIQUE NOT NULL,
        access_token VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create orders table  
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        shop VARCHAR(255) NOT NULL,
        order_id BIGINT UNIQUE NOT NULL,
        status VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create fulfilment_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fulfilment_items (
        id SERIAL PRIMARY KEY,
        order_id BIGINT,
        line_item_id BIGINT UNIQUE NOT NULL,
        qty INTEGER,
        reason VARCHAR(255),
        image_url VARCHAR(500)
      )
    `);

    // Create images table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        image_url VARCHAR(500) NOT NULL UNIQUE,
        return_item_id INTEGER
      )
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
  }
}

// Test connection on startup
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('🗄️  Database connection verified');
    client.release();
    
    // Initialize tables after successful connection
    await initializeDatabase();
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    console.error('💡 Check your DATABASE_URL in environment variables');
  }
}

// Run connection test
testConnection();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Export pool for direct access if needed
};