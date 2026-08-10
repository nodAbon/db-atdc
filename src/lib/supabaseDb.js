import { supabaseAdmin } from './supabaseAdmin';
import { COMPANY_CODE, normalizeEmpNoKey } from './dashboardUtils';
import { getKstDateKey } from './kstDate';

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

    // 2. 쿼리 객체 구성
    let empQuery = supabaseAdmin
      .from('db_employees')
      .select('*')
      .eq('is_active', true)
      .order('dept', { ascending: true })
      .order('name', { ascending: true });

    if (empNo) {
      empQuery = empQuery.eq('emp_no', empNo);
    }

    let logQuery = null;
    if (!excludeLogs) {
      logQuery = supabaseAdmin
        .from('db_attendance')
        .select('*')
        .gte('a_time', fromTime)
        .lte('a_time', toTime)
        .order('a_time', { ascending: true })
        .limit(50000);

      if (empNo) {
        logQuery = logQuery.eq('emp_no', empNo);
      }
    }

    let leaveQuery = supabaseAdmin
      .from('db_leaves')
      .select('*')
      .lte('start_date', toDateStr)
      .gte('end_date', fromDateStr)
      .limit(10000);

    if (empNo) {
      leaveQuery = leaveQuery.eq('emp_no', empNo);
    }

    // 3. 모든 쿼리를 Promise.all 병렬 실행 (순차 7회 -> 병렬 1회 왕복)
    const [
      empRes,
      logRes,
      leaveRes,
      corrRes,
      overrideRes,
      adjRes,
    ] = await Promise.all([
      empQuery.limit(500),
      logQuery || Promise.resolve({ data: [] }),
      leaveQuery,
      supabaseAdmin.from('db_attendance_corrections').select('*').limit(5000),
      supabaseAdmin.from('db_schedule_overrides').select('*').limit(5000),
      supabaseAdmin.from('db_attendance_log_adjustments').select('*').limit(5000),
    ]);

    if (empRes.error) throw empRes.error;
    if (logRes?.error) throw logRes.error;
    if (leaveRes.error) throw leaveRes.error;

    const employees = (empRes.data || []).map((e) => ({
      emp_no: e.emp_no,
      name: e.name,
      dept: e.dept,
      email: e.email,
      login_id: e.login_id,
      company_code: e.company_code || COMPANY_CODE,
      rank: e.rank || '',
      position: e.position || '',
    }));

    const leaves = (leaveRes.data || []).map((l) => ({
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
      logs: logRes.data || [],
      leaves,
      corrections: corrRes.data || [],
      overrides: overrideRes.data || [],
      logAdjustments: adjRes.data || [],
    };
  } catch (error) {
    console.error('fetchAttendanceLogs error:', error);
    throw error;
  }
}

export async function fetchEmployeeSchedules() {
  try {
    const { data, error } = await supabaseAdmin.from('db_employee_schedules').select('*');
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
