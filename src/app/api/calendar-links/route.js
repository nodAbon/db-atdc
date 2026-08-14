import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireApiSession, privateJson, internalError } from '@/lib/apiAuth';

export async function GET(request) {
  try {
    const auth = await requireApiSession(request, { roles: ['admin', 'leader'] });
    if (auth.response) return auth.response;

    // 1. 구독 링크 목록
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('db_ical_subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (subError) throw subError;

    // 2. 전체 부서 목록
    const { data: employees } = await supabaseAdmin
      .from('db_employees')
      .select('dept')
      .eq('is_active', true);

    const depts = Array.from(new Set((employees || []).map((e) => e.dept).filter(Boolean)));

    return privateJson({
      subscriptions: subscriptions || [],
      depts,
    });
  } catch (error) {
    return internalError('calendar-links GET error:', error, '캘린더 링크를 불러오지 못했습니다.');
  }
}

export async function POST(request) {
  try {
    const auth = await requireApiSession(request, { roles: ['admin', 'leader'], mutation: true });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { label, depts } = body;

    if (!label) {
      return NextResponse.json({ error: '구독 캘린더 명칭을 입력해주세요.' }, { status: 400 });
    }

    const token = crypto.randomBytes(32).toString('base64url');

    const { data, error } = await supabaseAdmin
      .from('db_ical_subscriptions')
      .insert({
        token,
        label,
        depts: Array.isArray(depts) ? depts : [],
        is_active: true,
        created_by: auth.session.userId,
      })
      .select()
      .single();

    if (error) throw error;
    return privateJson({ success: true, subscription: data });
  } catch (error) {
    return internalError('calendar-links POST error:', error, '캘린더 링크를 생성하지 못했습니다.');
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireApiSession(request, { roles: ['admin', 'leader'], mutation: true });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { id, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('db_ical_subscriptions')
      .update({
        is_active: Boolean(is_active),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return privateJson({ success: true, subscription: data });
  } catch (error) {
    return internalError('calendar-links PATCH error:', error, '캘린더 링크 상태를 변경하지 못했습니다.');
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireApiSession(request, { roles: ['admin', 'leader'], mutation: true });
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('db_ical_subscriptions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return privateJson({ success: true });
  } catch (error) {
    return internalError('calendar-links DELETE error:', error, '캘린더 링크를 삭제하지 못했습니다.');
  }
}
