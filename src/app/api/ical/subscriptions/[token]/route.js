import { NextResponse } from 'next/server';
import {
  deleteIcalSubscriptionRecord,
  setIcalSubscriptionRecordActive,
} from '@/lib/icalSubscriptions';
import { requireApiSession, privateJson, internalError } from '@/lib/apiAuth';

export async function PATCH(request, context) {
  try {
    const auth = await requireApiSession(request, { roles: ['authenticated'], mutation: true });
    if (auth.response) return auth.response;

    const params = await context?.params;
    const token = String(params?.token || '').trim();
    if (!token) {
      return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const active = typeof body?.active === 'boolean' ? body.active : true;

    await setIcalSubscriptionRecordActive(token, active);
    return privateJson({ success: true, active });
  } catch (error) {
    return internalError('[ICS Subscription Token PATCH]', error, '상태 변경에 실패했습니다.');
  }
}

export async function DELETE(request, context) {
  try {
    const auth = await requireApiSession(request, { roles: ['authenticated'], mutation: true });
    if (auth.response) return auth.response;

    const params = await context?.params;
    const token = String(params?.token || '').trim();
    if (!token) {
      return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 });
    }

    await deleteIcalSubscriptionRecord(token);
    return privateJson({ success: true });
  } catch (error) {
    return internalError('[ICS Subscription Token DELETE]', error, '삭제에 실패했습니다.');
  }
}
