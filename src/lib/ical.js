export const MANAGEMENT_DEPTS = ['경영지원실', '경영지원팀'];

export function normalizeDeptName(dept = '') {
  return String(dept || '').trim().replace(/\s+/g, '');
}

export function addDaysToDateStr(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().split('T')[0];
}

function formatDateToICS(dateStr) {
  return String(dateStr).replace(/-/g, '');
}

function escapeICSText(text = '') {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function buildICS({
  calendarName = 'HECTO 근태관리 캘린더',
  calendarDescription = '',
  events = [],
}) {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HECTO QNM//Attendance Calendar//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(calendarName)}`,
    calendarDescription ? `X-WR-CALDESC:${escapeICSText(calendarDescription)}` : null,
    'X-WR-TIMEZONE:Asia/Seoul',
  ].filter(Boolean);

  events.forEach((event) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${formatDateToICS(event.startDate)}`,
      `DTEND;VALUE=DATE:${formatDateToICS(event.endDate)}`,
      `SUMMARY:${escapeICSText(event.summary)}`,
      event.description ? `DESCRIPTION:${escapeICSText(event.description)}` : null,
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n') + '\r\n';
}
