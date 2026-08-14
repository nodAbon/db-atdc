import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseAdmin';
import { AUTH_MODE_COOKIE, verifyAuthModeCookie } from './authMode';

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function getRequestCookie(request, name) {
  const cookieHeader = request?.headers?.get?.('cookie') || '';
  const headerToken = getCookieValue(cookieHeader, name);
  if (headerToken) return headerToken;

  try {
    const cookieStore = await cookies();
    return cookieStore.get(name)?.value || null;
  } catch {
    return null;
  }
}

export async function verifySession(request) {
  const accessToken = await getRequestCookie(request, 'sb-access-token');
  if (!accessToken) return null;

  try {
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    const authUser = userData?.user;
    if (authError || !authUser?.id) return null;

    // Authorization is derived only from the server-owned profile row. Never
    // trust employee numbers, roles, or login IDs from client cookies.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('db_profiles')
      .select('id,emp_no,dept,is_admin,is_global_admin,position,rank,must_change_password')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileError || !profile) return null;

    const authModeCookie = await getRequestCookie(request, AUTH_MODE_COOKIE);
    const authMode = verifyAuthModeCookie(authUser.id, authModeCookie);
    const isGlobalAdmin = profile.is_admin === true
      && profile.is_global_admin === true
      && authMode === 'master';
    const isAdmin = profile.is_admin === true
      && (profile.is_global_admin !== true || isGlobalAdmin);

    // A system administrator may be an Auth-only account that is intentionally
    // not part of the employee/attendance master. Non-admin users must always
    // remain linked to an active employee record.
    if (!profile.emp_no) {
      const email = authUser.email || '';
      if (!isGlobalAdmin) {
        const { data: employee, error: employeeError } = await supabaseAdmin
          .from('sa_employees')
          .select('emp_no,name,dept,email,login_id,is_active,company_code')
          .eq('email', email)
          .eq('is_active', true)
          .maybeSingle();

        if (employeeError || !employee) return null;
        return {
          userId: authUser.id,
          empNo: employee.emp_no,
          name: employee.name || authUser.user_metadata?.display_name || employee.login_id,
          loginId: employee.login_id || email.split('@')[0] || '',
          email,
          isAdmin: false,
          isGlobalAdmin: false,
          isLeader: false,
          position: '',
          team: employee.dept || '',
          dept: employee.dept || '',
          rank: '',
          companyCode: employee.company_code || '1600',
          mustChangePassword: profile.must_change_password === true,
        };
      }

      return {
        userId: authUser.id,
        empNo: null,
        name: authUser.user_metadata?.name
          || authUser.user_metadata?.display_name
          || email.split('@')[0]
          || '시스템 관리자',
        loginId: email.split('@')[0] || '',
        email,
        isAdmin: true,
        isGlobalAdmin: true,
        isLeader: true,
        position: profile.position || '시스템 관리자',
        team: profile.dept || '시스템 관리',
        dept: profile.dept || '시스템 관리',
        rank: profile.rank || '',
        mustChangePassword: profile.must_change_password === true,
      };
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('db_employees')
      .select('emp_no,name,dept,email,login_id,is_active')
      .eq('emp_no', profile.emp_no)
      .eq('is_active', true)
      .maybeSingle();

    if (employeeError || !employee) return null;

    const isLeader = isAdmin || profile.position === '팀장' || profile.position === '실장';

    return {
      userId: authUser.id,
      empNo: employee.emp_no,
      name: employee.name || authUser.user_metadata?.name || employee.login_id,
      loginId: employee.login_id || authUser.email?.split('@')[0] || '',
      email: authUser.email || employee.email || '',
      isAdmin,
      isGlobalAdmin,
      isLeader,
      position: profile.position || '',
      team: employee.dept || profile.dept || '',
      dept: employee.dept || profile.dept || '',
      rank: profile.rank || '',
      mustChangePassword: profile.must_change_password === true,
    };
  } catch (error) {
    console.error('verifySession error:', error);
    return null;
  }
}
