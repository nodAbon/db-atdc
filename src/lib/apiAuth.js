import { NextResponse } from 'next/server';
import { verifySession } from './auth';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

function jsonError(status, error, extraHeaders = {}) {
  return NextResponse.json(
    { success: false, error },
    { status, headers: { ...PRIVATE_HEADERS, ...extraHeaders } }
  );
}

function isSameOriginMutation(request) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;

  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function requireApiSession(request, {
  roles = ['authenticated'],
  mutation = false,
  allowPasswordChangeRequired = false,
} = {}) {
  if (mutation && !isSameOriginMutation(request)) {
    return { session: null, response: jsonError(403, '허용되지 않은 요청 출처입니다.') };
  }

  const session = await verifySession(request);
  if (!session) {
    return { session: null, response: jsonError(401, '로그인이 필요합니다.') };
  }

  if (session.mustChangePassword && !allowPasswordChangeRequired) {
    return { session, response: jsonError(428, '비밀번호를 먼저 변경해야 합니다.') };
  }

  const authorized = roles.includes('authenticated')
    || (roles.includes('admin') && session.isAdmin)
    || (roles.includes('leader') && session.isLeader);

  if (!authorized) {
    return { session, response: jsonError(403, '이 작업을 수행할 권한이 없습니다.') };
  }

  return { session, response: null };
}

export function privateJson(data, init = {}) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...PRIVATE_HEADERS, ...(init.headers || {}) },
  });
}

export function internalError(scope, error, message = '서버 처리 중 오류가 발생했습니다.') {
  console.error(scope, error);
  return jsonError(500, message);
}
