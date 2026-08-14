import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  const expireOptions = {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    expires: new Date(0),
  };

  for (const name of [
    'sb-access-token',
    'db-auth-mode',
    'user-emp-no',
    'user-login-id',
    'user-name',
    'user-team',
    'user-position',
    'user-rank',
    'user-is-admin',
  ]) {
    response.cookies.set(name, '', expireOptions);
  }

  return response;
}
