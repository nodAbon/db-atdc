import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYYMMDD or YYYY-MM-DD
    const empNo = searchParams.get('emp_no');
    const dept = searchParams.get('dept');

    if (!date) {
      return NextResponse.json({ error: '날짜 파라미터가 필요합니다.' }, { status: 400 });
    }

    const dateStr = date.replace(/\D/g, '').slice(0, 8);

    // 1. 직원 목록
    let empQuery = supabaseAdmin.from('db_employees').select('*').eq('is_active', true);
    if (empNo) empQuery = empQuery.eq('emp_no', empNo);
    if (dept && dept !== 'ALL') empQuery = empQuery.eq('dept', dept);
    const { data: employees, error: empError } = await empQuery;
    if (empError) throw empError;

    const empNos = (employees || []).map((e) => e.emp_no);
    if (empNos.length === 0) {
      return NextResponse.json({ employees: [], logs: [], adjustments: [], corrections: [] });
    }

    // 2. 출입 로그
    const fromTime = `${dateStr}000000`;
    const toTime = `${dateStr}235959`;

    const { data: logs, error: logError } = await supabaseAdmin
      .from('db_attendance')
      .select('*')
      .in('emp_no', empNos)
      .gte('a_time', fromTime)
      .lte('a_time', toTime)
      .order('a_time', { ascending: true });

    if (logError) throw logError;

    // 3. 로그 역할 조정 내역
    const { data: adjustments } = await supabaseAdmin
      .from('db_attendance_log_adjustments')
      .select('*')
      .in('emp_no', empNos);

    // 4. 수동 보정 내역
    const workDateIso = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    const { data: corrections } = await supabaseAdmin
      .from('db_attendance_corrections')
      .select('*')
      .in('emp_no', empNos)
      .eq('work_date', workDateIso);

    return NextResponse.json({
      employees: employees || [],
      logs: logs || [],
      adjustments: adjustments || [],
      corrections: corrections || [],
    });
  } catch (error) {
    console.error('attendance-records GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
