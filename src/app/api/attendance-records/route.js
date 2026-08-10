import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKstDateKey, shiftKstDateKey } from '@/lib/kstDate';
import { normalizeEmpNoKey } from '@/lib/dashboardUtils';

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
    const empNo = String(searchParams.get('empNo') || searchParams.get('emp_no') || '').trim();
    const today = getKstDateKey(new Date());
    const from = parseDateInput(searchParams.get('from') || searchParams.get('date'), shiftKstDateKey(today, -30));
    const to = parseDateInput(searchParams.get('to') || searchParams.get('date'), today);
    const dept = searchParams.get('dept') || 'ALL';

    // 1. 직원 목록 조회
    let empQuery = supabaseAdmin
      .from('db_employees')
      .select('emp_no, name, dept, is_active')
      .eq('is_active', true)
      .order('dept', { ascending: true })
      .order('name', { ascending: true });

    if (dept && dept !== 'ALL') {
      empQuery = empQuery.eq('dept', dept);
    }

    const { data: employeeRows, error: empErr } = await empQuery;
    if (empErr) throw empErr;

    if (!empNo) {
      return NextResponse.json({
        success: true,
        employees: employeeRows || [],
        logs: [],
        from,
        to,
      });
    }

    // 2. 선택된 직원의 기간 내 출입기록 조회
    const fromTime = `${from.replace(/-/g, '')}000000`;
    const toTime = `${shiftKstDateKey(to, 1).replace(/-/g, '')}060000`; // 익일 새벽까지

    const empKey = normalizeEmpNoKey(empNo);
    const { data: rawLogs, error: logErr } = await supabaseAdmin
      .from('db_attendance')
      .select('*')
      .eq('emp_no', empKey)
      .gte('a_time', fromTime)
      .lte('a_time', toTime)
      .order('a_time', { ascending: false });

    if (logErr) throw logErr;

    // 3. 조정 내역 조회
    const { data: adjustmentRows } = await supabaseAdmin
      .from('db_attendance_log_adjustments')
      .select('*')
      .eq('emp_no', empKey);

    const adjustmentMap = new Map();
    (adjustmentRows || []).forEach((adj) => {
      adjustmentMap.set(String(adj.a_time || adj.attendance_id), adj);
    });

    const logs = (rawLogs || []).map((row) => {
      const formattedTime = formatAttendanceLogTime(row);
      const rawWorkDate = formattedTime.split(' ')[0] || from;
      const adj = adjustmentMap.get(String(row.a_time)) || adjustmentMap.get(String(row.id));

      return {
        id: row.id,
        empNo: row.emp_no,
        name: row.name,
        logTime: formattedTime,
        a_time: row.a_time,
        rawWorkDate,
        workDate: adj?.work_date || rawWorkDate,
        adjustedRole: adj?.role || '',
        adjustmentNote: adj?.note || '',
        isAdjusted: Boolean(adj),
        gateName: row.e_name || (row.e_group && row.e_node ? `${row.e_group}/${row.e_node}` : '-'),
        source: 'caps',
      };
    });

    return NextResponse.json({
      success: true,
      employees: employeeRows || [],
      logs,
      from,
      to,
      selectedEmpNo: empKey,
    });
  } catch (error) {
    console.error('attendance-records GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, a_time, aTime, empNo, emp_no, workDate, adjustedRole, note } = body;

    const targetEmpNo = normalizeEmpNoKey(empNo || emp_no);
    const targetATime = String(a_time || aTime || '');

    if (!targetEmpNo || !targetATime) {
      return NextResponse.json({ success: false, error: '사번 및 태그 시각(a_time)이 필요합니다.' }, { status: 400 });
    }

    if (!adjustedRole) {
      // 조정 삭제
      await supabaseAdmin
        .from('db_attendance_log_adjustments')
        .delete()
        .eq('emp_no', targetEmpNo)
        .eq('a_time', targetATime);
    } else {
      // 조정 생성 또는 업데이트
      const { error } = await supabaseAdmin
        .from('db_attendance_log_adjustments')
        .upsert({
          emp_no: targetEmpNo,
          a_time: targetATime,
          work_date: workDate,
          role: adjustedRole,
          note: note || null,
          created_at: new Date().toISOString(),
        }, { onConflict: 'emp_no,a_time' });

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('attendance-records POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
