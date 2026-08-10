import { supabaseAdmin } from './supabaseAdmin';
import { COMPANY_CODE, normalizeEmpNoKey } from './dashboardUtils';
import { getKstDateKey } from './kstDate';

export async function fetchAttendanceLogs(month, { dashboardOnly = false, excludeLogs = false, empNo = null } = {}) {
  try {
    const todayStr = getKstDateKey();
    const todayRaw = todayStr.replace(/-/g, '');

    // 1. 임직원 목록
    let empQuery = supabaseAdmin
      .from('db_employees')
      .select('*')
      .eq('is_active', true)
      .order('dept', { ascending: true })
      .order('name', { ascending: true });

    if (empNo) {
      empQuery = empQuery.eq('emp_no', empNo);
    }

    const { data: rawEmployees, error: empError } = await empQuery;
    if (empError) throw empError;

    const employees = (rawEmployees || []).map((e) => ({
      emp_no: e.emp_no,
      name: e.name,
      dept: e.dept,
      email: e.email,
      login_id: e.login_id,
      company_code: e.company_code || COMPANY_CODE,
      rank: e.rank || '',
      position: e.position || '',
    }));

    // 2. 날짜 범위 결정
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

    // 3. 출입 로그
    let logs = [];
    if (!excludeLogs) {
      let logQuery = supabaseAdmin
        .from('db_attendance')
        .select('*')
        .gte('a_time', fromTime)
        .lte('a_time', toTime)
        .order('a_time', { ascending: true });

      if (empNo) {
        logQuery = logQuery.eq('emp_no', empNo);
      }

      const { data: rawLogs, error: logError } = await logQuery;
      if (logError) throw logError;
      logs = rawLogs || [];
    }

    // 4. 연차
    let leaveQuery = supabaseAdmin
      .from('db_leaves')
      .select('*')
      .lte('start_date', toDateStr)
      .gte('end_date', fromDateStr);

    if (empNo) {
      leaveQuery = leaveQuery.eq('emp_no', empNo);
    }

    const { data: rawLeaves, error: leaveError } = await leaveQuery;
    if (leaveError) throw leaveError;

    const leaves = (rawLeaves || []).map((l) => ({
      empNo: l.emp_no,
      empName: l.emp_name,
      startDate: l.start_date,
      endDate: l.end_date,
      leaveCode: l.leave_code,
      leaveName: l.leave_name,
      leaveDays: parseFloat(l.leave_days || 1),
    }));

    // 5. 보정 & 일정
    const { data: corrections } = await supabaseAdmin.from('db_attendance_corrections').select('*');
    const { data: overrides } = await supabaseAdmin.from('db_schedule_overrides').select('*');
    const { data: logAdjustments } = await supabaseAdmin.from('db_attendance_log_adjustments').select('*');

    return {
      employees,
      logs,
      leaves,
      corrections: corrections || [],
      overrides: overrides || [],
      logAdjustments: logAdjustments || [],
    };
  } catch (error) {
    console.error('fetchAttendanceLogs error:', error);
    throw error;
  }
}

export async function fetchEmployeeSchedules() {
  const { data } = await supabaseAdmin.from('db_employee_schedules').select('*');
  return data || [];
}
