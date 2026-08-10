import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, attendanceId, empNo, workDate, role, note, correctedOutTime, reason } = body;

    // 1. 개별 태그 역할 조정 (출근/퇴근/무시하기)
    if (action === 'adjust_role') {
      if (!attendanceId || !empNo || !workDate || !role) {
        return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('db_attendance_log_adjustments')
        .upsert(
          {
            attendance_id: attendanceId,
            emp_no: empNo,
            work_date: workDate,
            adjusted_role: role,
            note: note || '',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'attendance_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, adjustment: data });
    }

    // 2. 수동 시간 보정
    if (action === 'correct_time') {
      if (!empNo || !workDate || !correctedOutTime) {
        return NextResponse.json({ error: '보정 시간 및 날짜가 필요합니다.' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('db_attendance_corrections')
        .upsert(
          {
            emp_no: empNo,
            work_date: workDate,
            corrected_out_time: correctedOutTime,
            reason: reason || '관리자 수동 보정',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'emp_no,work_date' }
        )
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, correction: data });
    }

    return NextResponse.json({ error: '유효하지 않은 액션입니다.' }, { status: 400 });
  } catch (error) {
    console.error('attendance-records/adjust error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
