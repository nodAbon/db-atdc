const encoder = new TextEncoder();
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const botId = Deno.env.get('NAVER_WORKS_BOT_ID') || '';
const clientId = Deno.env.get('NAVER_WORKS_CLIENT_ID') || '';
const clientSecret = Deno.env.get('NAVER_WORKS_CLIENT_SECRET') || '';
const serviceAccount = Deno.env.get('NAVER_WORKS_SERVICE_ACCOUNT') || '';
const privateKeyPem = Deno.env.get('NAVER_WORKS_PRIVATE_KEY') || '';

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function hasPrivilegedRole(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  if (serviceRoleKey && authorization === `Bearer ${serviceRoleKey}`) return true;
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) return false;

  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return false;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded));
    return payload?.role === 'service_role' || payload?.role === 'postgres';
  } catch {
    return false;
  }
}

function base64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Url(bytes: Uint8Array) {
  return base64(bytes).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodePrivateKey(pem: string) {
  const normalized = pem.replace(/\\n/g, '\n');
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  if (!body) throw new Error('private_key_invalid');
  return Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = base64Url(encoder.encode(JSON.stringify({
    iss: clientId,
    sub: serviceAccount,
    iat: now,
    exp: now + 3600,
  })));
  const unsignedToken = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    decodePrivateKey(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsignedToken));
  const assertion = `${unsignedToken}.${base64Url(new Uint8Array(signature))}`;
  const tokenResult = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      client_id: clientId,
      client_secret: clientSecret,
      assertion,
      scope: 'bot.message',
    }),
  });
  if (!tokenResult.ok) throw new Error(`token_http_${tokenResult.status}`);
  const token = await tokenResult.json();
  if (!token?.access_token) throw new Error('token_missing');
  return String(token.access_token);
}

async function dbRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('apikey', serviceRoleKey);
  headers.set('Authorization', `Bearer ${serviceRoleKey}`);
  const result = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers,
  });
  if (!result.ok) throw new Error(`db_http_${result.status}`);
  return result.status === 204 ? null : result.json();
}

async function db(path: string) {
  return dbRequest(path);
}

async function createTestReasonRequests(userId: string, workDate: string) {
  const testEmployees = [
    { employeeName: '\uD14C\uC2A4\uD2B8 \uC9C1\uC6D0A', checkIn: '09:15:00' },
    { employeeName: '\uD14C\uC2A4\uD2B8 \uC9C1\uC6D0B', checkIn: '09:20:00' },
    { employeeName: '\uD14C\uC2A4\uD2B8 \uC9C1\uC6D0C', checkIn: '09:25:00' },
  ].map((employee, index) => ({
    ...employee,
    empNo: `TEST${index + 1}`,
    requestToken: crypto.randomUUID(),
  }));
  const result = await fetch(`${supabaseUrl}/rest/v1/db_late_reason_requests`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(testEmployees.map((employee) => ({
      request_token: employee.requestToken,
      work_date: workDate,
      emp_no: employee.empNo,
      employee_name: employee.employeeName,
      check_in: employee.checkIn,
      schedule_time: '09:00:00',
      leader_user_id: userId,
      alert_type: 'test',
    }))),
  });
  if (!result.ok) throw new Error(`reason_create_http_${result.status}`);
  return testEmployees;
}

function kstDateKey(dayOffset = 0) {
  const target = new Date(Date.now() + dayOffset * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(target);
}

function kstMinutesNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

function normalizeEmpNo(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.replace(/^1700/, '').replace(/^0+/, '') || digits;
}

function toMinutes(value: unknown) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 540;
}

function timeLabel(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function correctedTimeLabel(value: unknown) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function leaveLabel(leave: any) {
  const raw = String(leave?.leave_name || '').trim();
  if (raw && !/^\d+$/.test(raw)) return raw;
  const labels: Record<string, string> = {
    '12': '\uC5F0\uCC28',
    '13': '\uACF5\uAC00',
    '16': '4\uC2DC\uAC04 \uD734\uAC00[\uC624\uC804]',
    '17': '4\uC2DC\uAC04 \uD734\uAC00[\uC624\uD6C4]',
    '18': '\uACBD\uC870\uD734\uAC00',
    '51': '\uC5F0\uCC28',
    '61': '4\uC2DC\uAC04 \uD734\uAC00[\uC624\uC804]',
    '62': '4\uC2DC\uAC04 \uD734\uAC00[\uC624\uD6C4]',
  };
  const code = String(leave?.leave_code || '');
  if (labels[code]) return labels[code];
  if (Number(leave?.leave_days || 0) >= 1) return '\uC5F0\uCC28';
  return '\uD734\uAC00';
}

function lateLimitFor(scheduleMinutes: number, employeeLeaves: any[]) {
  let limit = scheduleMinutes;
  const morningRangeEnds: Record<string, number> = {
    '19': 9 * 60,
    '20': 10 * 60,
    '21': 11 * 60,
    '22': 12 * 60,
    '23': 13 * 60,
  };

  for (const leave of employeeLeaves) {
    const code = String(leave?.leave_code || '');
    if (code === '16' || code === '61') {
      limit = Math.max(limit, scheduleMinutes < 10 * 60 ? 14 * 60 : scheduleMinutes + 4 * 60);
    } else if (morningRangeEnds[code]) {
      limit = Math.max(limit, morningRangeEnds[code]);
    }
  }
  return limit;
}

async function sendMessage(userId: string, text: string) {
  const accessToken = await getAccessToken();
  const result = await fetch(
    `https://www.worksapis.com/v1.0/bots/${encodeURIComponent(botId)}/users/${encodeURIComponent(userId)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: { type: 'text', text } }),
    },
  );
  if (!result.ok) throw new Error(`message_http_${result.status}`);
}

async function sendReasonTestMessage(userId: string, testEmployees: any[]) {
  const accessToken = await getAccessToken();
  const result = await fetch(
    `https://www.worksapis.com/v1.0/bots/${encodeURIComponent(botId)}/users/${encodeURIComponent(userId)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          type: 'button_template',
          contentText: [
            '[\uD14C\uC2A4\uD2B8 \uC9C0\uAC01\uC790 3\uBA85 \uBC1C\uC0DD]',
            '',
            ...testEmployees.map((employee, index) =>
              `${index + 1}. ${employee.employeeName} / \uCD9C\uADFC ${employee.checkIn.slice(0, 5)} / \uAE30\uC900 09:00`),
          ].join('\n'),
          actions: testEmployees.map((employee) => ({
            type: 'message',
            label: `${employee.employeeName} \uC0AC\uC720`,
            postback: `late_reason:${employee.requestToken}`,
          })),
        },
      }),
    },
  );
  if (!result.ok) throw new Error(`message_http_${result.status}`);
}

async function sendArrivalMessage(userId: string, employees: any[]) {
  const accessToken = await getAccessToken();
  const result = await fetch(
    `https://www.worksapis.com/v1.0/bots/${encodeURIComponent(botId)}/users/${encodeURIComponent(userId)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          type: 'button_template',
          contentText: [
            '[\uADFC\uD0DC \uD655\uC778 \uD544\uC694]',
            '',
            ...employees.map((employee, index) => employee.alertType === 'missing'
              ? `${index + 1}. ${employee.name} / \uBBF8\uCD9C\uADFC / \uAE30\uC900 ${employee.schedule}`
              : `${index + 1}. ${employee.name} / \uC9C0\uAC01 / \uCD9C\uADFC ${employee.checkIn} / \uAE30\uC900 ${employee.schedule}`),
          ].join('\n'),
          actions: employees.map((employee) => ({
            type: 'message',
            label: `${employee.name} \uC0AC\uC720`,
            postback: `late_reason:${employee.requestToken}`,
          })),
        },
      }),
    },
  );
  if (!result.ok) throw new Error(`message_http_${result.status}`);
}

async function handleArrivalAlerts() {
  const workDate = kstDateKey();
  const compactDate = workDate.replace(/-/g, '');
  const nowMinutes = kstMinutesNow();
  const [employees, schedules, overrides, logs, leaves, recipients] = await Promise.all([
    db('db_employees?company_code=eq.1700&is_active=eq.true&select=emp_no,name,dept'),
    db('db_employee_schedules?select=emp_no,schedule_time'),
    db(`db_schedule_overrides?work_date=eq.${workDate}&select=emp_no,schedule_start`),
    db(`db_attendance?a_time=gte.${compactDate}000000&a_time=lte.${compactDate}235959&select=emp_no,a_time&order=a_time.asc`),
    db(`db_leaves?start_date=lte.${compactDate}&end_date=gte.${compactDate}&status=eq.40&select=emp_no,leave_code,leave_name,leave_days`),
    db('db_team_bot_recipients?is_active=eq.true&select=dept,leader_user_id'),
  ]);

  if (!recipients.length) return response({ ok: true, skipped: 'no_team_recipients', workDate });

  const recipientMap = new Map(recipients.map((row: any) => [String(row.dept || '').trim(), String(row.leader_user_id || '')]));
  const scheduleMap = new Map(schedules.map((row: any) => [normalizeEmpNo(row.emp_no), toMinutes(row.schedule_time)]));
  for (const override of overrides) {
    if (override.schedule_start) scheduleMap.set(normalizeEmpNo(override.emp_no), toMinutes(override.schedule_start));
  }
  const leavesByEmployee = new Map<string, any[]>();
  for (const leave of leaves) {
    const empNo = normalizeEmpNo(leave.emp_no);
    leavesByEmployee.set(empNo, [...(leavesByEmployee.get(empNo) || []), leave]);
  }
  const firstLog = new Map<string, string>();
  for (const log of logs) {
    const empNo = normalizeEmpNo(log.emp_no);
    const time = String(log.a_time || '').slice(8, 12);
    if (time.length === 4 && !firstLog.has(empNo)) firstLog.set(empNo, time);
  }

  const candidates = employees.flatMap((employee: any) => {
    const empNo = normalizeEmpNo(employee.emp_no);
    const employeeLeaves = leavesByEmployee.get(empNo) || [];
    const hasFullDayLeave = employeeLeaves.some((leave: any) => Number(leave.leave_days || 0) >= 1);
    if (hasFullDayLeave) return [];
    const scheduleMinutes = scheduleMap.get(empNo) ?? 540;
    const lateLimit = lateLimitFor(scheduleMinutes, employeeLeaves);
    const missingAlertMinutes = lateLimit + 3;
    const first = firstLog.get(empNo) || '';
    if (!first) {
      if (nowMinutes < missingAlertMinutes) return [];
      return [{ empNo, name: String(employee.name || ''), dept: String(employee.dept || ''), alertType: 'missing', checkIn: null, schedule: timeLabel(lateLimit) }];
    }
    const checkInMinutes = Number(first.slice(0, 2)) * 60 + Number(first.slice(2, 4));
    if (checkInMinutes <= lateLimit) return [];
    return [{ empNo, name: String(employee.name || ''), dept: String(employee.dept || ''), alertType: 'late', checkIn: timeLabel(checkInMinutes), schedule: timeLabel(lateLimit) }];
  });

  const byLeader = new Map<string, any[]>();
  for (const candidate of candidates) {
    const leaderUserId = recipientMap.get(candidate.dept);
    if (!leaderUserId) continue;
    const existing = await db(
      `db_late_reason_requests?work_date=eq.${workDate}&emp_no=eq.${encodeURIComponent(candidate.empNo)}&leader_user_id=eq.${encodeURIComponent(leaderUserId)}&alert_type=in.(late,missing)&select=id&limit=1`,
    );
    if (existing.length) continue;
    byLeader.set(leaderUserId, [...(byLeader.get(leaderUserId) || []), candidate]);
  }

  let sentCount = 0;
  for (const [leaderUserId, leaderCandidates] of byLeader) {
    for (let index = 0; index < leaderCandidates.length; index += 10) {
      const chunk = leaderCandidates.slice(index, index + 10).map((employee: any) => ({
        ...employee,
        requestToken: crypto.randomUUID(),
      }));
      await dbRequest('db_late_reason_requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(chunk.map((employee: any) => ({
          request_token: employee.requestToken,
          work_date: workDate,
          emp_no: employee.empNo,
          employee_name: employee.name,
          check_in: employee.checkIn ? `${employee.checkIn}:00` : null,
          schedule_time: `${employee.schedule}:00`,
          leader_user_id: leaderUserId,
          alert_type: employee.alertType,
        }))),
      });
      await sendArrivalMessage(leaderUserId, chunk);
      sentCount += chunk.length;
    }
  }

  return response({ ok: true, workDate, candidateCount: candidates.length, sentCount });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  if (!serviceRoleKey || !hasPrivilegedRole(request)) {
    return response({ error: 'unauthorized' }, 401);
  }
  if (!supabaseUrl || !botId || !clientId || !clientSecret || !serviceAccount || !privateKeyPem) {
    return response({ error: 'server_configuration_missing' }, 503);
  }

  const input = await request.json().catch(() => ({}));
  const recipientUserId = typeof input?.recipientUserId === 'string' ? input.recipientUserId : '';

  try {
    if (input?.mode === 'arrival-alert') return await handleArrivalAlerts();
    if (!recipientUserId) return response({ error: 'recipient_required' }, 400);

    if (input?.testLateReason === true) {
      const workDate = kstDateKey();
      const testEmployees = await createTestReasonRequests(recipientUserId, workDate);
      await sendReasonTestMessage(recipientUserId, testEmployees);
      return response({ ok: true, workDate, testLateReason: true, testCount: testEmployees.length });
    }

    const workDate = kstDateKey(-1);
    const compactDate = workDate.replace(/-/g, '');
    const [employees, schedules, logs, leaves, corrections] = await Promise.all([
      db('db_employees?company_code=eq.1700&is_active=eq.true&select=emp_no,name,dept'),
      db('db_employee_schedules?select=emp_no,schedule_time'),
      db(`db_attendance?a_time=gte.${compactDate}000000&a_time=lte.${compactDate}235959&select=emp_no,a_time&order=a_time.asc`),
      db(`db_leaves?start_date=lte.${compactDate}&end_date=gte.${compactDate}&status=eq.40&select=emp_no,emp_name,leave_code,leave_name,leave_days`),
      db(`db_attendance_corrections?work_date=eq.${workDate}&select=emp_no,corrected_out_time`),
    ]);

    const scheduleMap = new Map(schedules.map((row: any) => [normalizeEmpNo(row.emp_no), toMinutes(row.schedule_time)]));
    const employeeMap = new Map(employees.map((row: any) => [normalizeEmpNo(row.emp_no), row]));
    const leavesByEmployee = new Map<string, any[]>();
    for (const leave of leaves) {
      const empNo = normalizeEmpNo(leave.emp_no);
      leavesByEmployee.set(empNo, [...(leavesByEmployee.get(empNo) || []), leave]);
    }
    const logsByEmployee = new Map<string, string[]>();
    for (const row of logs) {
      const empNo = normalizeEmpNo(row.emp_no);
      const time = String(row.a_time || '').slice(8, 12);
      if (time.length === 4) logsByEmployee.set(empNo, [...(logsByEmployee.get(empNo) || []), time]);
    }
    const correctionMap = new Map(corrections.map((row: any) => [
      normalizeEmpNo(row.emp_no),
      correctedTimeLabel(row.corrected_out_time).replace(':', ''),
    ]));

    const lateEmployees = employees.flatMap((employee: any) => {
      const empNo = normalizeEmpNo(employee.emp_no);
      const first = logsByEmployee.get(empNo)?.[0];
      if (!first || first.length < 4) return [];
      const checkInMinutes = Number(first.slice(0, 2)) * 60 + Number(first.slice(2, 4));
      const scheduleMinutes = scheduleMap.get(empNo) ?? 540;
      const lateLimit = lateLimitFor(scheduleMinutes, leavesByEmployee.get(empNo) || []);
      if (checkInMinutes <= lateLimit) return [];
      return [{
        name: String(employee.name || ''),
        dept: String(employee.dept || '-'),
        checkIn: timeLabel(checkInMinutes),
        schedule: timeLabel(lateLimit),
      }];
    }).sort((a: any, b: any) => a.checkIn.localeCompare(b.checkIn));

    const leaveEmployees = leaves
      .filter((leave: any) => employeeMap.has(normalizeEmpNo(leave.emp_no)))
      .map((leave: any) => {
        const employee = employeeMap.get(normalizeEmpNo(leave.emp_no));
        return {
          name: String(employee?.name || leave.emp_name || ''),
          dept: String(employee?.dept || '-'),
          leave: leaveLabel(leave),
        };
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ko'));

    const earlyLeaveEmployees = employees.flatMap((employee: any) => {
      if (String(employee.name || '').replace(/\s/g, '') === '\uAE40\uBBFC\uC8FCA') return [];
      const empNo = normalizeEmpNo(employee.emp_no);
      const employeeLogs = logsByEmployee.get(empNo) || [];
      const corrected = correctionMap.get(empNo);
      const last = corrected || (employeeLogs.length > 1 ? employeeLogs[employeeLogs.length - 1] : '');
      if (!last || last.length < 4) return [];
      const checkOutMinutes = Number(last.slice(0, 2)) * 60 + Number(last.slice(2, 4));
      if (checkOutMinutes >= 18 * 60) return [];
      return [{
        name: String(employee.name || ''),
        dept: String(employee.dept || '-'),
        checkOut: timeLabel(checkOutMinutes),
      }];
    }).sort((a: any, b: any) => a.checkOut.localeCompare(b.checkOut));

    const section = (title: string, rows: string[]) => [
      `${title} (${rows.length}\uBA85)`,
      ...(rows.length ? rows : ['- \uC5C6\uC74C']),
    ];
    const message = [
      '\u005b\uB4DC\uB9BC\uBCA0\uC774 \uC804\uC77C \uADFC\uD0DC \uC54C\uB9BC\u005d',
      `\uAE30\uC900\uC77C: ${workDate}`,
      '',
      ...section('\u25A0 \uC9C0\uAC01\uC790', lateEmployees.map((employee: any, index: number) =>
        `${index + 1}. ${employee.name} / \uCD9C\uADFC ${employee.checkIn} / \uAE30\uC900 ${employee.schedule}`)),
      '',
      ...section('\u25A0 \uD734\uAC00\uC790', leaveEmployees.map((employee: any, index: number) =>
        `${index + 1}. ${employee.name} / ${employee.leave}`)),
      '',
      ...section('\u25A0 18:00 \uC774\uC804 \uD1F4\uADFC\uC790', earlyLeaveEmployees.map((employee: any, index: number) =>
        `${index + 1}. ${employee.name} / \uD1F4\uADFC ${employee.checkOut}`)),
    ].join('\n');

    await sendMessage(recipientUserId, message);
    return response({
      ok: true,
      workDate,
      lateCount: lateEmployees.length,
      leaveCount: leaveEmployees.length,
      earlyLeaveCount: earlyLeaveEmployees.length,
    });
  } catch (error) {
    return response({ error: String(error?.message || 'send_failed').slice(0, 60) }, 502);
  }
});
