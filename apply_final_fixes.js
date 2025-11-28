const https = require('https');

// Configuration
const ACCESS_TOKEN = 'sbp_f68a433be9db029bfe87ba6f9e86da4d71829479';
const PROJECT_REF = 'nomiiqzxaxyxnxndvkbe';

console.log('🚀 Applying final security fixes...\n');

// Execute SQL via Supabase Database API
function executeViaDatabaseAPI(sql) {
  return new Promise((resolve, reject) => {
    const payload = {
      query: sql
    };

    const postData = JSON.stringify(payload);

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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(data);
            resolve({ status: res.statusCode, data: result });
          } catch (e) {
            resolve({ status: res.statusCode, data: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Apply the create_employee_coupon fix
async function applyCreateEmployeeCouponFix() {
  try {
    console.log('1️⃣  Fixing create_employee_coupon function...');

    const sql = `
      DROP FUNCTION IF EXISTS public.create_employee_coupon(UUID);

      CREATE FUNCTION public.create_employee_coupon(emp_id UUID)
      RETURNS TEXT
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_catalog
      AS $func$
      DECLARE
          coupon_code TEXT;
      BEGIN
          coupon_code := 'EMP' || UPPER(substring(md5(emp_id || extract(epoch from now())), 1, 8));

          INSERT INTO public.employee_coupons (
              employee_id,
              code,
              discount_percent,
              is_active
          ) VALUES (
              emp_id,
              coupon_code,
              20,
              true
          );

          RETURN coupon_code;
      END;
      $func$;
    `;

    const result = await executeViaDatabaseAPI(sql);
    console.log('✅ create_employee_coupon fixed successfully!');

    // Verify the fix
    const verify = await executeViaDatabaseAPI(`
      SELECT
        proname,
        prosecdef,
        array_to_string(proconfig, ', ') as config
      FROM pg_proc
      WHERE proname = 'create_employee_coupon'
    `);

    console.log('\nVerification results:');
    console.log(JSON.stringify(verify.data, null, 2));

  } catch (error) {
    console.log('❌ Could not apply automatically');
    console.log('Please apply manually via: https://app.supabase.com/project/' + PROJECT_REF + '/sql');
  }
}

// Configure password protection via project settings
async function configurePasswordProtection() {
  try {
    console.log('\n2️⃣  Attempting to enable leaked password protection...');

    const configPayload = {
      auth: {
        password_min_length: 8,
        password_required: true,
        site_name: 'Talk-To-My-Lawyer',
        security: {
          breached_passwords: {
            enabled: true,
            action: 'block'
          }
        }
      }
    };

    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${PROJECT_REF}/config/auth`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Password protection configured!');
        } else {
          console.log('⚠️  Could not configure via API');
          console.log('Please enable manually in dashboard');
        }
      });
    });

    req.write(JSON.stringify(configPayload));
    req.end();

  } catch (error) {
    console.log('❌ Configuration failed');
  }
}

// Run all fixes
async function runAllFixes() {
  await applyCreateEmployeeCouponFix();
  await configurePasswordProtection();

  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log('\n✅ Actions Taken:');
  console.log('   • Attempted to fix create_employee_coupon function');
  console.log('   • Attempted to enable leaked password protection');

  console.log('\n📝 Manual Steps (if needed):');
  console.log('\n1. For create_employee_coupon:');
  console.log('   🔗 https://app.supabase.com/project/' + PROJECT_REF + '/sql');
  console.log('   📄 Copy SQL from: fix_employee_coupon_direct.sql');

  console.log('\n2. For password protection:');
  console.log('   🔗 https://app.supabase.com/project/' + PROJECT_REF + '/auth/security');
  console.log('   ✅ Enable "Enable breached password detection"');
  console.log('   🛡️ Set action to "Block"');
}

runAllFixes();