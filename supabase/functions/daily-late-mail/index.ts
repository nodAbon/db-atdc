const corsHeaders = { 'Content-Type': 'application/json' };
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const cronSecret = Deno.env.get('CRON_SECRET') || '';
const botId = Deno.env.get('NAVER_WORKS_BOT_ID') || '';
const recipientUserId = Deno.env.get('NAVER_WORKS_RECIPIENT_USER_ID') || '';

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function normalizeEmpNo(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.replace(/^1700/, '').replace(/^0+/, '') || digits;
}

function toMinutes(value: unknown) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 540;
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const result = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      ...(init.headers || {}),
    },
  });
  if (!result.ok) throw new Error(`supabase_${result.status}`);
  return result.status === 204 ? null : result.json();
}

async function hashRecipients(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sendNaverWorksBotMessage(text: string) {
  const accessToken = Deno.env.get('NAVER_WORKS_ACCESS_TOKEN') || '';
  if (!accessToken || !botId || !recipientUserId) throw new Error('naverworks_bot_credentials_missing');

  const result = await fetch(`https://www.worksapis.com/v1.0/bots/${encodeURIComponent(botId)}/users/${encodeURIComponent(recipientUserId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { type: 'text', text } }),
  });
  if (!result.ok) throw new Error(`naverworks_${result.status}`);
  return result.json().catch(() => ({}));
}

Deno.serve(async (request) => {
  if (request.method !== 'POST' && request.method !== 'GET') return response({ error: 'method_not_allowed' }, 405);
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) return response({ error: 'unauthorized' }, 401);
  if (!supabaseUrl || !supabaseServiceRoleKey || !botId || !recipientUserId) return response({ error: 'server_configuration_missing' }, 503);

  const workDate = kstDateKey();
  const recipientHash = await hashRecipients(recipientUserId);
  const jobKey = `daily-late-bot:${workDate}:${recipientHash}`;
  const claimed = await supabaseRequest('db_notification_deliveries?on_conflict=job_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation', 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_key: jobKey, job_type: 'daily-late-mail', work_date: workDate, recipient_hash: recipientHash }),
  });
  if (!Array.isArray(claimed) || claimed.length === 0) return response({ ok: true, skipped: 'already_claimed', workDate });

  try {
    const employees = await supabaseRequest('db_employees?company_code=eq.1700&is_active=eq.true&select=emp_no,name,dept');
    const schedules = await supabaseRequest('db_employee_schedules?select=emp_no,schedule_time');
    const logs = await supabaseRequest(`db_attendance?a_time=gte.${workDate.replace(/-/g, '')}000000&a_time=lte.${workDate.replace(/-/g, '')}235959&select=emp_no,a_time&order=a_time.asc`);
    const leaves = await supabaseRequest(`db_leaves?start_date=lte.${workDate.replace(/-/g, '')}&end_date=gte.${workDate.replace(/-/g, '')}&status=eq.40&select=emp_no,leave_days`);

    const scheduleMap = new Map((schedules || []).map((row: any) => [normalizeEmpNo(row.emp_no), toMinutes(row.schedule_time)]));
    const fullDayLeaveSet = new Set((leaves || [])
      .filter((row: any) => Number(row.leave_days || 0) >= 1)
      .map((row: any) => normalizeEmpNo(row.emp_no)));
    const firstLog = new Map<string, string>();
    for (const row of logs || []) {
      const empNo = normalizeEmpNo(row.emp_no);
      if (!firstLog.has(empNo)) firstLog.set(empNo, String(row.a_time || '').slice(8, 12));
    }
    const lateEmployees = (employees || []).flatMap((employee: any) => {
      const empNo = normalizeEmpNo(employee.emp_no);
      if (fullDayLeaveSet.has(empNo)) return [];
      const first = firstLog.get(empNo);
      if (!first) return [];
      const checkInMinutes = Number(first.slice(0, 2)) * 60 + Number(first.slice(2, 4));
      const scheduleMinutes = scheduleMap.get(empNo) ?? 540;
      return checkInMinutes > scheduleMinutes ? [{ name: employee.name, dept: employee.dept || '-', checkIn: `${first.slice(0, 2)}:${first.slice(2, 4)}`, schedule: `${String(Math.floor(scheduleMinutes / 60)).padStart(2, '0')}:${String(scheduleMinutes % 60).padStart(2, '0')}` }] : [];
    });

    const message = lateEmployees.length === 0
      ? `[드림베이 전일 근태 요약]\n기준일: ${workDate}\n지각자가 없습니다.`
      : [`[드림베이 전일 근태 요약]`, `기준일: ${workDate}`, `지각자: ${lateEmployees.length}명`, '', ...lateEmployees.map((employee, index) => `${index + 1}. ${employee.name} / ${employee.dept} / 출근 ${employee.checkIn} / 기준 ${employee.schedule}`)].join('\n');
    const botResult = await sendNaverWorksBotMessage(message);
    await supabaseRequest(`db_notification_deliveries?job_key=eq.${encodeURIComponent(jobKey)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent', late_count: lateEmployees.length, provider_message_id: botResult?.messageId ? String(botResult.messageId) : null, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });
    return response({ ok: true, workDate, lateCount: lateEmployees.length });
  } catch (error) {
    await supabaseRequest(`db_notification_deliveries?job_key=eq.${encodeURIComponent(jobKey)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'failed', error_code: String(error?.message || 'unknown').slice(0, 100), updated_at: new Date().toISOString() }) }).catch(() => null);
    return response({ error: 'notification_failed' }, 502);
  }
});
