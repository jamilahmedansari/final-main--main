const https = require('https');
const fs = require('fs');

// Configuration
const ACCESS_TOKEN = 'sbp_f68a433be9db029bfe87ba6f9e86da4d71829479';
const PROJECT_REF = 'nomiiqzxaxyxnxndvkbe';

// Read the complete migration SQL as a single statement
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

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Response:', data);

        try {
          const result = JSON.parse(data);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ Success!');
            resolve(result);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
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

// Execute the complete migration as one statement
async function applyMigration() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('📝 Executing complete migration SQL...');
    console.log('─'.repeat(60));

    // First, try just the DROP FUNCTION
    console.log('\nStep 1: Dropping existing function if it exists...');
    await executeSQL('DROP FUNCTION IF EXISTS add_letter_allowances(UUID, TEXT);');
    console.log('✅ Function dropped (if it existed)\n');

    // Then execute the CREATE FUNCTION
    console.log('\nStep 2: Creating new function with fixed search_path...');
    const createFunctionSQL = `CREATE FUNCTION add_letter_allowances(sub_id UUID, plan TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
    letters_to_add INT;
BEGIN
    IF plan = 'one_time' THEN
        letters_to_add := 1;
    ELSIF plan = 'standard_4_month' THEN
        letters_to_add := 4;
    ELSIF plan = 'premium_8_month' THEN
        letters_to_add := 8;
    ELSE
        RAISE EXCEPTION 'Invalid plan type: %', plan;
    END IF;

    UPDATE public.subscriptions
    SET remaining_letters = letters_to_add,
        last_reset_at = NOW(),
        updated_at = NOW()
    WHERE id = sub_id;
END;
$function$;`;

    await executeSQL(createFunctionSQL);
    console.log('✅ Function created successfully!\n');

    console.log('='.repeat(60));
    console.log('🎉 Migration completed successfully!');
    console.log('The add_letter_allowances function has been updated with:');
    console.log('  • Fixed parameter type (TEXT instead of plan_type)');
    console.log('  • Secure search_path = public, pg_catalog');
    console.log('  • Schema-qualified table references (public.subscriptions)');
    console.log('  • SECURITY DEFINER with safe search_path');
    console.log('='.repeat(60));

    // Verify the function was created
    console.log('\n🔍 Verifying function creation...');
    const verifyResult = await executeSQL(`
      SELECT
        proname as function_name,
        lanname as language,
        prosecdef as security_definer,
        pg_get_functiondef(oid) as definition
      FROM pg_proc
      JOIN pg_language ON pg_proc.prolang = pg_language.oid
      WHERE proname = 'add_letter_allowances';
    `);

    console.log('\n✅ Function verification complete!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);

    // Show the SQL for manual execution
    console.log('\n💡 Please execute the SQL manually:');
    console.log('Go to: https://app.supabase.com/project/' + PROJECT_REF + '/sql');
    console.log('\nSQL to execute:');
    console.log('─'.repeat(60));
    console.log(createFunctionSQL || migrationSQL);
    console.log('─'.repeat(60));
  }
}

// Run the migration
applyMigration();