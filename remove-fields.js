// Direct script to remove current_episode and total_episodes columns
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function removeFields() {
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('Starting to remove fields...');
    
    // Execute the SQL commands
    await sql`ALTER TABLE shows DROP COLUMN IF EXISTS current_episode;`;
    console.log('Removed current_episode column');
    
    await sql`ALTER TABLE shows DROP COLUMN IF EXISTS total_episodes;`;
    console.log('Removed total_episodes column');
    
    console.log('Successfully removed fields');
  } catch (error) {
    console.error('Error removing fields:', error);
  } finally {
    await sql.end();
    console.log('Database connection closed');
  }
}

removeFields(); 