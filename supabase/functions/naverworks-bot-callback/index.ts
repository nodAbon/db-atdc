const encoder = new TextEncoder();
const botId = Deno.env.get('NAVER_WORKS_BOT_ID') || '';
const botSecret = Deno.env.get('NAVER_WORKS_BOT_SECRET') || '';
const clientId = Deno.env.get('NAVER_WORKS_CLIENT_ID') || '';
const clientSecret = Deno.env.get('NAVER_WORKS_CLIENT_SECRET') || '';
const serviceAccount = Deno.env.get('NAVER_WORKS_SERVICE_ACCOUNT') || '';
const privateKeyPem = Deno.env.get('NAVER_WORKS_PRIVATE_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
let cachedAccessToken = '';
let cachedAccessTokenExpiresAt = 0;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function createServiceAccountJwt() {
  if (!clientId || !clientSecret || !serviceAccount || !privateKeyPem) {
    throw new Error('service_credentials_missing');
  }
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
  return `${unsignedToken}.${base64Url(new Uint8Array(signature))}`;
}

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) return cachedAccessToken;
  const assertion = await createServiceAccountJwt();
  const form = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    client_id: clientId,
    client_secret: clientSecret,
    assertion,
    scope: 'bot.message',
  });
  const result = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: form,
  });
  if (!result.ok) throw new Error(`token_http_${result.status}`);
  const token = await result.json();
  if (!token?.access_token) throw new Error('token_missing');
  const expiresIn = Math.max(60, Number(token.expires_in || 3600));
  cachedAccessToken = String(token.access_token);
  cachedAccessTokenExpiresAt = Date.now() + Math.max(30, expiresIn - 120) * 1000;
  return cachedAccessToken;
}

async function signatureMatches(body: string, signature: string) {
  if (!botSecret || !signature) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(botSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expected = base64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body))));
  const expectedBytes = encoder.encode(expected);
  const actualBytes = encoder.encode(signature);
  if (expectedBytes.length !== actualBytes.length) return false;
  let difference = 0;
  for (let i = 0; i < expectedBytes.length; i += 1) difference |= expectedBytes[i] ^ actualBytes[i];
  return difference === 0;
}

async function recordReceipt(receipt: Record<string, unknown>) {
  if (!supabaseUrl || !serviceRoleKey) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/db_bot_callback_receipts`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(receipt),
    });
  } catch {
    console.error('naverworks_callback_receipt_write_failed');
  }
}

async function reasonDb(path: string, options: RequestInit = {}) {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('database_configuration_missing');
  const headers = new Headers(options.headers);
  headers.set('apikey', serviceRoleKey);
  headers.set('Authorization', `Bearer ${serviceRoleKey}`);
  headers.set('Content-Type', 'application/json');
  const result = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers,
  });
  if (!result.ok) throw new Error(`reason_db_http_${result.status}`);
  if (result.status === 204) return null;
  return result.json();
}

async function beginReasonInput(userId: string, token: string) {
  await reasonDb(
    `db_late_reason_requests?leader_user_id=eq.${encodeURIComponent(userId)}&status=eq.awaiting_reason`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'pending', updated_at: new Date().toISOString() }),
    },
  );
  const rows = await reasonDb(
    `db_late_reason_requests?request_token=eq.${encodeURIComponent(token)}&leader_user_id=eq.${encodeURIComponent(userId)}&status=eq.pending&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'awaiting_reason', updated_at: new Date().toISOString() }),
    },
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function findAwaitingReason(userId: string) {
  const rows = await reasonDb(
    `db_late_reason_requests?leader_user_id=eq.${encodeURIComponent(userId)}&status=eq.awaiting_reason&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,employee_name&order=updated_at.desc&limit=1`,
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function completeReasonInput(id: string, userId: string, reason: string) {
  await reasonDb(`db_late_reason_requests?id=eq.${encodeURIComponent(id)}&status=eq.awaiting_reason`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'completed',
      reason: reason.slice(0, 1000),
      responded_by: userId,
      updated_at: new Date().toISOString(),
    }),
  });
}

function buildReply(text: string) {
  const command = text.trim().toLowerCase();
  if (['\uD14C\uC2A4\uD2B8', 'test', 'ping'].includes(command)) {
    return '\uADFC\uD0DC\uAD00\uB9AC\uBD07 \uC5F0\uACB0\uC774 \uC815\uC0C1\uC785\uB2C8\uB2E4.';
  }
  if (['\uC548\uB155', '\uC548\uB155\uD558\uC138\uC694', '\uB3C4\uC6C0\uB9D0', 'help', '\uBA85\uB839\uC5B4'].includes(command)) {
    return '\uC548\uB155\uD558\uC138\uC694. \uADFC\uD0DC\uAD00\uB9AC\uBD07\uC785\uB2C8\uB2E4.\n\uD604\uC7AC \uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uBA85\uB839\uC5B4: \uD14C\uC2A4\uD2B8, \uB3C4\uC6C0\uB9D0';
  }
  return '\uC544\uC9C1 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uBA85\uB839\uC5B4\uC785\uB2C8\uB2E4. "\uB3C4\uC6C0\uB9D0"\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.';
}

async function sendReply(userId: string, text: string) {
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
  if (!result.ok) throw new Error(`reply_http_${result.status}`);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const body = await request.text();
  const signature = request.headers.get('x-works-signature') || '';
  const receivedBotId = request.headers.get('x-works-botid') || '';
  const botIdMatches = Boolean(receivedBotId && receivedBotId === botId);
  const signatureValid = botIdMatches && await signatureMatches(body, signature);

  console.info('naverworks_callback_received', {
    method: request.method,
    botIdPresent: Boolean(receivedBotId),
    botIdMatches,
    signaturePresent: Boolean(signature),
  });

  if (!botId || !botSecret || !botIdMatches || !signatureValid) {
    await recordReceipt({ bot_id_matches: botIdMatches, signature_valid: false });
    return json({ error: 'unauthorized' }, 401);
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    await recordReceipt({ bot_id_matches: true, signature_valid: true });
    return json({ error: 'invalid_json' }, 400);
  }


  await recordReceipt({
    bot_id_matches: true,
    signature_valid: true,
    event_type: typeof event?.type === 'string' ? event.type : null,
    content_type: typeof event?.content?.type === 'string' ? event.content.type : null,
  });

  // Do not log message text or user identifiers because they may contain personal data.
  if (event?.type === 'message' && event?.content?.type === 'text') {
    const userId = typeof event?.source?.userId === 'string' ? event.source.userId : '';
    if (userId) {
      try {
        const text = String(event.content.text || '').trim();
        const postback = String(event.content.postback || '');
        if (postback.startsWith('late_reason:')) {
          const requestRow = await beginReasonInput(userId, postback.slice('late_reason:'.length));
          await sendReply(userId, requestRow
            ? `${requestRow.employee_name}\uB2D8\uC758 \uC9C0\uAC01 \uC0AC\uC720\uB97C \uBA54\uC2DC\uC9C0\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.`
            : '\uC720\uD6A8\uD558\uC9C0 \uC54A\uAC70\uB098 \uB9CC\uB8CC\uB41C \uC694\uCCAD\uC785\uB2C8\uB2E4.');
        } else {
          const awaiting = await findAwaitingReason(userId);
          if (awaiting && text) {
            await completeReasonInput(String(awaiting.id), userId, text);
            await sendReply(userId, `${awaiting.employee_name}\uB2D8\uC758 \uC9C0\uAC01 \uC0AC\uC720\uAC00 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`);
          } else {
            await sendReply(userId, buildReply(text));
          }
        }
        await recordReceipt({
          bot_id_matches: true,
          signature_valid: true,
          event_type: 'reply',
          content_type: 'sent',
        });
      } catch (error) {
        const errorCode = String(error?.message || 'unknown').slice(0, 40);
        console.error('naverworks_reply_failed', {
          code: errorCode,
        });
        await recordReceipt({
          bot_id_matches: true,
          signature_valid: true,
          event_type: 'reply',
          content_type: errorCode,
        });
      }
    }
    return new Response(null, { status: 200 });
  }
  return new Response(null, { status: 200 });
});
