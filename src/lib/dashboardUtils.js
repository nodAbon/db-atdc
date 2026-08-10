import { getKstMonthKey } from './kstDate.js';
import { isNightTeamDept } from './nightScheduleRules.js';

export const COMPANY_CODE = '1700';

export const normalizeDeptName = (value) => String(value ?? '').trim();
export const normalizeDeptLoose = (value) => normalizeDeptName(value).replace(/\s+/g, '');

export const matchesDeptFilter = (itemDept, filterDept) => {
  if (!filterDept || filterDept === 'ALL') return true;
  return normalizeDeptLoose(itemDept) === normalizeDeptLoose(filterDept);
};

export const normalizeEmpNoKey = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith(COMPANY_CODE) && digits.length >= 12) {
    return digits.slice(COMPANY_CODE.length).slice(-8).replace(/^0+/, '') || digits.slice(-8);
  }
  return digits.slice(-8).replace(/^0+/, '') || digits.slice(-8);
};

export const clampToHalfHourSteps = (minutes = 0) => {
  const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
  return Math.floor(safeMinutes / 30) * 30;
};

export const formatHalfHourSteps = (minutes = 0) => {
  const halfHours = Math.floor(Math.max(0, Number(minutes) || 0) / 30) / 2;
  return Number.isInteger(halfHours) ? `${halfHours}.0` : `${halfHours}`;
};

export const inferScheduleEndTime = (start = '', dept = '') => {
  const normalizedStart = normalizeDeptName(start).substring(0, 5);
  const dayMap = {
    '08:00': '17:00',
    '09:00': '18:00',
    '10:00': '19:00',
    '18:00': '06:00',
    '20:00': '08:00',
  };

  if (isNightTeamDept(dept)) {
    if (normalizedStart === '18:00') return '06:00';
    if (normalizedStart === '20:00') return '08:00';
  }

  return dayMap[normalizedStart] || '18:00';
};

export const getCurrentMonthKey = (date = new Date()) => {
  return getKstMonthKey(date);
};

export const getMonthRangeList = (pastCount = 24, futureCount = 24, baseDate = new Date()) => {
  const list = [];
  const [yearStr, monthStr] = getCurrentMonthKey(baseDate).split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  for (let i = -pastCount; i <= futureCount; i++) {
    const d = new Date(Date.UTC(year, month - 1 + i, 1));
    list.push(getCurrentMonthKey(d));
  }
  return list;
};

/**
 * 20260810080054 -> "08:00:54" 또는 "08:00" 포맷팅
 */
export function formatTimeString(val, includeSeconds = true) {
  if (!val || val === '-') return '-';
  const str = String(val).trim();
  const digits = str.replace(/\D/g, '');

  if (digits.length >= 14) {
    // YYYYMMDDHHmmss
    const hh = digits.slice(8, 10);
    const mm = digits.slice(10, 12);
    const ss = digits.slice(12, 14);
    return includeSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
  }

  if (digits.length === 6) {
    const hh = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const ss = digits.slice(4, 6);
    return includeSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
  }

  if (digits.length === 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  }

  if (str.includes('T') || str.includes(' ')) {
    const timePart = str.includes('T') ? str.split('T')[1] : str.split(' ')[1];
    if (timePart) {
      const clean = timePart.split('+')[0].split('Z')[0].trim();
      return includeSeconds ? clean.slice(0, 8) : clean.slice(0, 5);
    }
  }

  if (/^\d{2}:\d{2}/.test(str)) {
    return includeSeconds ? (str.length >= 8 ? str.slice(0, 8) : `${str.slice(0, 5)}:00`) : str.slice(0, 5);
  }

  return str;
}
