import { NextResponse } from 'next/server';
import {
  deleteIcalSubscriptionRecord,
  setIcalSubscriptionRecordActive,
} from '@/lib/icalSubscriptions';

export async function PATCH(request, context) {
  try {
    const params = await context?.params;
    const token = String(params?.token || '').trim();
    if (!token) {
      return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const active = typeof body?.active === 'boolean' ? body.active : true;

    await setIcalSubscriptionRecordActive(token, active);
    return NextResponse.json({ success: true, active });
  } catch (error) {
    console.error('[ICS Subscription Token PATCH]', error);
    return NextResponse.json({ error: error?.message || '상태 변경에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(_request, context) {
  try {
    const params = await context?.params;
    const token = String(params?.token || '').trim();
    if (!token) {
      return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 });
    }

    await deleteIcalSubscriptionRecord(token);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ICS Subscription Token DELETE]', error);
    return NextResponse.json({ error: error?.message || '삭제에 실패했습니다.' }, { status: 500 });
  }
}
