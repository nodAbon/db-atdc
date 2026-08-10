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
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
  const now = new Date();
  const fromMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const fromStr = `${fromMonth.getFullYear()}${String(fromMonth.getMonth() + 1).padStart(2, '0')}01`;

  const [rows] = await conn.execute(`
    SELECT
      y.I_EMPLOY_NO                AS emp_no,
      e.N_EMPLOY_NAME              AS emp_name,
      y.D_START_DATE               AS start_date,
      y.D_END_DATE                 AS end_date,
      y.I_CODE                     AS leave_code,
      CAST(y.I_CODE AS CHAR)       AS leave_name,
      CAST(y.O_ANNLEV_CNT AS CHAR) AS leave_days,
      y.I_STATUS                   AS status
    FROM hr_yuncha_use y
    INNER JOIN hr_employee e ON e.I_COMPANY = y.I_COMPANY AND e.I_EMPLOY_NO = y.I_EMPLOY_NO
    INNER JOIN hr_department d ON d.I_COMPANY = e.I_COMPANY AND d.I_DEPT = e.I_DEPT
    WHERE y.I_COMPANY = ?
      AND y.I_STATUS = '40'
      AND y.D_END_DATE >= ?
  `, [MY_COMPANY_CODE, fromStr]);

  if (!rows || rows.length === 0) return 0;

  const records = rows.map((r) => ({
    emp_no: normalizeEmpNo(r.emp_no),
    emp_name: String(r.emp_name || '').trim(),
    start_date: String(r.start_date || '').replace(/\D/g, '').slice(0, 8),
    end_date: String(r.end_date || r.start_date || '').replace(/\D/g, '').slice(0, 8),
    leave_code: String(r.leave_code || '연차'),
    leave_name: String(r.leave_name || '연차'),
    leave_days: parseFloat(r.leave_days) || 1,
    status: String(r.status || '40'),
    synced_at: new Date().toISOString(),
  })).filter((item) => Boolean(item.emp_no && item.start_date));

  const uniqueRecords = [];
  const seen = new Set();
  for (const r of records) {
    const key = `${r.emp_no}_${r.start_date}_${r.leave_code}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRecords.push(r);
    }
  }

  const { error } = await supabase
    .from('db_leaves')
    .upsert(uniqueRecords, { onConflict: 'emp_no,start_date,leave_code' });

  if (error) {
    throw new Error(`db_leaves upsert 실패: ${error.message}`);
  }

  return uniqueRecords.length;
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
