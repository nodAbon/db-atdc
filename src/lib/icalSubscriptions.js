import { supabaseAdmin } from './supabaseAdmin';

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

  if (error) throw error;
  return data || [];
}

export async function getIcalSubscriptionRecordByToken(token) {
  if (!token) return null;
  const { data, error } = await supabaseAdmin
    .from('db_ical_subscriptions')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createIcalSubscriptionRecord({ token, label, depts, scope = 'leave-calendar' }) {
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

  if (error) throw error;
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
