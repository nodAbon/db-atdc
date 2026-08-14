const mysql = require('mysql2/promise');

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'Prd-Hecto-WHR-Ext-NLB-8e82b66ed560637d.elb.ap-northeast-2.amazonaws.com',
  user: process.env.MYSQL_USER || 'secomncaps',
  password: process.env.MYSQL_PASSWORD || 'Hecto12#$',
  database: process.env.MYSQL_DATABASE || 'whr',
  port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
  connectTimeout: 15000,
};

const MY_COMPANY_CODE = '1700';

async function analyze() {
  console.log('=== MySQL tenter 2026년 데이터 정밀 분석 ===');
  const conn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // 1. 2026년 전체 tenter 데이터의 E_GROUP별 분포
    console.log('\n[1] 2026년 전체 tenter의 E_GROUP 분포:');
    const [groupRows] = await conn.query(`
      SELECT E_GROUP, COUNT(*) AS cnt, MIN(E_DATE) AS min_d, MAX(E_DATE) AS max_d
      FROM tenter
      WHERE E_DATE >= '20260101'
      GROUP BY E_GROUP
      ORDER BY cnt DESC
    `);
    console.table(groupRows);

    // 2. 회사 코드 1700(드림베이) 임직원들의 2026년 tenter 출입 기록 월별/일별 분포
    console.log('\n[2] 1700(드림베이) 임직원들의 2026년 월별 출입 건수 (E_GROUP 조건 없이):');
    const [monthlyRows] = await conn.query(`
      SELECT
        SUBSTRING(t.E_DATE, 1, 6) AS yyyymm,
        COUNT(*) AS total_records,
        COUNT(DISTINCT e.I_EMPLOY_NO) AS active_emp_count,
        MIN(t.E_DATE) AS min_date,
        MAX(t.E_DATE) AS max_date
      FROM tenter t
      INNER JOIN hr_employee e ON
        e.I_COMPANY = ?
        AND (
          (e.I_COMPANY = LEFT(t.E_IDNO, 4) AND e.I_EMPLOY_NO = RIGHT(t.E_IDNO, 8))
          OR (e.I_EMPLOY_NO = t.E_IDNO)
          OR (t.E_NAME = e.N_EMPLOY_NAME)
        )
      WHERE t.E_DATE >= '20260101'
      GROUP BY SUBSTRING(t.E_DATE, 1, 6)
      ORDER BY yyyymm ASC
    `, [MY_COMPANY_CODE]);
    console.table(monthlyRows);

    // 3. 2026년 6월, 7월 일자별(E_DATE) 건수 확인
    console.log('\n[3] 2026년 6월 일자별 건수:');
    const [juneRows] = await conn.query(`
      SELECT
        t.E_DATE,
        t.E_GROUP,
        COUNT(*) AS cnt
      FROM tenter t
      INNER JOIN hr_employee e ON
        e.I_COMPANY = ?
        AND (
          (e.I_COMPANY = LEFT(t.E_IDNO, 4) AND e.I_EMPLOY_NO = RIGHT(t.E_IDNO, 8))
          OR (e.I_EMPLOY_NO = t.E_IDNO)
          OR (t.E_NAME = e.N_EMPLOY_NAME)
        )
      WHERE t.E_DATE LIKE '202606%'
      GROUP BY t.E_DATE, t.E_GROUP
      ORDER BY t.E_DATE ASC
    `, [MY_COMPANY_CODE]);
    console.table(juneRows);

    // 4. 2026년 7월 일자별 건수:
    console.log('\n[4] 2026년 7월 일자별 건수:');
    const [julyRows] = await conn.query(`
      SELECT
        t.E_DATE,
        t.E_GROUP,
        COUNT(*) AS cnt
      FROM tenter t
      INNER JOIN hr_employee e ON
        e.I_COMPANY = ?
        AND (
          (e.I_COMPANY = LEFT(t.E_IDNO, 4) AND e.I_EMPLOY_NO = RIGHT(t.E_IDNO, 8))
          OR (e.I_EMPLOY_NO = t.E_IDNO)
          OR (t.E_NAME = e.N_EMPLOY_NAME)
        )
      WHERE t.E_DATE LIKE '202607%'
      GROUP BY t.E_DATE, t.E_GROUP
      ORDER BY t.E_DATE ASC
    `, [MY_COMPANY_CODE]);
    console.table(julyRows);

  } finally {
    await conn.end();
  }
}

analyze().catch(err => {
  console.error('분석 에러:', err.message);
});
