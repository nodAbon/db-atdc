import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireApiSession, privateJson, internalError } from '@/lib/apiAuth';

export async function POST(request) {
  try {
    const auth = await requireApiSession(request, { roles: ['admin', 'leader'], mutation: true });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { action, attendanceId, empNo, workDate, role, note, correctedOutTime, reason } = body;

    // 1. 개별 태그 역할 조정 (출근/퇴근/무시하기)
    if (action === 'adjust_role') {
      if (!attendanceId || !empNo || !/^\d{4}-\d{2}-\d{2}$/.test(String(workDate)) || !['출근', '퇴근', '무시하기'].includes(role)) {
        return privateJson({ error: '필수 파라미터가 올바르지 않습니다.' }, { status: 400 });
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
            adjusted_by: auth.session.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'attendance_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return privateJson({ success: true, adjustment: data });
    }

    // 2. 수동 시간 보정
    if (action === 'correct_time') {
      if (!empNo || !/^\d{4}-\d{2}-\d{2}$/.test(String(workDate)) || !correctedOutTime) {
        return privateJson({ error: '보정 시간 및 날짜가 올바르지 않습니다.' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('db_attendance_corrections')
        .upsert(
          {
            emp_no: empNo,
            work_date: workDate,
            corrected_out_time: correctedOutTime,
            reason: reason || '관리자 수동 보정',
            corrected_by: auth.session.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'emp_no,work_date' }
        )
        .select()
        .single();

      if (error) throw error;
      return privateJson({ success: true, correction: data });
    }

    return privateJson({ error: '유효하지 않은 액션입니다.' }, { status: 400 });
  } catch (error) {
    return internalError('attendance-records/adjust error:', error, '근태 보정 내용을 저장하지 못했습니다.');
  }
}
