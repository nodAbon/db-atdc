import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET() {
  try {
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

    return NextResponse.json({
      subscriptions: subscriptions || [],
      depts,
    });
  } catch (error) {
    console.error('calendar-links GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { label, depts } = body;

    if (!label) {
      return NextResponse.json({ error: '구독 캘린더 명칭을 입력해주세요.' }, { status: 400 });
    }

    const token = crypto.randomBytes(16).toString('hex');

    const { data, error } = await supabaseAdmin
      .from('db_ical_subscriptions')
      .insert({
        token,
        label,
        depts: Array.isArray(depts) ? depts : [],
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, subscription: data });
  } catch (error) {
    console.error('calendar-links POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
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
    return NextResponse.json({ success: true, subscription: data });
  } catch (error) {
    console.error('calendar-links PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
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
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('calendar-links DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
