import { NextResponse } from 'next/server';
import { buildLeaveIcsForDepartments } from '@/lib/icalFeed';
import { MANAGEMENT_DEPTS } from '@/lib/ical';
import { buildIcalHeaders } from '@/lib/icalHttp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const ics = await buildLeaveIcsForDepartments({
      departments: MANAGEMENT_DEPTS,
      calendarName: '경영지원실 연차 현황',
      calendarDescription: '경영지원실/경영지원팀 연차 현황 캘린더',
    });

    return new NextResponse(ics, {
      headers: buildIcalHeaders({
        'Content-Disposition': 'inline; filename="management-leaves.ics"',
      }),
    });
  } catch (error) {
    console.error('[Management Leaves ICS GET]', error);
    return NextResponse.json({ error: error?.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
