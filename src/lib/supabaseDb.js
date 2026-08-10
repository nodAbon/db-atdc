import { supabaseAdmin } from './supabaseAdmin';
import { COMPANY_CODE, normalizeEmpNoKey } from './dashboardUtils';
import { getKstDateKey } from './kstDate';

/**
 * Supabase PostgREST의 1,000건 기본 제한을 뚫고
 * 조건에 맞는 전체 데이터(수만 건)를 1,000건 단위로 전수 페칭하는 헬퍼 함수
 */
async function fetchAllRows(buildQueryFn, pageSize = 1000) {
  let allRows = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const to = from + pageSize - 1;
    const query = buildQueryFn().range(from, to);
    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...data);
    if (data.length < pageSize) {
      hasMore = false;
    } else {
      from += pageSize;
    }
  }

  return allRows;
}

export async function fetchAttendanceLogs(month, { dashboardOnly = false, excludeLogs = false, empNo = null } = {}) {
  try {
    const todayStr = getKstDateKey();
    const todayRaw = todayStr.replace(/-/g, '');

    // 1. 날짜 범위 결정
    let fromTime, toTime, fromDateStr, toDateStr;
    if (dashboardOnly || !month) {
      fromTime = `${todayRaw}000000`;
      toTime = `${todayRaw}235959`;
      fromDateStr = todayRaw;
      toDateStr = todayRaw;
    } else {
      const [yearStr, monthStr] = month.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const lastDay = new Date(y, m, 0).getDate();
      fromTime = `${yearStr}${monthStr.padStart(2, '0')}01000000`;
      toTime = `${yearStr}${monthStr.padStart(2, '0')}${String(lastDay).padStart(2, '0')}235959`;
      fromDateStr = `${yearStr}${monthStr.padStart(2, '0')}01`;
      toDateStr = `${yearStr}${monthStr.padStart(2, '0')}${String(lastDay).padStart(2, '0')}`;
    }

    // 2. 쿼리 빌더 함수 정의 (페이지네이션 전수 페칭용)
    const empQueryFn = () => {
      let q = supabaseAdmin
        .from('db_employees')
        .select('*')
        .eq('is_active', true)
        .order('dept', { ascending: true })
        .order('name', { ascending: true });
      if (empNo) q = q.eq('emp_no', empNo);
      return q;
    };

    const logQueryFn = () => {
      let q = supabaseAdmin
        .from('db_attendance')
        .select('*')
        .gte('a_time', fromTime)
        .lte('a_time', toTime)
        .order('a_time', { ascending: true });
      if (empNo) q = q.eq('emp_no', empNo);
      return q;
    };

    const leaveQueryFn = () => {
      let q = supabaseAdmin
        .from('db_leaves')
        .select('*')
        .lte('start_date', toDateStr)
        .gte('end_date', fromDateStr);
      if (empNo) q = q.eq('emp_no', empNo);
      return q;
    };

    // 3. 전수 페칭 병렬 실행 (대시보드 전용 최적화 & 실패 방지)
    const [
      employeesData,
      logsData,
      leavesData,
      corrData,
      overrideData,
      adjData,
    ] = await Promise.all([
      fetchAllRows(empQueryFn).catch((e) => { console.warn('empQuery error:', e.message); return []; }),
      !excludeLogs ? fetchAllRows(logQueryFn).catch((e) => { console.warn('logQuery error:', e.message); return []; }) : Promise.resolve([]),
      fetchAllRows(leaveQueryFn).catch((e) => { console.warn('leaveQuery error:', e.message); return []; }),
      !dashboardOnly ? fetchAllRows(() => supabaseAdmin.from('db_attendance_corrections').select('*')).catch(() => []) : Promise.resolve([]),
      fetchAllRows(() => {
        let q = supabaseAdmin.from('db_schedule_overrides').select('*');
        if (dashboardOnly) q = q.eq('override_date', todayStr);
        return q;
      }).catch(() => []),
      fetchAllRows(() => supabaseAdmin.from('db_attendance_log_adjustments').select('*')).catch(() => []),
    ]);

    const employees = (employeesData || []).map((e) => ({
      emp_no: e.emp_no,
      name: e.name,
      dept: e.dept,
      email: e.email,
      login_id: e.login_id,
      company_code: e.company_code || COMPANY_CODE,
      rank: e.rank || '',
      position: e.position || '',
    }));

    const leaves = (leavesData || []).map((l) => ({
      empNo: l.emp_no,
      empName: l.emp_name,
      startDate: l.start_date,
      endDate: l.end_date,
      leaveCode: l.leave_code,
      leaveName: l.leave_name,
      leaveDays: parseFloat(l.leave_days || 1),
    }));

    return {
      employees,
      logs: logsData || [],
      leaves,
      corrections: corrData || [],
      overrides: overrideData || [],
      logAdjustments: adjData || [],
    };
  } catch (error) {
    console.error('fetchAttendanceLogs error:', error);
    throw error;
  }
}

export async function fetchEmployeeSchedules() {
  try {
    const { data, error } = await supabaseAdmin.from('db_employee_schedules').select('*').limit(1000);
    if (error) {
      console.warn('fetchEmployeeSchedules warning:', error.message);
      return [];
    }
    return (data || []).map((row) => ({
      empNo: row.emp_no,
      scheduleTime: row.schedule_time ? String(row.schedule_time).slice(0, 5) : '09:00',
      scheduleEndTime: row.schedule_end_time ? String(row.schedule_end_time).slice(0, 5) : '',
    }));
  } catch (e) {
    console.warn('fetchEmployeeSchedules error:', e.message);
    return [];
  }
}
