import { requireApiSession, privateJson, internalError } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = await requireApiSession(request, { allowPasswordChangeRequired: true });
    if (auth.response) return auth.response;
    return privateJson({ success: true, user: auth.session });
  } catch (error) {
    return internalError('auth/me GET error:', error);
  }
}
