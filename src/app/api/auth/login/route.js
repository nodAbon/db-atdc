import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseAuth } from '@/lib/supabaseAdmin';
import {
  checkLoginRateLimit,
  clearLoginFailures,
  recordLoginFailure,
} from '@/lib/loginRateLimit';
import {
  AUTH_MODE_COOKIE,
  MASTER_LOGIN_EMAIL,
  createAuthModeCookie,
} from '@/lib/authMode';

const normalizeIdentifier = (value) => String(value ?? '').trim();
const EMPLOYEE_SELECT = 'emp_no,name,dept,email,login_id,is_active';

async function findEmployee(identifier) {
  // These are indexed exact lookups. Running them together avoids a slow OR
  // query and avoids selecting unused employee columns.
  const results = await Promise.all([
    supabaseAdmin.from('db_employees').select(EMPLOYEE_SELECT).eq('login_id', identifier).eq('is_active', true).maybeSingle(),
    supabaseAdmin.from('db_employees').select(EMPLOYEE_SELECT).eq('emp_no', identifier).eq('is_active', true).maybeSingle(),
    supabaseAdmin.from('db_employees').select(EMPLOYEE_SELECT).eq('email', identifier).eq('is_active', true).maybeSingle(),
  ]);
  return results.map((result) => result.data).find(Boolean) || null;
}

async function signInWithCandidates(emails, password) {
  if (!supabaseAuth) return null;
  for (const email of Array.from(new Set(emails.filter(Boolean)))) {
    const result = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (result?.data?.user && result?.data?.session) return result.data;
  }
  return null;
}

export async function POST(request) {
  try {
    const { identifier, password } = await request.json();
    if (!identifier || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const cleanId = normalizeIdentifier(identifier);
    if (cleanId.length > 254 || String(password).length > 256) {
      return NextResponse.json({ error: '아이디 또는 비밀번호 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const rateLimit = checkLoginRateLimit(request, cleanId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    let matchedEmp = await findEmployee(cleanId);

    // The profile only depends on the employee number, so fetch it while
    // Supabase Auth verifies the password instead of adding another serial
    // database round trip after sign-in.
    const profilePromise = matchedEmp?.emp_no
      ? supabaseAdmin
          .from('db_profiles')
          .select('id,emp_no,is_admin,is_global_admin,must_change_password,rank,position,dept')
          .eq('emp_no', matchedEmp.emp_no)
          .maybeSingle()
          .then((result) => result)
      : null;

    const loginEmails = [];
    if (matchedEmp?.email) loginEmails.push(matchedEmp.email);
    if (cleanId.includes('@')) loginEmails.push(cleanId);
    const loginKey = matchedEmp?.login_id || cleanId;
    const empNoKey = matchedEmp?.emp_no || cleanId;
    loginEmails.push(
      `${loginKey}@dreambay.co.kr`,
      `${loginKey}@hecto.co.kr`,
      `${loginKey}@hecto.internal`,
      `${empNoKey}@hecto.internal`
    );

    let authData = await signInWithCandidates(loginEmails, password);

    if (!authData?.user || !authData?.session) {
      recordLoginFailure(rateLimit.key);
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    clearLoginFailures(rateLimit.key);

    const userId = authData.user.id;

    let profile = profilePromise ? (await profilePromise).data : null;

    if (profile && profile.id !== userId) {
      return NextResponse.json({ error: '계정과 직원 프로필 연결이 올바르지 않습니다.' }, { status: 403 });
    }

    if (!profile && !profilePromise && userId) {
      const fallback = await supabaseAdmin
        .from('db_profiles')
        .select('id,emp_no,is_admin,is_global_admin,must_change_password,rank,position,dept')
        .eq('id', userId)
        .maybeSingle();
      profile = fallback.data || null;
    }

    const masterLoginId = MASTER_LOGIN_EMAIL.split('@')[0];
    const masterRequested = [MASTER_LOGIN_EMAIL, masterLoginId].includes(cleanId.toLowerCase());
    if (profile?.is_global_admin === true && !masterRequested && !matchedEmp) {
      const { data: employee } = await supabaseAdmin
        .from('sa_employees')
        .select(EMPLOYEE_SELECT)
        .eq('email', authData.user.email || MASTER_LOGIN_EMAIL)
        .eq('is_active', true)
        .maybeSingle();
      matchedEmp = employee || null;
    }

    if (!profile && !matchedEmp) {
      return NextResponse.json({ error: '등록된 직원 프로필이 없습니다.' }, { status: 403 });
    }

    const profileIsGlobalAdmin = profile?.is_admin === true && profile?.is_global_admin === true;
    const isGlobalAdmin = profileIsGlobalAdmin && masterRequested;
    const isAdmin = profile?.is_admin === true && (!profileIsGlobalAdmin || isGlobalAdmin);
    const position = isAdmin ? (profile?.position || '') : '';
    const rank = isAdmin ? (profile?.rank || '') : '';
    const isLeader = Boolean(position === '팀장' || position === '실장' || isAdmin);
    const realEmpNo = matchedEmp?.emp_no || authData.user.user_metadata?.emp_no || cleanId;
    const realLoginId = matchedEmp?.login_id || authData.user.user_metadata?.login_id || cleanId;
    const realName = matchedEmp?.name
      || authData.user.user_metadata?.name
      || authData.user.user_metadata?.display_name
      || cleanId;
    const realDept = matchedEmp?.dept || (isGlobalAdmin ? profile?.dept : '') || '';

    if (!profile) {
      await supabaseAdmin.from('db_profiles').upsert({
        id: userId,
        emp_no: realEmpNo,
        dept: realDept,
        rank,
        position,
        is_admin: isAdmin,
        is_global_admin: false,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }

    const mustChangePassword = profile ? profile.must_change_password === true : true;
    const user = {
      id: userId,
      email: authData.user.email,
      empNo: isGlobalAdmin ? null : (matchedEmp?.emp_no || profile?.emp_no || null),
      loginId: realLoginId,
      name: realName,
      isAdmin,
      isGlobalAdmin,
      isLeader,
      mustChangePassword,
      position,
      rank,
      team: realDept,
      dept: realDept,
    };

    const response = NextResponse.json({ success: true, user });
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    };
    response.cookies.set('sb-access-token', authData.session.access_token, cookieOptions);
    response.cookies.set(
      AUTH_MODE_COOKIE,
      createAuthModeCookie(userId, isGlobalAdmin ? 'master' : 'employee'),
      cookieOptions
    );
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      error: process.env.NODE_ENV === 'production'
        ? '로그인 처리 중 오류가 발생했습니다.'
        : (error.message || '로그인 처리 중 오류가 발생했습니다.'),
    }, { status: 500 });
  }
}
