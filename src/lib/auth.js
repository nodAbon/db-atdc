import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseAdmin';

const getCookieValueFromHeader = (cookieHeader, name) => {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

export async function verifySession(request) {
  let accessToken = null;
  let fallbackEmpNo = null;
  let fallbackLoginId = null;

  // 1. 헤더에서 쿠키 파싱
  if (request?.headers) {
    const cookieHeader = request.headers.get?.('cookie') || '';
    accessToken = getCookieValueFromHeader(cookieHeader, 'sb-access-token');
    fallbackEmpNo = getCookieValueFromHeader(cookieHeader, 'user-emp-no') || '';
    fallbackLoginId = getCookieValueFromHeader(cookieHeader, 'user-login-id') || '';
  }

  // 2. Next.js cookies() API 시도
  if (!accessToken) {
    try {
      const cookieStore = await cookies();
      accessToken = cookieStore.get('sb-access-token')?.value || null;
      if (!fallbackEmpNo) {
        fallbackEmpNo = cookieStore.get('user-emp-no')?.value || '';
      }
      if (!fallbackLoginId) {
        fallbackLoginId = cookieStore.get('user-login-id')?.value || '';
      }
    } catch {
      // Cookies not accessible in current boundary
    }
  }

  if (!accessToken) return null;

  try {
    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (authErr || !userData?.user) return null;

    const userId = userData.user.id;
    const emailLoginId = userData.user.email?.split('@')[0] || '';
    const loginId = fallbackLoginId || emailLoginId;

    // 프로필 조회 (db_profiles)
    let { data: profile } = await supabaseAdmin
      .from('db_profiles')
      .select('id, emp_no, is_admin, position, rank, must_change_password')
      .eq('id', userId)
      .maybeSingle();

    if (!profile && fallbackEmpNo) {
      const { data: fallbackProfile } = await supabaseAdmin
        .from('db_profiles')
        .select('id, emp_no, is_admin, position, rank, must_change_password')
        .eq('emp_no', fallbackEmpNo)
        .maybeSingle();
      profile = fallbackProfile || null;
    }

    // 직원 정보 조회 (db_employees) - login_id, emp_no, email 모두 대응
    let matchedEmployee = null;
    const lookupKeys = [profile?.emp_no, fallbackEmpNo, loginId, emailLoginId].filter(Boolean);
    if (lookupKeys.length > 0) {
      const { data: empList } = await supabaseAdmin
        .from('db_employees')
        .select('*')
        .or(`emp_no.in.(${lookupKeys.join(',')}),login_id.in.(${lookupKeys.join(',')}),email.eq.${userData.user.email}`)
        .limit(1);

      if (empList && empList.length > 0) {
        matchedEmployee = empList[0];
      }
    }

    const realEmpNo = matchedEmployee?.emp_no || profile?.emp_no || fallbackEmpNo || loginId;
    const realLoginId = matchedEmployee?.login_id || loginId;
    const realName = matchedEmployee?.name || userData.user.user_metadata?.name || loginId;
    const realDept = matchedEmployee?.dept || '';

    const isAdmin = Boolean(profile?.is_admin || realLoginId === 'admin' || profile?.position === '관리자' || profile?.position === '대표이사');
    const isLeader = Boolean(profile?.position === '팀장' || profile?.position === '실장' || isAdmin);

    // 부트스트랩 프로필 생성
    if (!profile && userId && realEmpNo) {
      try {
        await supabaseAdmin.from('db_profiles').upsert({
          id: userId,
          emp_no: realEmpNo,
          dept: realDept,
          rank: '',
          position: '',
          is_admin: isAdmin,
          must_change_password: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      } catch (e) {
        console.warn('verifySession bootstrap warning:', e.message);
      }
    }

    return {
      userId,
      empNo: realEmpNo,
      name: realName,
      loginId: realLoginId,
      email: userData.user.email,
      isAdmin,
      isLeader,
      position: profile?.position || '',
      team: realDept,
      dept: realDept,
      rank: profile?.rank || '',
      mustChangePassword: Boolean(profile?.must_change_password),
    };
  } catch (e) {
    console.error('verifySession error:', e);
    return null;
  }
}
