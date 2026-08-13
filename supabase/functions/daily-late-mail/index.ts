const corsHeaders = { 'Content-Type': 'application/json' };
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const cronSecret = Deno.env.get('CRON_SECRET') || '';
const clientId = Deno.env.get('NAVER_WORKS_CLIENT_ID') || '';
const clientSecret = Deno.env.get('NAVER_WORKS_CLIENT_SECRET') || '';
const refreshToken = Deno.env.get('NAVER_WORKS_REFRESH_TOKEN') || '';
const senderUserId = Deno.env.get('NAVER_WORKS_SENDER_USER_ID') || '';
const recipients = (Deno.env.get('DAILY_REPORT_RECIPIENTS') || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function previousKstDateKey() {
  const today = new Date(`${kstDateKey()}T00:00:00+09:00`);
  return kstDateKey(new Date(today.getTime() - 24 * 60 * 60 * 1000));
}

function normalizeEmpNo(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.replace(/^1700/, '').replace(/^0+/, '') || digits;
}

function toMinutes(value: unknown) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 540;
}

function compactTime(value: unknown) {
  const text = String(value || '').replace(/\D/g, '');
  return text.length >= 14 ? text.slice(8, 14) : text.slice(-6).padStart(6, '0');
}

function displayTime(value: unknown) {
  const time = compactTime(value);
  return time.length >= 4 ? `${time.slice(0, 2)}:${time.slice(2, 4)}` : '-';
}

function formatMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>\"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] || character));
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

async function getAccessToken() {
  const form = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const result = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const body = await result.json().catch(() => ({}));
  if (!result.ok || !body.access_token) throw new Error(`naverworks_token_${result.status}`);
  return String(body.access_token);
}

async function sendMail(subject: string, body: string) {
  const accessToken = await getAccessToken();
  const result = await fetch(`https://www.worksapis.com/v1.0/users/${encodeURIComponent(senderUserId)}/mail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: recipients.join(';'),
      subject,
      body,
      contentType: 'html',
      userName: '드림베이 근태관리시스템',
      isSaveSentMail: true,
      isSaveTracking: false,
    }),
  });
  if (!result.ok) throw new Error(`naverworks_mail_${result.status}`);
  return result.headers.get('x-message-id') || null;
}

function reportSection(title, count, color, headers, rows, emptyText = '해당 없음') {
  const body = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}" class="empty">${emptyText}</td></tr>`;
  return `<section class="section"><div class="section-title"><span class="dot" style="background:${color}"></span><span>${title}</span><strong>${count}명</strong></div><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></section>`;
}

function buildReport({ workDate, late, absent, early, leave, employees }) {
  const cards = [
    ['지각', late.length, '#f59e0b'],
    ['미출근', absent.length, '#ef4444'],
    ['조기퇴근', early.length, '#8b5cf6'],
    ['휴가', leave.length, '#10b981'],
  ].map(([label, count, color]) => `<div class="card"><div class="card-label"><span class="dot" style="background:${color}"></span>${label}</div><div class="card-value">${count}<small>명</small></div></div>`).join('');
  const sections = [
    reportSection('지각자', late.length, '#f59e0b', ['이름', '출근', '기준'], late.map((row) => [row.name, row.checkIn, row.schedule])),
    reportSection('미출근자', absent.length, '#ef4444', ['이름'], absent.map((row) => [row.name])),
    reportSection('조기퇴근자', early.length, '#8b5cf6', ['이름', '퇴근'], early.map((row) => [row.name, early.length ? row.checkOut : ''])),
    reportSection('휴가자', leave.length, '#10b981', ['이름', '휴가 구분'], leave.map((row) => [row.name, row.leaveName])),
  ].join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#f3f6fa;color:#172033;font-family:Arial,"Malgun Gothic",sans-serif;font-size:14px;line-height:1.5}
    .wrap{max-width:720px;margin:0 auto;background:#fff}.header{padding:28px 32px 24px;background:#143b63;color:#fff}.brand{font-size:13px;opacity:.78;margin-bottom:8px}.title{font-size:24px;font-weight:700;margin:0 0 6px}.date{font-size:13px;opacity:.8}.content{padding:24px 32px 32px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:26px}.card{border:1px solid #e6ebf1;border-radius:10px;padding:13px 12px;background:#fff}.card-label{font-size:12px;color:#667085;display:flex;align-items:center;gap:6px}.card-value{font-size:25px;font-weight:700;margin-top:5px}.card-value small{font-size:12px;font-weight:400;margin-left:2px;color:#667085}.dot{width:8px;height:8px;border-radius:50%;display:inline-block}.section{margin-top:22px}.section-title{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;margin-bottom:8px}.section-title strong{margin-left:auto;font-size:13px;color:#667085;font-weight:500}table{width:100%;border-collapse:collapse;border:1px solid #e6ebf1;border-radius:8px;overflow:hidden}th{background:#f8fafc;color:#667085;font-size:12px;font-weight:600;text-align:left;padding:9px 12px;border-bottom:1px solid #e6ebf1}td{padding:10px 12px;border-bottom:1px solid #eef1f5}tr:last-child td{border-bottom:0}.empty{text-align:center;color:#98a2b3;padding:15px}.footer{padding:16px 32px;border-top:1px solid #eef1f5;color:#98a2b3;font-size:11px;text-align:center}@media(max-width:560px){.content,.header,.footer{padding-left:18px;padding-right:18px}.summary{grid-template-columns:repeat(2,1fr)}}
  </style></head><body><div class="wrap"><header class="header"><div class="brand">DREAMBAY ATTENDANCE</div><h1 class="title">전일 근무일정</h1><div class="date">기준일 ${escapeHtml(workDate)} · 재직자 ${employees.length}명</div></header><main class="content"><div class="summary">${cards}</div>${sections}</main><footer class="footer">드림베이 근태관리시스템에서 자동 발송된 메일입니다.</footer></div></body></html>`;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST' && request.method !== 'GET') return response({ error: 'method_not_allowed' }, 405);
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) return response({ error: 'unauthorized' }, 401);
  if (!supabaseUrl || !supabaseServiceRoleKey || !clientId || !clientSecret || !refreshToken || !senderUserId || !recipients.length) {
    return response({ error: 'server_configuration_missing' }, 503);
  }

  const workDate = previousKstDateKey();
  const recipientHash = await hashRecipients(recipients.join(','));
  const jobKey = `daily-late-mail:${workDate}:${recipientHash}`;
  const claimed = await supabaseRequest('db_notification_deliveries?on_conflict=job_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation', 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_key: jobKey, job_type: 'daily-late-mail', work_date: workDate, recipient_hash: recipientHash }),
  });
  if (!Array.isArray(claimed) || claimed.length === 0) return response({ ok: true, skipped: 'already_claimed', workDate });

  try {
    const dateStart = workDate.replace(/-/g, '');
    const employees = await supabaseRequest('db_employees?company_code=eq.1700&is_active=eq.true&select=emp_no,name,dept');
    const schedules = await supabaseRequest('db_employee_schedules?select=emp_no,schedule_time');
    const logs = await supabaseRequest(`db_attendance?a_time=gte.${dateStart}000000&a_time=lte.${dateStart}235959&select=emp_no,a_time&order=a_time.asc`);
    const leaves = await supabaseRequest(`db_leaves?start_date=lte.${dateStart}&end_date=gte.${dateStart}&status=eq.40&select=emp_no,leave_name,leave_days`);

    const employeeMap = new Map((employees || []).map((row: any) => [normalizeEmpNo(row.emp_no), row]));
    const scheduleMap = new Map((schedules || []).map((row: any) => [normalizeEmpNo(row.emp_no), toMinutes(row.schedule_time)]));
    const leaveMap = new Map((leaves || []).map((row: any) => [normalizeEmpNo(row.emp_no), row]));
    const logMap = new Map<string, string[]>();
    for (const row of logs || []) {
      const empNo = normalizeEmpNo(row.emp_no);
      if (!logMap.has(empNo)) logMap.set(empNo, []);
      logMap.get(empNo)?.push(String(row.a_time || ''));
    }

    const late: any[] = [];
    const absent: any[] = [];
    const early: any[] = [];
    for (const employee of employees || []) {
      const empNo = normalizeEmpNo(employee.emp_no);
      const employeeLogs = logMap.get(empNo) || [];
      const leave = leaveMap.get(empNo);
      if (!employeeLogs.length) {
        if (!leave) absent.push(employee);
        continue;
      }
      const first = displayTime(employeeLogs[0]);
      const last = displayTime(employeeLogs[employeeLogs.length - 1]);
      const scheduleMinutes = scheduleMap.get(empNo) ?? 540;
      const firstMinutes = toMinutes(first);
      const lastMinutes = toMinutes(last);
      if (firstMinutes > scheduleMinutes && !(leave && Number(leave.leave_days || 0) >= 1)) {
        late.push({ name: employee.name, checkIn: first, schedule: formatMinutes(scheduleMinutes) });
      }
      if (lastMinutes < 18 * 60 && employeeLogs.length > 1) {
        early.push({ name: employee.name, checkOut: last });
      }
    }
    const leaveRows = [...leaveMap.entries()].map(([empNo, row]: [string, any]) => ({
      name: employeeMap.get(empNo)?.name || empNo,
      leaveName: row.leave_name || (Number(row.leave_days || 0) >= 1 ? '연차' : '반차/시간휴가'),
    }));
    const message = buildReport({ workDate, late, absent, early, leave: leaveRows, employees });
    const providerMessageId = await sendMail(`[드림베이 전일 근무일정] ${workDate}`, message);
    await supabaseRequest(`db_notification_deliveries?job_key=eq.${encodeURIComponent(jobKey)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent', late_count: late.length, provider_message_id: providerMessageId, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });
    return response({ ok: true, workDate, lateCount: late.length, absentCount: absent.length, earlyCount: early.length, leaveCount: leaveRows.length });
  } catch (error) {
    await supabaseRequest(`db_notification_deliveries?job_key=eq.${encodeURIComponent(jobKey)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed', error_code: String(error?.message || 'unknown').slice(0, 100), updated_at: new Date().toISOString() }),
    }).catch(() => null);
    return response({ error: 'notification_failed' }, 502);
  }
});
