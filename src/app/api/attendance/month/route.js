import { requireApiSession, privateJson, internalError } from '@/lib/apiAuth';
import { fetchAttendanceLogs } from '@/lib/supabaseDb';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = await requireApiSession(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    let year = String(searchParams.get('year') || '').trim();
    let month = String(searchParams.get('month') || '').trim();
    if (month.includes('-')) [year, month] = month.split('-');

    const now = new Date();
    year = /^\d{4}$/.test(year) ? year : String(now.getFullYear());
    month = /^\d{1,2}$/.test(month) ? month.padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0');
    const resolvedMonth = `${year}-${month}`;

    const data = await fetchAttendanceLogs(resolvedMonth, {
      includeAllCompanies: false,
    });

    return privateJson({
      month: resolvedMonth,
      employees: data.employees,
      attendance: data.logs,
      leaves: data.leaves.map((leave) => ({
        emp_no: leave.empNo,
        raw_emp_no: leave.rawEmpNo,
        emp_name: leave.empName,
        start_date: leave.startDate,
        end_date: leave.endDate,
        leave_code: leave.leaveCode,
        leave_name: leave.leaveName,
        leave_days: leave.leaveDays,
        status: leave.status,
        company_code: leave.companyCode,
        data_source: leave.dataSource,
      })),
    });
  } catch (error) {
    return internalError('attendance/month GET error:', error, '월간 근태 데이터를 불러오지 못했습니다.');
  }
}
