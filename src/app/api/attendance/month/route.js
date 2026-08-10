import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || ''; // YYYY-MM

    const [yearStr, monthStr] = (month || '').split('-');
    if (!yearStr || !monthStr) {
      return NextResponse.json({ error: '올바른 month 파라미터(YYYY-MM)가 필요합니다.' }, { status: 400 });
    }

    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const lastDay = new Date(y, m, 0).getDate();

    const fromTime = `${yearStr}${monthStr.padStart(2, '0')}01000000`;
    const toTime = `${yearStr}${monthStr.padStart(2, '0')}${String(lastDay).padStart(2, '0')}235959`;
    const fromDateStr = `${yearStr}${monthStr.padStart(2, '0')}01`;
    const toDateStr = `${yearStr}${monthStr.padStart(2, '0')}${String(lastDay).padStart(2, '0')}`;

    // 병렬 쿼리로 초고속 로드 (Promise.all)
    const [empRes, attRes, leaveRes] = await Promise.all([
      supabaseAdmin
        .from('db_employees')
        .select('emp_no, name, dept, is_active')
        .eq('is_active', true)
        .order('dept', { ascending: true })
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('db_attendance')
        .select('emp_no, a_time, log_time, gate_name, sabun')
        .gte('a_time', fromTime)
        .lte('a_time', toTime)
        .order('a_time', { ascending: true }),
      supabaseAdmin
        .from('db_leaves')
        .select('emp_no, emp_name, start_date, end_date, leave_code, leave_name, leave_days, status')
        .eq('status', '40')
        .lte('start_date', toDateStr)
        .gte('end_date', fromDateStr),
    ]);

    if (empRes.error) throw empRes.error;
    if (attRes.error) throw attRes.error;
    if (leaveRes.error) throw leaveRes.error;

    return NextResponse.json({
      month,
      employees: empRes.data || [],
      attendance: attRes.data || [],
      leaves: leaveRes.data || [],
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
