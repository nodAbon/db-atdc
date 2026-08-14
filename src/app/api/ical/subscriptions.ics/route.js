import { NextResponse } from 'next/server';
import { buildLeaveIcsForDepartments } from '@/lib/icalFeed';
import { getIcalSubscriptionRecordByToken } from '@/lib/icalSubscriptions';
import { buildIcalHeaders } from '@/lib/icalHttp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request) {
  try {
    const token = request.nextUrl.searchParams.get('token') || '';
    if (!token || token.length > 4096) {
      return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 });
    }

    const record = await getIcalSubscriptionRecordByToken(token);
    if (!record) {
      return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (record.is_active === false || record.revoked_at) {
      return NextResponse.json({ error: '비활성화된 구독 링크입니다.' }, { status: 410 });
    }

    const ics = await buildLeaveIcsForDepartments({
      departments: Array.isArray(record.depts) && record.depts.length > 0 ? record.depts : [],
      calendarName: record.label || 'HECTO 부서 연차 구독',
      calendarDescription: `${record.label || 'HECTO 부서 연차 구독'} - 실시간 캘린더 동기화`,
    });

    return new NextResponse(ics, {
      headers: buildIcalHeaders({
        'Content-Disposition': 'inline; filename="calendar-leaves.ics"',
      }),
    });
  } catch (error) {
    console.error('[ICS Subscriptions Query GET]', error);
    return NextResponse.json({ error: '캘린더를 생성하지 못했습니다.' }, { status: 500 });
  }
}
