import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await verifySession(request);

    if (!session) {
      // 쿠키에서 fallbackEmpNo 조회
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/user-emp-no=([^;]+)/);
      const empNo = match ? decodeURIComponent(match[1]) : '';

      if (empNo) {
        const { data: emp } = await supabaseAdmin
          .from('db_employees')
          .select('emp_no, name, dept')
          .eq('emp_no', empNo)
          .maybeSingle();

        if (emp) {
          return NextResponse.json({
            success: true,
            user: {
              empNo: emp.emp_no,
              name: emp.name,
              dept: emp.dept,
              team: emp.dept,
              isAdmin: true,
              isLeader: true,
            },
          });
        }
      }

      return NextResponse.json({ success: false, error: '세션이 없습니다.' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: session,
    });
  } catch (error) {
    console.error('auth/me GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
