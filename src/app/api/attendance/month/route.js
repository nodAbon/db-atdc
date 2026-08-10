import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let yearStr = searchParams.get('year') || '';
    let monthStr = searchParams.get('month') || '';

    if (monthStr.includes('-')) {
      const parts = monthStr.split('-');
      yearStr = parts[0];
      monthStr = parts[1];
    }

    if (!yearStr || !monthStr) {
      const now = new Date();
      yearStr = yearStr || String(now.getFullYear());
      monthStr = monthStr || String(now.getMonth() + 1);
    }

    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const lastDay = new Date(y, m, 0).getDate();

    const fromTime = `${yearStr}${monthStr.padStart(2, '0')}01000000`;
    const toTime = `${yearStr}${monthStr.padStart(2, '0')}${String(lastDay).padStart(2, '0')}235959`;
    const fromDateStr = `${yearStr}${monthStr.padStart(2, '0')}01`;
    const toDateStr = `${yearStr}${monthStr.padStart(2, '0')}${String(lastDay).padStart(2, '0')}`;

    // 병렬 쿼리로 초고속 로드 (Promise.all)
    const [employees, attendance, leaves] = await Promise.all([
      fetchAllRows(() =>
        supabaseAdmin
          .from('db_employees')
          .select('emp_no, name, dept, is_active')
          .eq('is_active', true)
          .order('dept', { ascending: true })
          .order('name', { ascending: true })
      ),
      fetchAllRows(() =>
        supabaseAdmin
          .from('db_attendance')
          .select('emp_no, a_time, log_time, gate_name, sabun')
          .gte('a_time', fromTime)
          .lte('a_time', toTime)
          .order('a_time', { ascending: true })
      ),
      fetchAllRows(() =>
        supabaseAdmin
          .from('db_leaves')
          .select('emp_no, emp_name, start_date, end_date, leave_code, leave_name, leave_days, status')
          .eq('status', '40')
          .lte('start_date', toDateStr)
          .gte('end_date', fromDateStr)
      ),
    ]);

    const resolvedMonth = `${yearStr}-${String(monthStr).padStart(2, '0')}`;

    return NextResponse.json({
      month: resolvedMonth,
      employees: employees || [],
      attendance: attendance || [],
      leaves: leaves || [],
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('attendance/month GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
