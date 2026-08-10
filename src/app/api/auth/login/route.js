import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const normalizeIdentifier = (value) => String(value ?? '').trim();

const getCandidateEmails = (identifier) => {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return [];
  if (normalized.includes('@')) return [normalized];

  const fallbackDomains = ['hecto.co.kr', 'hecto.internal', 'hectoqnm.co.kr'];
  return fallbackDomains.map((domain) => `${normalized}@${domain}`);
};

export async function POST(request) {
  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const cleanId = normalizeIdentifier(identifier);
    const candidateEmails = getCandidateEmails(cleanId);

    let authData = null;
    let authError = null;

    // 1. Supabase Auth 시도
    for (const email of candidateEmails) {
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

    // 2. 만약 Auth 실패 시, db_employees 사번 매칭 테스트 (초기 비밀번호 또는 공통 기본 인증)
    if (!authData?.user) {
      const { data: emp } = await supabaseAdmin
        .from('db_employees')
        .select('*')
        .or(`emp_no.eq.${cleanId},login_id.eq.${cleanId}`)
        .maybeSingle();

      if (emp && (password === '1234' || password === 'hecto12#$' || password === emp.emp_no)) {
        // 임시 세션 토큰 발행 (Supabase Admin을 통해 사용자 생성 또는 JWT 발급)
        const email = `${emp.emp_no}@hecto.internal`;
        
        // Supabase Auth에 계정 없으면 자동 생성
        let { data: userRes } = await supabaseAdmin.auth.admin.getUserById(emp.emp_no).catch(() => ({ data: null }));
        if (!userRes?.user) {
          const createRes = await supabaseAdmin.auth.admin.createUser({
            email,
            password: password,
            email_confirm: true,
            user_metadata: { name: emp.name, emp_no: emp.emp_no },
          }).catch(() => null);
          
          if (createRes?.data?.user) {
            authData = {
              user: createRes.data.user,
              session: { access_token: `token_${emp.emp_no}_${Date.now()}` },
            };
          }
        }
      }
    }

    if (!authData?.user) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const userId = authData.user.id;
    const accessToken = authData.session?.access_token || `token_${userId}`;
    const fallbackEmpNo = cleanId.replace(/@.*$/, '');

    // 프로필 정보 조회
    let { data: profile } = await supabaseAdmin
      .from('db_profiles')
      .select('emp_no, is_admin, must_change_password, rank, position')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      const { data: fallbackProfile } = await supabaseAdmin
        .from('db_profiles')
        .select('emp_no, is_admin, must_change_password, rank, position')
        .eq('emp_no', fallbackEmpNo)
        .maybeSingle();
      profile = fallbackProfile || null;
    }

    const empNo = profile?.emp_no || fallbackEmpNo;
    const { data: employee } = await supabaseAdmin
      .from('db_employees')
      .select('dept, name')
      .eq('emp_no', empNo)
      .maybeSingle();

    const isAdmin = Boolean(profile?.is_admin || cleanId === 'admin');
    const isLeader = Boolean(profile?.position === '팀장' || profile?.position === '실장' || isAdmin);

    const userPayload = {
      id: userId,
      email: authData.user.email,
      empNo,
      name: employee?.name || authData.user.user_metadata?.name || cleanId,
      loginId: cleanId,
      isAdmin,
      isLeader,
      mustChangePassword: Boolean(profile?.must_change_password),
      position: profile?.position || '',
      rank: profile?.rank || '',
      team: employee?.dept || '',
      dept: employee?.dept || '',
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
    response.cookies.set('user-emp-no', empNo, cookieOptions);
    response.cookies.set('user-name', encodeURIComponent(userPayload.name), cookieOptions);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
