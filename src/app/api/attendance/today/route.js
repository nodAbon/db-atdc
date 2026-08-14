import { requireApiSession, privateJson, internalError } from '@/lib/apiAuth';
import { fetchAttendanceLogs } from '@/lib/supabaseDb';
import { getKstDateKey } from '@/lib/kstDate';

export async function GET(request) {
  try {
    const auth = await requireApiSession(request);
    if (auth.response) return auth.response;

    const date = getKstDateKey();
    const data = await fetchAttendanceLogs(undefined, {
      dashboardOnly: true,
      includeAllCompanies: false,
    });

    return privateJson({
      date: date.replace(/-/g, ''),
      employees: data.employees,
      attendance: data.logs,
      leaves: data.leaves,
      lastSynced: new Date().toLocaleTimeString('ko-KR'),
    });
  } catch (error) {
    return internalError('attendance/today GET error:', error, '오늘 근태 데이터를 불러오지 못했습니다.');
  }
}
