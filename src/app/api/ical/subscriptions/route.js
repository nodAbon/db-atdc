import { NextResponse } from 'next/server';
import { normalizeIcalDeptList } from '@/lib/icalToken';
import {
  buildSubscriptionAccessUrls,
  createIcalSubscriptionRecord,
  listIcalSubscriptionRecords,
} from '@/lib/icalSubscriptions';

function getPublicBaseUrl(request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].some((h) => host.includes(h));

  // 실제 Vercel / 운영 도메인 접속 시에는 무조건 실제 접속된 도메인을 사용
  if (!isLocalHost) {
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (configured && !configured.includes('localhost')) {
    const normalized = configured.startsWith('http://') || configured.startsWith('https://')
      ? configured
      : `https://${configured}`;
    return normalized.replace(/\/$/, '');
  }

  return `http://${host}`.replace(/\/$/, '');
}

export async function GET(request) {
  try {
    const baseUrl = getPublicBaseUrl(request);
    const records = await listIcalSubscriptionRecords();
    const subscriptions = records.map((record) => {
      const { url, webcalUrl } = buildSubscriptionAccessUrls(baseUrl, record.token);
      return {
        id: record.id,
        token: record.token,
        label: record.label || '부서 연차 구독',
        depts: Array.isArray(record.depts) ? record.depts : [],
        scope: record.scope || 'leave-calendar',
        isActive: record.is_active !== false && !record.revoked_at,
        revokedAt: record.revoked_at || null,
        createdAt: record.created_at || null,
        updatedAt: record.updated_at || null,
        url,
        webcalUrl,
      };
    });

    return NextResponse.json({ success: true, subscriptions }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[ICS Subscriptions GET]', error);
    return NextResponse.json({ error: error?.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const depts = normalizeIcalDeptList(body.depts || []);
    const label = String(body.label || '').trim();

    if (depts.length === 0) {
      return NextResponse.json({ error: '하나 이상의 부서를 선택해야 합니다.' }, { status: 400 });
    }

    const defaultLabel = depts.length === 1
      ? `${depts[0]} 캘린더 링크`
      : `${depts[0]} 외 ${depts.length - 1}개 부서 캘린더 링크`;

    const record = await createIcalSubscriptionRecord({
      label: label || defaultLabel,
      depts,
      scope: 'leave-calendar',
    });

    const baseUrl = getPublicBaseUrl(request);
    const { url, webcalUrl } = buildSubscriptionAccessUrls(baseUrl, record.token);

    return NextResponse.json({
      success: true,
      subscription: {
        id: record.id,
        token: record.token,
        label: record.label,
        depts: record.depts,
        scope: record.scope,
        isActive: true,
        createdAt: record.created_at,
        url,
        webcalUrl,
      },
      url,
      webcalUrl,
    });
  } catch (error) {
    console.error('[ICS Subscriptions POST]', error);
    return NextResponse.json({ error: error?.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
