import { supabaseAdmin } from './supabaseAdmin';
import { createIcalSubscriptionToken, verifyIcalSubscriptionToken } from './icalToken';

export function buildSubscriptionAccessUrls(baseUrl, token) {
  const cleanBase = String(baseUrl || '').replace(/\/$/, '');
  const url = `${cleanBase}/api/ical/subscriptions.ics?token=${encodeURIComponent(token)}`;
  const webcalUrl = url.replace(/^https?:\/\//i, 'webcal://');
  return { url, webcalUrl };
}

export async function listIcalSubscriptionRecords() {
  const { data, error } = await supabaseAdmin
    .from('db_ical_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listIcalSubscriptionRecords error:', error);
    return [];
  }
  return data || [];
}

export async function getIcalSubscriptionRecordByToken(token) {
  if (!token) return null;

  // 1. DB에서 조회
  try {
    const { data } = await supabaseAdmin
      .from('db_ical_subscriptions')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (data) return data;
  } catch (e) {
    console.error('getIcalSubscriptionRecordByToken DB lookup error:', e);
  }

  // 2. 만약 DB에 아직 없는 자가 포함 서명 토큰인 경우 검증하여 반환
  const verified = verifyIcalSubscriptionToken(token);
  if (verified) {
    return {
      token,
      label: verified.label || '부서 연차 구독',
      depts: verified.depts || [],
      scope: verified.scope || 'leave-calendar',
      is_active: true,
      created_at: verified.createdAt || new Date().toISOString(),
    };
  }

  return null;
}

export async function createIcalSubscriptionRecord({ label, depts, scope = 'leave-calendar' }) {
  // HMAC-SHA256 Base64URL 서명 토큰 생성 (길고 안전한 표준 토큰)
  const token = createIcalSubscriptionToken({
    label,
    depts,
    scope,
  });

  const { data, error } = await supabaseAdmin
    .from('db_ical_subscriptions')
    .insert({
      token,
      label,
      depts: Array.isArray(depts) ? depts : [],
      scope,
      is_active: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('createIcalSubscriptionRecord DB insert error:', error);
    // DB 인서트에 실패해도 자가 포함 서명 토큰 객체 반환
    return {
      token,
      label,
      depts,
      scope,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  }

  return data;
}

export async function setIcalSubscriptionRecordActive(token, isActive) {
  const { data, error } = await supabaseAdmin
    .from('db_ical_subscriptions')
    .update({
      is_active: Boolean(isActive),
      revoked_at: isActive ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('token', token)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteIcalSubscriptionRecord(token) {
  const { error } = await supabaseAdmin
    .from('db_ical_subscriptions')
    .delete()
    .eq('token', token);

  if (error) throw error;
  return true;
}
