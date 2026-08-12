const KST_TIME_ZONE = 'Asia/Seoul';

const toPartMap = (parts) =>
  parts.reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

const getDateParts = (date = new Date()) =>
  toPartMap(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: KST_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date)
  );

const getMonthParts = (date = new Date()) =>
  toPartMap(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: KST_TIME_ZONE,
      year: 'numeric',
      month: '2-digit'
    }).formatToParts(date)
  );

const getTimeParts = (date = new Date()) =>
  toPartMap(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: KST_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(date)
  );

export const getKstDateKey = (date = new Date()) => {
  const { year, month, day } = getDateParts(date);
  return `${year}-${month}-${day}`;
};

export const getKstMonthKey = (date = new Date()) => {
  const { year, month } = getMonthParts(date);
  return `${year}-${month}`;
};

export const getKstDateTimeKey = (date = new Date()) => {
  const { hour, minute, second } = getTimeParts(date);
  return `${getKstDateKey(date)} ${hour}:${minute}:${second}`;
};

export const shiftKstDateKey = (dateKey, days) => {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const base = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0)));
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(base.getUTCDate()).padStart(2, '0')}`;
};

export const shiftMonthKey = (monthKey, delta) => {
  const match = String(monthKey || '').trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return '';
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};
