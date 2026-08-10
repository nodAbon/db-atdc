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

  // 1. 헤더에서 쿠키 파싱
  if (request?.headers) {
    const cookieHeader = request.headers.get?.('cookie') || '';
    accessToken = getCookieValueFromHeader(cookieHeader, 'sb-access-token');
    fallbackEmpNo = getCookieValueFromHeader(cookieHeader, 'user-emp-no') || '';
  }

  // 2. Next.js cookies() API 시도
  if (!accessToken) {
    try {
      const cookieStore = await cookies();
      accessToken = cookieStore.get('sb-access-token')?.value || null;
      if (!fallbackEmpNo) {
        fallbackEmpNo = cookieStore.get('user-emp-no')?.value || '';
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
    const loginId = userData.user.email?.split('@')[0] || '';

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

    const empNo = profile?.emp_no || fallbackEmpNo || loginId;

    // 직원 정보 조회 (db_employees)
    const { data: employee } = await supabaseAdmin
      .from('db_employees')
      .select('dept, name')
      .eq('emp_no', empNo)
      .maybeSingle();

    const isAdmin = Boolean(profile?.is_admin || profile?.position === '관리자' || profile?.position === '대표이사');
    const isLeader = Boolean(profile?.position === '팀장' || profile?.position === '실장' || isAdmin);

    return {
      userId,
      empNo,
      name: employee?.name || userData.user.user_metadata?.name || loginId,
      loginId,
      email: userData.user.email,
      isAdmin,
      isLeader,
      position: profile?.position || '',
      team: employee?.dept || '',
      dept: employee?.dept || '',
      rank: profile?.rank || '',
      mustChangePassword: Boolean(profile?.must_change_password),
    };
  } catch (e) {
    console.error('verifySession error:', e);
    return null;
  }
}
