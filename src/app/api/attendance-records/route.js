import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKstDateKey, shiftKstDateKey } from '@/lib/kstDate';

export const dynamic = 'force-dynamic';

const parseDateInput = (value, fallback) => {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
};

const formatAttendanceLogTime = (row = {}) => {
  if (row.a_time && String(row.a_time).length >= 14) {
    const aTime = String(row.a_time);
    return `${aTime.substring(0, 4)}-${aTime.substring(4, 6)}-${aTime.substring(6, 8)} ${aTime.substring(8, 10)}:${aTime.substring(10, 12)}:${aTime.substring(12, 14)}`;
  }
  return String(row.a_time || row.log_time || '-');
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawEmpNo = String(searchParams.get('empNo') || searchParams.get('emp_no') || '').trim();
    const today = getKstDateKey(new Date());
    const from = parseDateInput(searchParams.get('from') || searchParams.get('date'), shiftKstDateKey(today, -30));
    const to = parseDateInput(searchParams.get('to') || searchParams.get('date'), today);
    const dept = searchParams.get('dept') || 'ALL';

    const fromTime = `${from.replace(/-/g, '')}000000`;
    const toTime = `${shiftKstDateKey(to, 1).replace(/-/g, '')}060000`;

    // 1. 직원 목록 쿼리 준비
    let empQuery = supabaseAdmin
      .from('db_employees')
      .select('emp_no, name, dept, is_active')
      .eq('is_active', true)
      .order('dept', { ascending: true })
      .order('name', { ascending: true });

    if (dept && dept !== 'ALL') {
      empQuery = empQuery.eq('dept', dept);
    }

    // 2. 출입기록 쿼리 준비
    let logQuery = supabaseAdmin
      .from('db_attendance')
      .select('id, emp_no, a_time, log_time, gate_name, sabun')
      .gte('a_time', fromTime)
      .lte('a_time', toTime)
      .order('a_time', { ascending: false });

    if (rawEmpNo && rawEmpNo !== 'ALL') {
      const cleanEmpNo = rawEmpNo.replace(/^1700/, '');
      const fullSabun = `1700${cleanEmpNo}`;
      logQuery = logQuery.or(`emp_no.eq.${cleanEmpNo},sabun.eq.${cleanEmpNo},emp_no.eq.${fullSabun},sabun.eq.${fullSabun}`);
    }

    // 병렬 실행으로 지연 시간 반토막 단축!
    const [empRes, logRes] = await Promise.all([
      empQuery,
      logQuery.limit(2000),
    ]);

    if (empRes.error) throw empRes.error;
    if (logRes.error) throw logRes.error;

    const employeeRows = empRes.data || [];
    const rawLogs = logRes.data || [];

    const empMap = new Map();
    employeeRows.forEach((e) => {
      empMap.set(String(e.emp_no), e);
      empMap.set(`1700${e.emp_no}`, e);
    });

    const logs = rawLogs.map((row) => {
      const formattedTime = formatAttendanceLogTime(row);
      const rawWorkDate = formattedTime.split(' ')[0] || from;
      const empInfo = empMap.get(String(row.emp_no)) || empMap.get(String(row.sabun));

      return {
        id: row.id,
        empNo: row.emp_no || row.sabun?.replace(/^1700/, ''),
        sabun: row.sabun,
        name: empInfo?.name || '-',
        dept: empInfo?.dept || '-',
        logTime: formattedTime,
        a_time: row.a_time,
        rawWorkDate,
        workDate: rawWorkDate,
        source: 'caps',
      };
    });

    return NextResponse.json({
      success: true,
      employees: employeeRows,
      logs,
      from,
      to,
      selectedEmpNo: rawEmpNo,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('attendance-records GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
