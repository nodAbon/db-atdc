import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKstDateKey, shiftKstDateKey } from '@/lib/kstDate';

export const dynamic = 'force-dynamic';

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

    // 1. 직원 목록 쿼리 빌더
    const buildEmpQuery = () => {
      let q = supabaseAdmin
        .from('db_employees')
        .select('emp_no, name, dept, is_active')
        .eq('is_active', true)
        .order('dept', { ascending: true })
        .order('name', { ascending: true });

      if (dept && dept !== 'ALL') {
        q = q.eq('dept', dept);
      }
      return q;
    };

    // 2. 출입기록 쿼리 빌더
    const buildLogQuery = () => {
      let q = supabaseAdmin
        .from('db_attendance')
        .select('id, emp_no, a_time, log_time, gate_name, sabun')
        .gte('a_time', fromTime)
        .lte('a_time', toTime)
        .order('a_time', { ascending: false });

      if (rawEmpNo && rawEmpNo !== 'ALL') {
        const cleanEmpNo = rawEmpNo.replace(/^1700/, '');
        const fullSabun = `1700${cleanEmpNo}`;
        q = q.or(`emp_no.eq.${cleanEmpNo},sabun.eq.${cleanEmpNo},emp_no.eq.${fullSabun},sabun.eq.${fullSabun}`);
      }
      return q;
    };

    // 병렬 전수 페칭
    const [employees, rawLogs] = await Promise.all([
      fetchAllRows(buildEmpQuery),
      fetchAllRows(buildLogQuery),
    ]);

    const empMap = new Map();
    (employees || []).forEach((emp) => {
      empMap.set(emp.emp_no, emp);
      empMap.set(`1700${emp.emp_no}`, emp);
    });

    const records = (rawLogs || []).map((row) => {
      const emp = empMap.get(row.emp_no) || empMap.get(row.sabun) || {};
      const empNo = emp.emp_no || row.emp_no || (row.sabun ? String(row.sabun).replace(/^1700/, '') : '-');
      const name = emp.name || '-';
      const department = emp.dept || '부서미지정';
      const eventTime = formatAttendanceLogTime(row);
      const gateName = row.gate_name || '출입';

      return {
        id: row.id,
        emp_no: empNo,
        name,
        dept: department,
        event_time: eventTime,
        gate_name: gateName,
        source: 'caps',
        a_time: row.a_time,
      };
    });

    return NextResponse.json({
      records,
      totalCount: records.length,
      employees: employees || [],
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
