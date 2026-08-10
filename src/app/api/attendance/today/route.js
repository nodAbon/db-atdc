import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET() {
  try {
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const fromTime = `${dateStr}000000`;
    const toTime = `${dateStr}235959`;

    // 1. 임직원 목록
    const { data: employees, error: empError } = await supabaseAdmin
      .from('db_employees')
      .select('*')
      .eq('is_active', true)
      .order('dept', { ascending: true })
      .order('name', { ascending: true });

    if (empError) throw empError;

    // 2. 오늘 출입기록
    const { data: attendance, error: attError } = await supabaseAdmin
      .from('db_attendance')
      .select('*')
      .gte('a_time', fromTime)
      .lte('a_time', toTime)
      .order('a_time', { ascending: true });

    if (attError) throw attError;

    // 3. 오늘 연차/휴가
    const { data: leaves, error: leaveError } = await supabaseAdmin
      .from('db_leaves')
      .select('*')
      .lte('start_date', dateStr)
      .gte('end_date', dateStr);

    if (leaveError) throw leaveError;

    return NextResponse.json({
      date: dateStr,
      employees: employees || [],
      attendance: attendance || [],
      leaves: leaves || [],
      lastSynced: new Date().toLocaleTimeString('ko-KR'),
    });
  } catch (error) {
    console.error('attendance/today GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
