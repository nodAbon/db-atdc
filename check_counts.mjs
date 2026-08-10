import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const idx = t.indexOf('=');
  if (idx > 0) {
    const k = t.substring(0, idx).trim();
    let v = t.substring(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://gbfoempwoeurhhlxqxgy.supabase.co';
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
  console.log('=== Checking Table Counts in Supabase ===');

  const tables = [
    'sa_attendance_logs',
    'sa_leave_records',
    'sa_employees',
    'db_attendance',
    'db_leaves',
    'db_employees',
    'db_attendance_corrections',
    'db_schedule_overrides',
    'db_employee_schedules'
  ];

  for (const t of tables) {
    try {
      const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`Table ${t}: Error (${error.message})`);
      } else {
        console.log(`Table ${t}: ${count} rows`);
      }
    } catch (e) {
      console.log(`Table ${t}: Exception (${e.message})`);
    }
  }

  // 2026년 sa_attendance_logs 날짜 범위 확인
  const { data: minMaxLogs } = await supabase
    .from('sa_attendance_logs')
    .select('a_time')
    .order('a_time', { ascending: true })
    .limit(1);

  const { data: latestLogs } = await supabase
    .from('sa_attendance_logs')
    .select('a_time')
    .order('a_time', { ascending: false })
    .limit(1);

  console.log('\nsa_attendance_logs a_time range:', minMaxLogs?.[0]?.a_time, '~', latestLogs?.[0]?.a_time);

  // db_attendance 날짜 범위 확인
  const { data: minDbLogs } = await supabase
    .from('db_attendance')
    .select('a_time')
    .order('a_time', { ascending: true })
    .limit(1);

  const { data: maxDbLogs } = await supabase
    .from('db_attendance')
    .select('a_time')
    .order('a_time', { ascending: false })
    .limit(1);

  console.log('db_attendance a_time range:', minDbLogs?.[0]?.a_time, '~', maxDbLogs?.[0]?.a_time);
}

checkCounts();
