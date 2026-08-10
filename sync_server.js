/**
 * ==============================================================================
 * db-atdc 서버PC 전용 단독 동기화 스크립트 (sync_server.js)
 * ==============================================================================
 * 
 * [동기화 대상 (AWS MySQL -> Supabase)]
 * 1. 임직원 리스트  : hr_employee      -> db_employees
 * 2. 출입기록 (CAPS): tenter           -> db_attendance
 * 3. 연차사용내역   : hr_yuncha_use    -> db_leaves
 * 
 * [적용 설정]
 * - 법인 코드 (MY_COMPANY_CODE): 1700
 * - 캡스 그룹 (CAPS_E_GROUP)   : 09
 * 
 * [실행 방법]
 *   1회 즉시 실행:  node sync_server.js --once
 *   데몬 주기 실행: node sync_server.js (기본 10분 주기)
 *   PM2 백그라운드: pm2 start sync_server.js --name db-atdc-sync
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { createClient } = require('@supabase/supabase-js');

// ------------------------------------------------------------------------------
// 1. 환경변수 및 기본 설정 (.env 자동 탐색 + Fallback 기본값)
// ------------------------------------------------------------------------------
function loadEnv() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '.env.local'),
    path.join(__dirname, 'sync', '.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
  ];

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      });
    }
  }
}

loadEnv();

// 설정값 매핑
const CONFIG = {
  // MySQL 원본 DB (읽기 전용)
  mysql: {
    host: process.env.MYSQL_HOST || 'Prd-Hecto-WHR-Ext-NLB-8e82b66ed560637d.elb.ap-northeast-2.amazonaws.com',
    user: process.env.MYSQL_USER || 'secomncaps',
    password: process.env.MYSQL_PASSWORD || 'Hecto12#$',
    database: process.env.MYSQL_DATABASE || 'whr',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    connectTimeout: 20000,
  },

  // Supabase (저장소)
  supabase: {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gbfoempwoeurhhlxqxgy.supabase.co',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },

  // 법인 및 캡스 필터
  companyCode: process.env.MY_COMPANY_CODE || process.env.COMPANY_CODE || '1700',
  capsGroup: process.env.CAPS_E_GROUP || '09',
  syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS, 10) || 10 * 60 * 1000, // 기본 10분
  daysToSyncAttendance: 30, // 최근 30일 출입로그 동기화
};

// Supabase Admin 클라이언트 생성
const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ------------------------------------------------------------------------------
// 2. 헬퍼 함수
// ------------------------------------------------------------------------------
function log(level, message, detail = '') {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const prefix = { INFO: 'ℹ️ [INFO]', SUCCESS: '✅ [SUCCESS]', WARN: '⚠️ [WARN]', ERROR: '❌ [ERROR]' }[level] || '[LOG]';
  console.log(`[${now}] ${prefix} ${message}${detail ? ` | ${detail}` : ''}`);
}

function normalizeEmpNo(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith(CONFIG.companyCode) && digits.length >= 12) {
    return digits.slice(CONFIG.companyCode.length).slice(-8).replace(/^0+/, '') || digits.slice(-8);
  }
  return digits.slice(-8).replace(/^0+/, '') || digits.slice(-8);
}

function parseATime(aTime) {
  if (!aTime || String(aTime).length < 14) return null;
  const s = String(aTime);
  return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}T${s.substring(8, 10)}:${s.substring(10, 12)}:${s.substring(12, 14)}+09:00`;
}

function buildGateName(row) {
  const parts = [row.e_group, row.e_mode, row.e_type, row.e_result]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'CAPS';
}

// ------------------------------------------------------------------------------
// 3. 임직원 마스터 동기화 (hr_employee -> db_employees)
// ------------------------------------------------------------------------------
async function syncEmployees(conn) {
  log('INFO', `1/3 임직원 동기화 시작 (법인: ${CONFIG.companyCode})`);

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
  `, [CONFIG.companyCode]);

  if (!rows || rows.length === 0) {
    log('WARN', '동기화 대상 임직원 데이터가 없습니다.');
    return 0;
  }

  const batch = rows.map((row) => {
    const empNo = normalizeEmpNo(row.emp_no);
    return {
      emp_no: empNo,
      name: String(row.name || '').trim(),
      dept: String(row.dept || '').trim() || '소속미지정',
      email: row.email ? String(row.email).trim() : null,
      login_id: row.login_id ? String(row.login_id).trim() : null,
      company_code: CONFIG.companyCode,
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

  log('SUCCESS', `임직원 동기화 완료: ${batch.length}명`);
  return batch.length;
}

// ------------------------------------------------------------------------------
// 4. 연차 사용내역 동기화 (hr_yuncha_use -> db_leaves)
// ------------------------------------------------------------------------------
async function syncLeaves(conn) {
  log('INFO', `2/3 연차 사용내역 동기화 시작 (법인: ${CONFIG.companyCode})`);

  const currentYear = new Date().getFullYear();
  const fromDate = `${currentYear - 1}0101`; // 작년 1월부터 전체

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
  `, [CONFIG.companyCode, fromDate]);

  if (!rows || rows.length === 0) {
    log('INFO', '동기화 대상 연차 데이터가 없습니다.');
    return 0;
  }

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

  log('SUCCESS', `연차 사용내역 동기화 완료: ${batch.length}건`);
  return batch.length;
}

// ------------------------------------------------------------------------------
// 5. CAPS 출입기록 동기화 (tenter -> db_attendance)
// ------------------------------------------------------------------------------
async function syncCapsAttendance(conn) {
  log('INFO', `3/3 CAPS 출입기록 동기화 시작 (법인: ${CONFIG.companyCode}, 그룹: ${CONFIG.capsGroup})`);

  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - CONFIG.daysToSyncAttendance);
  const fromStr = `${fromDate.getFullYear()}${String(fromDate.getMonth() + 1).padStart(2, '0')}${String(fromDate.getDate()).padStart(2, '0')}`;
  const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  const [rows] = await conn.execute(`
    SELECT
      e.I_EMPLOY_NO AS emp_no,
      t.E_IDNO      AS idno,
      t.E_CARD      AS card_no,
      t.E_DATE      AS e_date,
      t.E_TIME      AS e_time,
      t.G_ID        AS gate_code,
      t.E_GROUP     AS e_group,
      t.E_MODE      AS e_mode,
      t.E_TYPE      AS e_type,
      t.E_RESULT    AS e_result
    FROM tenter t
    INNER JOIN hr_employee e ON
      e.I_COMPANY = ?
      AND t.E_IDNO IS NOT NULL
      AND t.E_IDNO <> ''
      AND e.I_COMPANY = LEFT(t.E_IDNO, 4)
      AND e.I_EMPLOY_NO = RIGHT(t.E_IDNO, 8)
    INNER JOIN hr_department d ON
      d.I_COMPANY = ?
      AND d.I_DEPT = e.I_DEPT
    WHERE COALESCE(e.I_RETIRE_YN, '0') <> '1'
      AND t.E_GROUP = ?
      AND t.E_DATE >= ?
      AND t.E_DATE <= ?
    ORDER BY t.E_DATE DESC, t.E_TIME DESC
  `, [CONFIG.companyCode, CONFIG.companyCode, CONFIG.capsGroup, fromStr, todayStr]);

  if (!rows || rows.length === 0) {
    log('INFO', `최근 ${CONFIG.daysToSyncAttendance}일간 대상 CAPS 출입기록이 없습니다.`);
    return 0;
  }

  const batchSize = 500;
  let total = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((row) => {
      const empNo = normalizeEmpNo(row.emp_no || row.idno);
      const sabun = String(row.idno || '').trim() || `${CONFIG.companyCode}${String(empNo).padStart(8, '0')}`;
      const aTime = `${String(row.e_date || '').replace(/\D/g, '').slice(0, 8)}${String(row.e_time || '').replace(/\D/g, '').slice(0, 6).padStart(6, '0')}`;

      return {
        sabun,
        emp_no: empNo || null,
        card_no: row.card_no ? String(row.card_no) : null,
        a_time: aTime,
        log_time: parseATime(aTime),
        eq_code: row.gate_code ? String(row.gate_code) : null,
        gate_name: buildGateName(row) || 'CAPS',
        flag1: null,
        event_type: '출입',
        source: 'caps',
        synced_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from('db_attendance')
      .upsert(batch, { onConflict: 'sabun,a_time' });

    if (error) {
      throw new Error(`db_attendance upsert 실패: ${error.message}`);
    }

    total += batch.length;
  }

  log('SUCCESS', `CAPS 출입기록 동기화 완료: ${total}건 (최근 ${CONFIG.daysToSyncAttendance}일)`);
  return total;
}

// ------------------------------------------------------------------------------
// 6. 전체 동기화 사이클 실행기
// ------------------------------------------------------------------------------
async function executeFullSync() {
  const startTime = Date.now();
  console.log('\n================================================================');
  log('INFO', `🚀 db-atdc 전체 동기화 사이클 시작 [법인: ${CONFIG.companyCode} / 캡스: ${CONFIG.capsGroup}]`);
  console.log('================================================================');

  let conn = null;
  try {
    log('INFO', `MySQL 접속 시도 중: ${CONFIG.mysql.host}:${CONFIG.mysql.port} / DB: ${CONFIG.mysql.database}`);
    conn = await mysql.createConnection(CONFIG.mysql);
    log('SUCCESS', 'MySQL 연결 성공');

    const empCount = await syncEmployees(conn);
    const leaveCount = await syncLeaves(conn);
    const capsCount = await syncCapsAttendance(conn);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('----------------------------------------------------------------');
    log('SUCCESS', `✨ 전체 동기화 성공 (${elapsed}초 소요)`);
    log('INFO', `📊 집계 요약: 임직원 ${empCount}명 | 연차 ${leaveCount}건 | CAPS 출입기록 ${capsCount}건`);
    console.log('================================================================\n');
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log('ERROR', `동기화 도중 오류 발생 (${elapsed}초 경과)`, error.message);
    if (error.code === 'ETIMEDOUT') {
      log('WARN', '네트워크 타임아웃: 서버PC의 VPN 연결 또는 AWS 보안그룹 인가 상태를 확인하세요.');
    }
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {}
    }
  }
}

// ------------------------------------------------------------------------------
// 7. 메인 실행 진입점
// ------------------------------------------------------------------------------
async function main() {
  const isOnce = process.argv.includes('--once') || process.argv.includes('-1');

  if (isOnce) {
    log('INFO', '단발성 1회 실행 모드로 시작합니다.');
    await executeFullSync();
    process.exit(0);
  } else {
    log('INFO', `데몬 모드로 실행합니다. (동기화 주기: ${CONFIG.syncIntervalMs / 1000}초)`);
    await executeFullSync();
    setInterval(executeFullSync, CONFIG.syncIntervalMs);
  }
}

main();
