import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const COMPANY_CODE = '1700';

// -----------------------------------------------------------------------------
// [GET] 직원 목록 조회
// -----------------------------------------------------------------------------
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get('q') || '').trim();
    const dept = searchParams.get('dept') || 'ALL';
    const status = searchParams.get('status') || 'ALL'; // ALL, ACTIVE, INACTIVE

    let query = supabaseAdmin
      .from('db_employees')
      .select('*')
      .order('is_active', { ascending: false })
      .order('dept', { ascending: true })
      .order('name', { ascending: true });

    if (status === 'ACTIVE') {
      query = query.eq('is_active', true);
    } else if (status === 'INACTIVE') {
      query = query.eq('is_active', false);
    }

    if (dept && dept !== 'ALL') {
      query = query.eq('dept', dept);
    }

    const { data: employees, error: empError } = await query;
    if (empError) throw empError;

    // 관리자 프로필 정보 조회
    const { data: profiles } = await supabaseAdmin
      .from('db_profiles')
      .select('emp_no, is_admin, rank, position');

    const adminMap = new Set();
    (profiles || []).forEach((p) => {
      if (p.is_admin) adminMap.add(p.emp_no);
    });

    let results = (employees || []).map((e) => ({
      ...e,
      is_admin: adminMap.has(e.emp_no),
    }));

    // 검색어 필터링 (사번, 이름, 이메일, 부서)
    if (search) {
      const lower = search.toLowerCase();
      results = results.filter(
        (e) =>
          String(e.name || '').toLowerCase().includes(lower) ||
          String(e.emp_no || '').toLowerCase().includes(lower) ||
          String(e.dept || '').toLowerCase().includes(lower) ||
          String(e.email || '').toLowerCase().includes(lower) ||
          String(e.login_id || '').toLowerCase().includes(lower)
      );
    }

    // 고유 부서 목록 추출
    const departments = Array.from(new Set(employees.map((e) => e.dept).filter(Boolean))).sort();

    return NextResponse.json({
      success: true,
      employees: results,
      totalCount: results.length,
      departments,
    });
  } catch (error) {
    console.error('employees GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// [POST] 신규 직원 등록 및 로그인 계정 생성
// -----------------------------------------------------------------------------
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      emp_no,
      name,
      dept = '경영지원팀',
      rank = '',
      position = '',
      email = '',
      login_id = '',
      password = '1234',
      is_admin = false,
    } = body;

    if (!emp_no || !name) {
      return NextResponse.json({ success: false, error: '사번과 성명은 필수 입력 항목입니다.' }, { status: 400 });
    }

    const cleanEmpNo = String(emp_no).trim().replace(/\D/g, '');
    const cleanName = String(name).trim();
    const cleanEmail = email ? String(email).trim() : `${cleanEmpNo}@hecto.internal`;
    const cleanLoginId = login_id ? String(login_id).trim() : cleanEmpNo;

    // 1. 중복 사번 확인
    const { data: existingEmp } = await supabaseAdmin
      .from('db_employees')
      .select('emp_no')
      .eq('emp_no', cleanEmpNo)
      .maybeSingle();

    if (existingEmp) {
      return NextResponse.json({ success: false, error: `이미 등록된 사번(${cleanEmpNo})입니다.` }, { status: 400 });
    }

    // 2. db_employees 테이블에 등록
    const newEmp = {
      emp_no: cleanEmpNo,
      name: cleanName,
      dept: String(dept).trim() || '소속미지정',
      rank: String(rank).trim(),
      position: String(position).trim(),
      email: cleanEmail.includes('@') ? cleanEmail : null,
      login_id: cleanLoginId,
      company_code: COMPANY_CODE,
      is_active: true,
      synced_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabaseAdmin.from('db_employees').insert(newEmp);
    if (insertError) throw insertError;

    // 3. Supabase Auth 계정 생성 (로그인용)
    const initialPassword = String(password || '1234').trim();
    let authUser = null;

    try {
      const { data: authRes, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: initialPassword,
        email_confirm: true,
        user_metadata: { name: cleanName, emp_no: cleanEmpNo },
      });

      if (authRes?.user) {
        authUser = authRes.user;
      } else if (authErr) {
        console.warn('Auth user create warning:', authErr.message);
      }
    } catch (authException) {
      console.warn('Auth user create exception:', authException.message);
    }

    // 4. db_profiles 테이블 등록/업서트
    if (authUser?.id || cleanEmpNo) {
      await supabaseAdmin.from('db_profiles').upsert({
        id: authUser?.id || undefined,
        emp_no: cleanEmpNo,
        is_admin: Boolean(is_admin),
        rank: String(rank).trim(),
        position: String(position).trim(),
        must_change_password: false,
      }, { onConflict: 'emp_no' });
    }

    return NextResponse.json({
      success: true,
      message: `${cleanName}(${cleanEmpNo}) 직원이 성공적으로 등록되었습니다.`,
      employee: { ...newEmp, is_admin: Boolean(is_admin) },
    });
  } catch (error) {
    console.error('employees POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// [PUT] 직원 정보 수정 / 비밀번호 변경 / 상태 토글
// -----------------------------------------------------------------------------
export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      emp_no,
      name,
      dept,
      rank,
      position,
      email,
      login_id,
      is_active,
      is_admin,
      new_password,
    } = body;

    if (!emp_no) {
      return NextResponse.json({ success: false, error: '사번이 누락되었습니다.' }, { status: 400 });
    }

    const cleanEmpNo = String(emp_no).trim();

    // 1. db_employees 업데이트
    const updatePayload = {};
    if (name !== undefined) updatePayload.name = String(name).trim();
    if (dept !== undefined) updatePayload.dept = String(dept).trim();
    if (rank !== undefined) updatePayload.rank = String(rank).trim();
    if (position !== undefined) updatePayload.position = String(position).trim();
    if (email !== undefined) updatePayload.email = email ? String(email).trim() : null;
    if (login_id !== undefined) updatePayload.login_id = login_id ? String(login_id).trim() : cleanEmpNo;
    if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);
    updatePayload.synced_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('db_employees')
      .update(updatePayload)
      .eq('emp_no', cleanEmpNo);

    if (updateError) throw updateError;

    // 2. 관리자 권한 업데이트
    if (is_admin !== undefined) {
      await supabaseAdmin
        .from('db_profiles')
        .upsert({
          emp_no: cleanEmpNo,
          is_admin: Boolean(is_admin),
        }, { onConflict: 'emp_no' });
    }

    // 3. 비밀번호 재설정 요청이 있는 경우
    if (new_password) {
      const cleanPassword = String(new_password).trim();
      // Auth 사용자 검색 및 비밀번호 갱신
      const email = email || `${cleanEmpNo}@hecto.internal`;
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const targetUser = (usersData?.users || []).find(
        (u) => u.email === email || u.user_metadata?.emp_no === cleanEmpNo || u.email?.startsWith(`${cleanEmpNo}@`)
      );

      if (targetUser) {
        await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
          password: cleanPassword,
        });
      } else {
        // 없으면 새로 생성
        await supabaseAdmin.auth.admin.createUser({
          email: email.includes('@') ? email : `${cleanEmpNo}@hecto.internal`,
          password: cleanPassword,
          email_confirm: true,
          user_metadata: { emp_no: cleanEmpNo, name: name || cleanEmpNo },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${cleanEmpNo} 직원 정보가 수정되었습니다.`,
    });
  } catch (error) {
    console.error('employees PUT error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// [DELETE] 직원 삭제
// -----------------------------------------------------------------------------
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const empNo = String(searchParams.get('emp_no') || '').trim();

    if (!empNo) {
      return NextResponse.json({ success: false, error: '삭제할 사번이 필요합니다.' }, { status: 400 });
    }

    // 1. db_employees에서 삭제
    const { error: delEmpError } = await supabaseAdmin
      .from('db_employees')
      .delete()
      .eq('emp_no', empNo);

    if (delEmpError) throw delEmpError;

    // 2. db_profiles에서 삭제
    await supabaseAdmin.from('db_profiles').delete().eq('emp_no', empNo);

    return NextResponse.json({
      success: true,
      message: `사번 ${empNo} 직원이 성공적으로 삭제되었습니다.`,
    });
  } catch (error) {
    console.error('employees DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
