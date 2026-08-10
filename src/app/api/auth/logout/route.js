import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  const expireOptions = {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };

  response.cookies.set('sb-access-token', '', expireOptions);
  response.cookies.set('user-emp-no', '', expireOptions);
  response.cookies.set('user-name', '', expireOptions);

  return response;
}
