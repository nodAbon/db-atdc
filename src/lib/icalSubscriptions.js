import { supabaseAdmin } from './supabaseAdmin';
import crypto from 'crypto';

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

  return null;
}

export async function createIcalSubscriptionRecord({ label, depts, scope = 'leave-calendar', createdBy = null }) {
  // Opaque 256-bit bearer token. The DB row is the source of truth so every
  // token can be revoked immediately.
  const token = crypto.randomBytes(32).toString('base64url');

  const { data, error } = await supabaseAdmin
    .from('db_ical_subscriptions')
    .insert({
      token,
      label,
      depts: Array.isArray(depts) ? depts : [],
      scope,
      is_active: true,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
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
