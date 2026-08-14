import { requireApiSession, privateJson, internalError } from '@/lib/apiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function isStrongPassword(password, session) {
  if (password.length < 8 || password.length > 128) return false;
  if ([session.empNo, session.loginId, '1234', 'password'].filter(Boolean).some((v) => password.toLowerCase().includes(String(v).toLowerCase()))) {
    return false;
  }
  const groups = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  return groups >= 3;
}

export async function POST(request) {
  try {
    const auth = await requireApiSession(request, {
      mutation: true,
      allowPasswordChangeRequired: true,
    });
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const newPassword = String(body.newPassword || '');
    if (!isStrongPassword(newPassword, auth.session)) {
      return privateJson({
        success: false,
        error: '비밀번호는 8자 이상이며 영문 대/소문자, 숫자, 특수문자 중 3종 이상을 포함해야 합니다.',
      }, { status: 400 });
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(auth.session.userId, {
      password: newPassword,
    });
    if (authError) throw authError;

    const { error: profileError } = await supabaseAdmin
      .from('db_profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', auth.session.userId);
    if (profileError) throw profileError;

    return privateJson({ success: true });
  } catch (error) {
    return internalError('change-password POST error:', error, '비밀번호를 변경하지 못했습니다.');
  }
}
