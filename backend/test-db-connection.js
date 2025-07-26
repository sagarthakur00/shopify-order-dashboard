const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  console.log('📊 Using DATABASE_URL:', process.env.DATABASE_URL);
  
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    console.log('📅 Database time:', result.rows[0].current_time);
    console.log('🗄️  Database version:', result.rows[0].db_version);
    
    client.release();
    await pool.end();
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error('Error details:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.error('💡 Hint: Check if your database host is correct');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Hint: Check if PostgreSQL is running on the specified port');
    } else if (error.code === '28P01') {
      console.error('💡 Hint: Check your username and password');
    } else if (error.code === '3D000') {
      console.error('💡 Hint: Check if the database name exists');
    }
    
    return false;
  }
}

// Run the test
testDatabaseConnection().then(success => {
  if (!success) {
    console.log('\n📝 To fix database connection issues:');
    console.log('1. Update DATABASE_URL in .env file with correct credentials');
    console.log('2. Make sure PostgreSQL is installed and running');
    console.log('3. Create the database if it doesn\'t exist');
    console.log('4. Check firewall/network settings');
  }
  process.exit(success ? 0 : 1);
});
