import Holidays from 'date-holidays';

const holidayYearCache = new Map();
const fallbackYearCache = new Map();
let holidayVersion = 0;
const listeners = new Set();

const formatDateKeyInKst = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const toDateKey = (value) => {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatDateKeyInKst(value);
  }

  const text = String(value).trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : formatDateKeyInKst(parsed);
};

const normalizeYearKey = (year) => String(Number(year) || '').trim();

const emitChange = () => {
  holidayVersion += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('[holidayCalendar] listener error', error);
    }
  });
};

const normalizeDateRange = (startValue, endValue) => {
  const startKey = toDateKey(startValue);
  const endKey = toDateKey(endValue);
  const start = startKey ? new Date(`${startKey}T00:00:00+09:00`) : new Date('invalid');
  const end = endKey ? new Date(`${endKey}T00:00:00+09:00`) : new Date('invalid');
  if (Number.isNaN(start.getTime())) return [];
  if (Number.isNaN(end.getTime()) || end <= start) return [startKey];

  const dates = [];
  const cursor = new Date(start);
  while (cursor < end) {
    dates.push(formatDateKeyInKst(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const buildFallbackYearCache = (year) => {
  const yearKey = normalizeYearKey(year);
  if (!yearKey) return {};
  if (fallbackYearCache.has(yearKey)) return fallbackYearCache.get(yearKey);

  const hd = new Holidays('KR');
  const map = {};
  const items = Array.isArray(hd.getHolidays(Number(yearKey))) ? hd.getHolidays(Number(yearKey)) : [];

  items.forEach((item) => {
    const name = String(item?.name || '').trim();
    if (!name) return;

    const startKey = toDateKey(item?.date || item?.start);
    const endKey = toDateKey(item?.end);

    if (!startKey) return;

    const dateKeys = normalizeDateRange(startKey, endKey);
    dateKeys.forEach((dateKey) => {
      if (!dateKey) return;
      map[dateKey] = name;
    });
  });

  fallbackYearCache.set(yearKey, map);
  return map;
};

export function subscribeHolidayCalendar(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getHolidayCalendarVersion() {
  return holidayVersion;
}

export function getHolidayYearCache(year) {
  return holidayYearCache.get(normalizeYearKey(year)) || {};
}

export function hasHolidayYearCache(year) {
  return holidayYearCache.has(normalizeYearKey(year));
}

export function applyHolidayYearCache(year, holidayMap = {}) {
  const yearKey = normalizeYearKey(year);
  if (!yearKey) return;

  const current = holidayYearCache.get(yearKey) || {};
  const next = { ...current };

  Object.entries(holidayMap || {}).forEach(([dateKey, holidayName]) => {
    const normalizedDateKey = toDateKey(dateKey);
    const name = String(holidayName || '').trim();
    if (!normalizedDateKey || !name) return;
    next[normalizedDateKey] = name;
  });

  holidayYearCache.set(yearKey, next);
  emitChange();
}

export function applyHolidayDateMap(dateMap = {}) {
  const grouped = new Map();
  Object.entries(dateMap || {}).forEach(([dateKey, holidayName]) => {
    const normalizedDateKey = toDateKey(dateKey);
    const name = String(holidayName || '').trim();
    if (!normalizedDateKey || !name) return;
    const yearKey = normalizedDateKey.slice(0, 4);
    if (!grouped.has(yearKey)) grouped.set(yearKey, {});
    grouped.get(yearKey)[normalizedDateKey] = name;
  });

  grouped.forEach((map, yearKey) => {
    const current = holidayYearCache.get(yearKey) || {};
    holidayYearCache.set(yearKey, { ...current, ...map });
  });

  if (grouped.size > 0) emitChange();
}

export function getHolidayNameByDate(dateStr) {
  const dateKey = toDateKey(dateStr);
  if (!dateKey) return null;
  const yearKey = dateKey.slice(0, 4);
  const yearCache = holidayYearCache.get(yearKey);
  return yearCache?.[dateKey] || buildFallbackYearCache(yearKey)?.[dateKey] || null;
}

export function getHolidayDateMapByYear(year) {
  return { ...getHolidayYearCache(year) };
}
