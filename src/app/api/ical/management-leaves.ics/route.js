import { NextResponse } from 'next/server';
import { buildLeaveIcsForDepartments } from '@/lib/icalFeed';
import { MANAGEMENT_DEPTS } from '@/lib/ical';
import { buildIcalHeaders } from '@/lib/icalHttp';
import { requireApiSession, internalError } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request) {
  try {
    const auth = await requireApiSession(request, { roles: ['admin', 'leader'] });
    if (auth.response) return auth.response;

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
    return internalError('[Management Leaves ICS GET]', error, '캘린더를 생성하지 못했습니다.');
  }
}
