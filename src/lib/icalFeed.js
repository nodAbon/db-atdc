import { supabaseAdmin } from './supabaseAdmin';

function formatICalDate(dateStr) {
  // YYYYMMDD -> YYYYMMDD
  return String(dateStr).replace(/\D/g, '').slice(0, 8);
}

function addOneDay(dateStr) {
  const y = parseInt(dateStr.slice(0, 4), 10);
  const m = parseInt(dateStr.slice(4, 6), 10) - 1;
  const d = parseInt(dateStr.slice(6, 8), 10);
  const dt = new Date(Date.UTC(y, m, d + 1));
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export async function generateICalFeed(token) {
  // 1. 토큰 검증
  const { data: sub, error: subError } = await supabaseAdmin
    .from('db_ical_subscriptions')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .is('revoked_at', null)
    .single();

  if (subError || !sub) {
    throw new Error('유효하지 않거나 만료된 구독 토큰입니다.');
  }

  const depts = Array.isArray(sub.depts) ? sub.depts : [];

  // 2. 직원 조회
  let empQuery = supabaseAdmin.from('db_employees').select('emp_no, name, dept').eq('is_active', true);
  if (depts.length > 0) {
    empQuery = empQuery.in('dept', depts);
  }
  const { data: employees } = await empQuery;
  const empMap = new Map((employees || []).map((e) => [e.emp_no, e]));

  // 3. 연차/휴가 내역 조회 (최근 6개월 ~ 향후 6개월)
  const today = new Date();
  const fromDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const toDate = new Date(today.getFullYear(), today.getMonth() + 4, 0);
  const fromStr = `${fromDate.getFullYear()}${String(fromDate.getMonth() + 1).padStart(2, '0')}01`;
  const toStr = `${toDate.getFullYear()}${String(toDate.getMonth() + 1).padStart(2, '0')}31`;

  const { data: leaves } = await supabaseAdmin
    .from('db_leaves')
    .select('*')
    .gte('start_date', fromStr)
    .lte('end_date', toStr);

  const filteredLeaves = (leaves || []).filter((l) => empMap.has(l.emp_no));

  // 4. iCal 포맷 빌드
  const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//db-atdc//Leave Calendar 1.0//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${sub.label || 'db-atdc 근태 캘린더'}`,
    'X-WR-TIMEZONE:Asia/Seoul',
  ];

  for (const item of filteredLeaves) {
    const emp = empMap.get(item.emp_no) || {};
    const dtstart = formatICalDate(item.start_date);
    const dtend = addOneDay(formatICalDate(item.end_date || item.start_date));
    const summary = `[${item.leave_name || '휴가'}] ${emp.name || item.emp_name} (${emp.dept || '부서미지정'})`;
    const uid = `leave-${item.id || item.emp_no + '-' + dtstart}@db-atdc.internal`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowStr}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:사번: ${item.emp_no} / 구분: ${item.leave_name || '연차'} / 일수: ${item.leave_days || 1}일`,
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
