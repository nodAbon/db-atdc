const clientId = Deno.env.get('NAVER_WORKS_CLIENT_ID') || '';
const clientSecret = Deno.env.get('NAVER_WORKS_CLIENT_SECRET') || '';
const redirectUri = Deno.env.get('NAVER_WORKS_OAUTH_REDIRECT_URI') || '';
const oauthState = Deno.env.get('NAVER_WORKS_OAUTH_STATE') || '';

function html(body: string, status = 200) {
  return new Response(`<!doctype html><meta charset="utf-8"><title>NAVER WORKS OAuth</title><body style="font-family:system-ui;max-width:720px;margin:40px auto;line-height:1.6">${body}</body>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] || character));
}

Deno.serve(async (request) => {
  if (request.method !== 'GET') return html('<h1>Method Not Allowed</h1>', 405);
  if (!clientId || !clientSecret || !redirectUri || !oauthState) {
    return html('<h1>설정 오류</h1><p>OAuth 콜백 설정이 완료되지 않았습니다.</p>', 503);
  }

  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) return html(`<h1>인증 취소 또는 실패</h1><p>${escapeHtml(error)}</p>`, 400);

  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  if (!code || state !== oauthState) {
    return html('<h1>잘못된 인증 요청</h1><p>인가 코드 또는 state가 유효하지 않습니다.</p>', 400);
  }

  const form = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });
  const tokenResponse = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const tokenBody = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenBody.refresh_token) {
    console.error('naverworks_oauth_token_exchange_failed', tokenResponse.status, tokenBody.error || 'unknown');
    return html('<h1>토큰 발급 실패</h1><p>인증 코드를 교환하지 못했습니다. Edge Function 로그를 확인하세요.</p>', 502);
  }

  const refreshToken = String(tokenBody.refresh_token);
  const accessToken = String(tokenBody.access_token || '');
  const scope = String(tokenBody.scope || '');
  return html(`
    <h1>Refresh Token 발급 완료</h1>
    <p>아래 Refresh Token을 복사해 Supabase Secret의 <code>NAVER_WORKS_REFRESH_TOKEN</code>에 등록하세요.</p>
    <textarea readonly style="width:100%;min-height:150px;font-family:monospace">${escapeHtml(refreshToken)}</textarea>
    <p><strong>Scope:</strong> ${escapeHtml(scope || '응답 없음')}</p>
    <p><strong>Access Token:</strong> 발급됨 (화면에 표시하지 않음)</p>
    <p style="color:#a00">이 페이지를 닫고 브라우저 기록·스크린샷·공유 문서에 토큰을 남기지 마세요.</p>
  `);
});
