import { supabaseAdmin } from './supabaseAdmin';
import {
  MANAGEMENT_DEPTS,
  addDaysToDateStr,
  buildICS,
  normalizeDeptName,
  normalizeDateStringToDash,
} from './ical';
import { getLeaveDisplayLabel } from './leaveRules';

const normalizeSet = (values = []) => new Set(values.map((value) => normalizeDeptName(value)));

const isInDeptSet = (dept, deptSet) => deptSet.has(normalizeDeptName(dept));

function toAllDayEndExclusive(endDate) {
  return addDaysToDateStr(endDate, 1);
}

function getDefaultWindow() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localToday = new Date(today.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
  return {
    from: addDaysToDateStr(localToday, -60),
    to: addDaysToDateStr(localToday, 365),
  };
}

export async function buildLeaveIcsForDepartments({
  departments = MANAGEMENT_DEPTS,
  from,
  to,
  calendarName = 'HECTO 근태관리 캘린더',
  calendarDescription = '',
} = {}) {
  const window = from && to ? { from, to } : getDefaultWindow();
  const deptSet = normalizeSet(departments);

  const { data: employees, error: empError } = await supabaseAdmin
    .from('db_employees')
    .select('emp_no, name, dept, is_active')
    .eq('is_active', true);

  if (empError) {
    throw new Error(`직원 목록 조회 실패: ${empError.message}`);
  }

  const targetEmployees = (employees || []).filter((emp) => isInDeptSet(emp.dept, deptSet));
  const targetEmpNos = targetEmployees.map((emp) => String(emp.emp_no || '').trim()).filter(Boolean);

  if (targetEmpNos.length === 0) {
    return buildICS({
      calendarName,
      calendarDescription,
      events: [],
    });
  }

  const fromRaw = window.from ? window.from.replace(/-/g, '') : '';
  const toRaw = window.to ? window.to.replace(/-/g, '') : '';

  let query = supabaseAdmin
    .from('db_leaves')
    .select('emp_no, emp_name, start_date, end_date, leave_code, leave_name, leave_days, status')
    .eq('status', '40')
    .in('emp_no', targetEmpNos);

  if (fromRaw) {
    query = query.gte('end_date', fromRaw);
  }
  if (toRaw) {
    query = query.lte('start_date', toRaw);
  }

  const { data: leaves, error: leaveError } = await query;

  if (leaveError) {
    throw new Error(`휴가 목록 조회 실패: ${leaveError.message}`);
  }

  const employeeMap = new Map(targetEmployees.map((emp) => [String(emp.emp_no || '').trim(), emp]));

  const events = (leaves || [])
    .filter((leave) => leave.start_date && leave.end_date)
    .map((leave) => {
      const emp = employeeMap.get(String(leave.emp_no || '').trim());
      const empName = leave.emp_name || emp?.name || String(leave.emp_no || '');
      const dept = emp?.dept || '';
      const leaveName = getLeaveDisplayLabel(leave) || leave.leave_name || '연차';
      const startDate = normalizeDateStringToDash(leave.start_date);
      const endDate = normalizeDateStringToDash(leave.end_date);

      return {
        uid: `leave-${leave.emp_no}-${startDate}-${endDate}-${leave.leave_code || '0'}@hecto-qnm`,
        startDate,
        endDate: toAllDayEndExclusive(endDate),
        summary: `${empName} · ${leaveName}`,
        description: [
          `이름: ${empName}`,
          `부서: ${dept}`,
          `휴가 종류: ${leaveName}`,
          `기간: ${startDate} ~ ${endDate}`,
        ].join('\n'),
      };
    });

  return buildICS({
    calendarName,
    calendarDescription: calendarDescription || `${calendarName} - 실시간 부서 연차 구독 피드`,
    events,
  });
}
