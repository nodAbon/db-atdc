import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM

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

    // 1. 임직원 목록
    const { data: employees, error: empError } = await supabaseAdmin
      .from('db_employees')
      .select('*')
      .eq('is_active', true)
      .order('dept', { ascending: true })
      .order('name', { ascending: true });

    if (empError) throw empError;

    // 2. 해당 월 출입기록
    const { data: attendance, error: attError } = await supabaseAdmin
      .from('db_attendance')
      .select('*')
      .gte('a_time', fromTime)
      .lte('a_time', toTime)
      .order('a_time', { ascending: true });

    if (attError) throw attError;

    // 3. 해당 월 연차/휴가
    const { data: leaves, error: leaveError } = await supabaseAdmin
      .from('db_leaves')
      .select('*')
      .lte('start_date', toDateStr)
      .gte('end_date', fromDateStr);

    if (leaveError) throw leaveError;

    return NextResponse.json({
      month,
      employees: employees || [],
      attendance: attendance || [],
      leaves: leaves || [],
    });
  } catch (error) {
    console.error('attendance/month GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
