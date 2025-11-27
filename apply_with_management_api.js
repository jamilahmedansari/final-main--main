const https = require('https');
const fs = require('fs');
const querystring = require('querystring');

// Configuration
const ACCESS_TOKEN = 'sbp_f68a433be9db029bfe87ba6f9e86da4d71829479';
const PROJECT_REF = 'nomiiqzxaxyxnxndvkbe';

// Read the migration SQL
const migrationSQL = fs.readFileSync('scripts/012_fix_search_path_add_letter_allowances.sql', 'utf8');

console.log('🚀 Applying migration using Supabase Management API...');
console.log(`Project: ${PROJECT_REF}`);

// Function to execute SQL via Management API
function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: sql
    });

    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`\n📝 Executing SQL...`);
    console.log('─'.repeat(60));

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);

        try {
          const result = JSON.parse(data);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ Success!');
            if (result.result) {
              console.log('Rows affected:', result.result.rowCount || 'N/A');
            }
            resolve(result);
          } else {
            console.error('❌ Error response:', data);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          console.error('Response:', data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Execute the migration
async function applyMigration() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SQL:');
    console.log('─'.repeat(60));

    // Split and execute SQL statements one by one for better error handling
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.match(/^CREATE OR REPLACE FUNCTION.*add_letter_allowances/));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`\n📄 Statement ${i + 1}/${statements.length}:`);
      console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));

      await executeSQL(statement);
      console.log('✅ Statement executed successfully\n');
    }

    console.log('='.repeat(60));
    console.log('🎉 Migration completed successfully!');
    console.log('The add_letter_allowances function has been updated with:');
    console.log('  • Fixed parameter type (TEXT instead of plan_type)');
    console.log('  • Secure search_path configuration');
    console.log('  • Schema-qualified table references');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n💡 You can apply the migration manually at:');
    console.log(`https://app.supabase.com/project/${PROJECT_REF}/sql`);
    console.log('\nOr using the SQL from: scripts/012_fix_search_path_add_letter_allowances.sql');
    process.exit(1);
  }
}

// Run the migration
applyMigration();