import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const normalizeIdentifier = (value) => String(value ?? '').trim();

export async function POST(request) {
  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const cleanId = normalizeIdentifier(identifier);

    // 1. db_employees 에서 사원 정보 먼저 조회 (login_id, emp_no, email 모두 대응)
    let matchedEmp = null;
    try {
      const { data: empList } = await supabaseAdmin
        .from('db_employees')
        .select('*')
        .or(`login_id.eq.${cleanId},emp_no.eq.${cleanId},email.eq.${cleanId},email.ilike.${cleanId}@%`)
        .limit(1);

      if (empList && empList.length > 0) {
        matchedEmp = empList[0];
      }
    } catch (e) {
      console.warn('db_employees lookup warning:', e.message);
    }

    // 2. 로그인 후보 이메일 목록 구성
    const candidateEmails = [];
    if (cleanId.includes('@')) {
      candidateEmails.push(cleanId);
    } else {
      if (matchedEmp?.email) candidateEmails.push(matchedEmp.email);
      const loginKey = matchedEmp?.login_id || cleanId;
      const empNoKey = matchedEmp?.emp_no || cleanId;

      candidateEmails.push(
        `${loginKey}@dreambay.co.kr`,
        `${loginKey}@hecto.internal`,
        `${loginKey}@hecto.co.kr`,
        `${empNoKey}@hecto.internal`,
        `${empNoKey}@dreambay.co.kr`,
        `${cleanId}@dreambay.co.kr`,
        `${cleanId}@hecto.internal`,
        `${cleanId}@hecto.co.kr`
      );
    }

    const uniqueCandidateEmails = Array.from(new Set(candidateEmails.filter(Boolean)));

    let authData = null;
    let authError = null;

    // 3. Supabase Auth 시도
    for (const email of uniqueCandidateEmails) {
      const result = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (result?.data?.user && result?.data?.session) {
        authData = result.data;
        authError = null;
        break;
      }
      authError = result?.error || null;
    }

    // 4. 만약 Auth 실패 시, 기본 패스워드 인증 및 계정 자동 연동
    if (!authData?.user && matchedEmp) {
      if (password === '1234' || password === 'hecto12#$' || password === matchedEmp.emp_no || password === matchedEmp.login_id) {
        const targetEmail = matchedEmp.email || `${matchedEmp.login_id || matchedEmp.emp_no}@dreambay.co.kr`;

        // Supabase Auth 사용자 존재 확인
        let targetUser = null;
        try {
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
          targetUser = usersList?.users?.find(
            (u) => u.email === targetEmail || u.email === `${matchedEmp.emp_no}@hecto.internal` || u.email === `${matchedEmp.login_id}@hecto.internal`
          ) || null;
        } catch {
          // ignore
        }

        if (!targetUser) {
          const createRes = await supabaseAdmin.auth.admin.createUser({
            email: targetEmail,
            password: password,
            email_confirm: true,
            user_metadata: { name: matchedEmp.name, emp_no: matchedEmp.emp_no, login_id: matchedEmp.login_id },
          }).catch(() => null);

          targetUser = createRes?.data?.user || null;
        }

        if (targetUser) {
          authData = {
            user: targetUser,
            session: { access_token: `token_${matchedEmp.emp_no}_${Date.now()}` },
          };
        }
      }
    }

    if (!authData?.user) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const userId = authData.user.id;
    const accessToken = authData.session?.access_token || `token_${userId}`;

    const realEmpNo = matchedEmp?.emp_no || authData.user.user_metadata?.emp_no || cleanId;
    const realLoginId = matchedEmp?.login_id || authData.user.user_metadata?.login_id || cleanId;
    const realName = matchedEmp?.name || authData.user.user_metadata?.name || cleanId;
    const realDept = matchedEmp?.dept || '';

    // 5. 프로필 조회 및 자동 부트스트랩
    let { data: profile } = await supabaseAdmin
      .from('db_profiles')
      .select('id, emp_no, is_admin, must_change_password, rank, position')
      .eq('id', userId)
      .maybeSingle();

    if (!profile && realEmpNo) {
      const { data: fallbackProfile } = await supabaseAdmin
        .from('db_profiles')
        .select('id, emp_no, is_admin, must_change_password, rank, position')
        .eq('emp_no', realEmpNo)
        .maybeSingle();
      profile = fallbackProfile || null;
    }

    const isAdmin = Boolean(profile?.is_admin || cleanId === 'admin' || realLoginId === 'admin');
    const position = profile?.position || '';
    const rank = profile?.rank || '';
    const isLeader = Boolean(position === '팀장' || position === '실장' || isAdmin);

    // 프로필이 없는 경우 자동 생성 (부트스트랩)
    if (!profile && userId && realEmpNo) {
      try {
        await supabaseAdmin.from('db_profiles').upsert({
          id: userId,
          emp_no: realEmpNo,
          dept: realDept,
          rank: rank,
          position: position,
          is_admin: isAdmin,
          must_change_password: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      } catch (e) {
        console.warn('Profile bootstrap warning:', e.message);
      }
    }

    const userPayload = {
      id: userId,
      email: authData.user.email,
      empNo: realEmpNo,
      loginId: realLoginId,
      name: realName,
      isAdmin,
      isLeader,
      mustChangePassword: Boolean(profile?.must_change_password),
      position: position,
      rank: rank,
      team: realDept,
      dept: realDept,
    };

    const response = NextResponse.json({
      success: true,
      user: userPayload,
    });

    // 쿠키 설정
    const cookieOptions = {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
    };

    response.cookies.set('sb-access-token', accessToken, cookieOptions);
    response.cookies.set('user-emp-no', realEmpNo, cookieOptions);
    response.cookies.set('user-login-id', realLoginId, cookieOptions);
    response.cookies.set('user-name', encodeURIComponent(userPayload.name), cookieOptions);
    response.cookies.set('user-team', encodeURIComponent(realDept), cookieOptions);
    response.cookies.set('user-position', encodeURIComponent(position), cookieOptions);
    response.cookies.set('user-rank', encodeURIComponent(rank), cookieOptions);
    response.cookies.set('user-is-admin', String(isAdmin), cookieOptions);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
