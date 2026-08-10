/**
 * ================================================================
 * db-atdc 연차/휴가 내역 동기화 - hr_yuncha_use -> db_leaves
 * ================================================================
 */

const { loadSyncEnv } = require('./loadEnv');
const mysql = require('mysql2/promise');
const { createClient } = require('@supabase/supabase-js');

loadSyncEnv();

const MY_COMPANY_CODE = process.env.MY_COMPANY_CODE || '1700';

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
  connectTimeout: 15000,
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function normalizeEmpNo(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith(MY_COMPANY_CODE) && digits.length >= 12) {
    return digits.slice(MY_COMPANY_CODE.length).slice(-8).replace(/^0+/, '') || digits.slice(-8);
  }
  return digits.slice(-8).replace(/^0+/, '') || digits.slice(-8);
}

async function syncLeaves(conn) {
  const currentYear = new Date().getFullYear();
  const fromDate = `${currentYear - 1}0101`;

  const [rows] = await conn.execute(`
    SELECT
      u.I_EMPLOY_NO AS emp_no,
      e.I_NAME      AS emp_name,
      u.I_FROM_DATE AS start_date,
      u.I_TO_DATE   AS end_date,
      u.I_USE_CODE  AS leave_code,
      u.I_USE_NAME  AS leave_name,
      u.I_USE_DAYS  AS leave_days,
      u.I_STATUS    AS status
    FROM hr_yuncha_use u
    INNER JOIN hr_employee e ON
      e.I_COMPANY = u.I_COMPANY
      AND e.I_EMPLOY_NO = u.I_EMPLOY_NO
    WHERE u.I_COMPANY = ?
      AND u.I_FROM_DATE >= ?
      AND COALESCE(u.I_STATUS, '1') = '1'
  `, [MY_COMPANY_CODE, fromDate]);

  if (!rows || rows.length === 0) return 0;

  const batch = rows.map((row) => ({
    emp_no: normalizeEmpNo(row.emp_no),
    emp_name: String(row.emp_name || '').trim(),
    start_date: String(row.start_date || '').replace(/\D/g, '').slice(0, 8),
    end_date: String(row.end_date || row.start_date || '').replace(/\D/g, '').slice(0, 8),
    leave_code: String(row.leave_code || '연차'),
    leave_name: String(row.leave_name || '연차'),
    leave_days: parseFloat(row.leave_days || 1),
    status: String(row.status || '1'),
    synced_at: new Date().toISOString(),
  })).filter((item) => Boolean(item.emp_no && item.start_date));

  const { error } = await supabase
    .from('db_leaves')
    .upsert(batch, { onConflict: 'emp_no,start_date,leave_code' });

  if (error) {
    throw new Error(`db_leaves upsert 실패: ${error.message}`);
  }

  return batch.length;
}

async function runSync() {
  console.log(`[db-atdc] 연차 동기화 시작 (법인: ${MY_COMPANY_CODE})`);
  let conn = null;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const count = await syncLeaves(conn);
    console.log(`[db-atdc] 연차 동기화 완료: ${count}건`);
  } catch (e) {
    console.error('[db-atdc] 연차 동기화 오류:', e.message);
  } finally {
    if (conn) await conn.end();
  }
}

if (require.main === module) {
  runSync();
}

module.exports = { syncLeaves, runSync };
