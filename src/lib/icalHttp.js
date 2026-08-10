export function buildIcalHeaders(extraHeaders = {}) {
  return {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    ...extraHeaders,
  };
}
