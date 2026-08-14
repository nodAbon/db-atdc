import { NextResponse } from 'next/server';
import { normalizeIcalDeptList } from '@/lib/icalToken';
import {
  buildSubscriptionAccessUrls,
  createIcalSubscriptionRecord,
  listIcalSubscriptionRecords,
} from '@/lib/icalSubscriptions';
import { requireApiSession, privateJson, internalError } from '@/lib/apiAuth';

function getPublicBaseUrl(request) {
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

  const requestUrl = new URL(request.url);
  if (['localhost', '127.0.0.1', '::1'].includes(requestUrl.hostname)) return requestUrl.origin;
  return 'https://db-atdc.vercel.app';
}

export async function GET(request) {
  try {
    const auth = await requireApiSession(request, { roles: ['authenticated'] });
    if (auth.response) return auth.response;

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

    return privateJson({ success: true, subscriptions });
  } catch (error) {
    return internalError('[ICS Subscriptions GET]', error, '캘린더 구독 목록을 불러오지 못했습니다.');
  }
}

export async function POST(request) {
  try {
    const auth = await requireApiSession(request, { roles: ['authenticated'], mutation: true });
    if (auth.response) return auth.response;

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
      createdBy: auth.session.userId,
    });

    const baseUrl = getPublicBaseUrl(request);
    const { url, webcalUrl } = buildSubscriptionAccessUrls(baseUrl, record.token);

    return privateJson({
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
    return internalError('[ICS Subscriptions POST]', error, '캘린더 구독을 생성하지 못했습니다.');
  }
}
