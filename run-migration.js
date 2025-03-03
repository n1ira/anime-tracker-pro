// Simple script to run the migration
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Read the DATABASE_URL from .env.local file directly
let databaseUrl;
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const match = envContent.match(/DATABASE_URL="([^"]+)"/);
  databaseUrl = match ? match[1] : null;
} catch (err) {
  console.error('Error reading .env.local file:', err);
  process.exit(1);
}

if (!databaseUrl) {
  console.error('Could not find DATABASE_URL in .env.local file');
  process.exit(1);
}

console.log('Found database connection string');

async function runMigration() {
  console.log('Starting migration to add episodesPerSeason field...');
  
  // Create a connection to the database
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false // Required for some cloud databases
    }
  });
  
  try {
    // Verify connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');
    
    // Begin transaction
    await pool.query('BEGIN');
    
    // Check if the column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'shows' AND column_name = 'episodes_per_season'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('Adding episodes_per_season column...');
      
      // Add the new column
      await pool.query(`
        ALTER TABLE shows 
        ADD COLUMN episodes_per_season text DEFAULT '12'
      `);
      
      console.log('Column added successfully');
    } else {
      console.log('Column episodes_per_season already exists');
    }
    
    // Update Solo Leveling with correct episode counts per season
    console.log('Updating Solo Leveling episode counts...');
    await pool.query(`
      UPDATE shows
      SET episodes_per_season = '[12, 13]'
      WHERE title = 'Solo Leveling'
    `);
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    console.log('Migration completed successfully!');
  } catch (error) {
    // Rollback in case of error
    await pool.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('Migration script execution complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error running migration script:', error);
    process.exit(1);
  }); 