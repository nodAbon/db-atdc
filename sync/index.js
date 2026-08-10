/**
 * ================================================================
 * db-atdc 메인 동기화 데몬
 * - 법인 1700 / 캡스 그룹 09 기준
 * - 주기적으로 직원, 연차, 캡스 출입로그를 동기화합니다.
 * ================================================================
 */

const { loadSyncEnv } = require('./loadEnv');
const mysql = require('mysql2/promise');
const { syncAttendance } = require('./caps');
const { syncEmployees } = require('./employees');
const { syncLeaves } = require('./leaves');

loadSyncEnv();

const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS, 10) || 1800000;
const MY_COMPANY_CODE = process.env.MY_COMPANY_CODE || '1700';

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
  connectTimeout: 15000,
};

function log(msg) {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`[db-atdc-sync] [${now}] ${msg}`);
}

async function runCycle() {
  log(`=== 동기화 사이클 시작 (법인: ${MY_COMPANY_CODE}) ===`);
  const startedAt = Date.now();
  let conn = null;

  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);

    const empCount = await syncEmployees(conn);
    const leaveCount = await syncLeaves(conn);
    const capsCount = await syncAttendance(conn);

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    log(`동기화 완료 (${elapsed}s) | 임직원: ${empCount}명 | 연차: ${leaveCount}건 | CAPS: ${capsCount}건`);
  } catch (error) {
    log(`[ERROR] 동기화 실패: ${error.message}`);
  } finally {
    if (conn) await conn.end();
  }
}

async function main() {
  log(`db-atdc 동기화 데몬 시작 (${SYNC_INTERVAL_MS / 1000}초 주기)`);
  await runCycle();
  setInterval(runCycle, SYNC_INTERVAL_MS);
}

main();
