/**
 * ================================================================
 * db-atdc 임직원 마스터 동기화 - hr_employee -> db_employees
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

async function syncEmployees(conn) {
  const [rows] = await conn.execute(`
    SELECT
      e.I_EMPLOY_NO AS emp_no,
      e.I_NAME      AS name,
      d.I_DEPT_NAME AS dept,
      e.I_EMAIL     AS email,
      e.I_LOGIN_ID  AS login_id,
      e.I_RETIRE_YN AS retire_yn
    FROM hr_employee e
    LEFT JOIN hr_department d ON
      d.I_COMPANY = e.I_COMPANY
      AND d.I_DEPT = e.I_DEPT
    WHERE e.I_COMPANY = ?
  `, [MY_COMPANY_CODE]);

  if (!rows || rows.length === 0) return 0;

  const batch = rows.map((row) => {
    const empNo = normalizeEmpNo(row.emp_no);
    return {
      emp_no: empNo,
      name: String(row.name || '').trim(),
      dept: String(row.dept || '').trim() || '소속미지정',
      email: row.email ? String(row.email).trim() : null,
      login_id: row.login_id ? String(row.login_id).trim() : null,
      company_code: MY_COMPANY_CODE,
      is_active: String(row.retire_yn || '0') !== '1',
      synced_at: new Date().toISOString(),
    };
  }).filter((item) => Boolean(item.emp_no));

  const { error } = await supabase
    .from('db_employees')
    .upsert(batch, { onConflict: 'emp_no' });

  if (error) {
    throw new Error(`db_employees upsert 실패: ${error.message}`);
  }

  return batch.length;
}

async function runSync() {
  console.log(`[db-atdc] 임직원 동기화 시작 (법인: ${MY_COMPANY_CODE})`);
  let conn = null;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const count = await syncEmployees(conn);
    console.log(`[db-atdc] 임직원 동기화 완료: ${count}명`);
  } catch (e) {
    console.error('[db-atdc] 임직원 동기화 오류:', e.message);
  } finally {
    if (conn) await conn.end();
  }
}

if (require.main === module) {
  runSync();
}

module.exports = { syncEmployees, runSync };
