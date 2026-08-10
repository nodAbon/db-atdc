const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const idx = t.indexOf('=');
  if (idx > 0) {
    const k = t.substring(0, idx).trim();
    let v = t.substring(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function benchmark() {
  console.log('=== Benchmarking Supabase Queries and Data Processing ===\n');

  // 1. Employees query
  let t0 = Date.now();
  const { data: emps } = await supabase
    .from('db_employees')
    .select('emp_no, name, dept, is_active')
    .eq('is_active', true);
  let t1 = Date.now();
  console.log(`[1] db_employees Query: ${t1 - t0}ms (${emps?.length || 0} rows)`);

  // 2. Attendance query (Day)
  t0 = Date.now();
  const { data: attDay } = await supabase
    .from('db_attendance')
    .select('emp_no, a_time, log_time, gate_name, sabun')
    .gte('a_time', '20260810000000')
    .lte('a_time', '20260810235959');
  t1 = Date.now();
  console.log(`[2] db_attendance Day Query: ${t1 - t0}ms (${attDay?.length || 0} rows)`);

  // 3. Attendance query (Month - 31 days)
  t0 = Date.now();
  const { data: attMonth } = await supabase
    .from('db_attendance')
    .select('emp_no, a_time, log_time, gate_name, sabun')
    .gte('a_time', '20260801000000')
    .lte('a_time', '20260831235959');
  t1 = Date.now();
  console.log(`[3] db_attendance Month Query (31 days): ${t1 - t0}ms (${attMonth?.length || 0} rows)`);

  // 4. Attendance query (60 days for records)
  t0 = Date.now();
  const { data: att60 } = await supabase
    .from('db_attendance')
    .select('emp_no, a_time, log_time, gate_name, sabun')
    .gte('a_time', '20260611000000')
    .lte('a_time', '20260810235959')
    .limit(3000);
  t1 = Date.now();
  console.log(`[4] db_attendance 60 Days Query: ${t1 - t0}ms (${att60?.length || 0} rows)`);

  // 5. Leaves query
  t0 = Date.now();
  const { data: leaves } = await supabase
    .from('db_leaves')
    .select('*')
    .eq('status', '40');
  t1 = Date.now();
  console.log(`[5] db_leaves Query: ${t1 - t0}ms (${leaves?.length || 0} rows)`);

  // 6. Overrides query
  t0 = Date.now();
  const { data: overrides } = await supabase
    .from('db_schedule_overrides')
    .select('*');
  t1 = Date.now();
  console.log(`[6] db_schedule_overrides Query: ${t1 - t0}ms (${overrides?.length || 0} rows)`);

  // 7. Parallel All-in-One (실제 API 방식)
  console.log('\n--- Testing Sequential vs Parallel (Promise.all) ---');
  t0 = Date.now();
  const [eRes, aRes, lRes, oRes, sRes] = await Promise.all([
    supabase.from('db_employees').select('emp_no, name, dept, is_active').eq('is_active', true),
    supabase.from('db_attendance').select('emp_no, a_time, log_time, gate_name, sabun').gte('a_time', '20260810000000').lte('a_time', '20260810235959'),
    supabase.from('db_leaves').select('*').eq('status', '40'),
    supabase.from('db_schedule_overrides').select('*'),
    supabase.from('db_employee_schedules').select('*'),
  ]);
  t1 = Date.now();
  console.log(`[Parallel Day Load (Promise.all)]: ${t1 - t0}ms`);
}

benchmark();
