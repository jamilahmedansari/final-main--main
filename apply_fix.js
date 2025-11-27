const fs = require('fs');

// Read environment variables from .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

async function applyMigration() {
  try {
    console.log('Migration SQL to apply manually:\n');
    console.log('=' .repeat(60));
    console.log(fs.readFileSync('scripts/012_fix_search_path_add_letter_allowances.sql', 'utf8'));
    console.log('=' .repeat(60));
    console.log('\nTo apply this migration:');
    console.log('1. Go to https://nomiiqzxaxyxnxndvkbe.supabase.co/project/sql');
    console.log('2. Copy and paste the SQL above');
    console.log('3. Click "Run" to execute');

  } catch (err) {
    console.error('Error:', err);
  }
}

applyMigration();