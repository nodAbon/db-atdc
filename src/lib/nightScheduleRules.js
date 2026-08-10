const normalizeDept = (value = '') => String(value || '').trim().replace(/\s+/g, '');
const normalizeTime = (value = '', fallback = '00:00') => {
  const text = String(value || fallback).trim();
  return text.length >= 5 ? text.substring(0, 5) : fallback;
};

export const inferNightScheduleEndTime = ({ dept = '', start = '', end = '' } = {}) => {
  const normalizedStart = normalizeTime(start, '');
  const normalizedEnd = normalizeTime(end, '');

  if (normalizedEnd) return normalizedEnd;
  if (!isNightTeamDept(dept)) return normalizedEnd;
  if (normalizedStart === '18:00') return '06:00';
  if (normalizedStart === '20:00') return '08:00';
  return normalizedEnd;
};

const NIGHT_TEAM_DEPTS = new Set([
  '서비스관리2팀',
].map(normalizeDept));

const SPECIAL_DAY_TEAM_DEPTS = new Set([
  '사업개발팀',
  '사업관리1팀',
  '사업관리2팀',
  '사업관리3팀',
].map(normalizeDept));

export const isNightTeamDept = (dept = '') => NIGHT_TEAM_DEPTS.has(normalizeDept(dept));
export const isSpecialDayTeamDept = (dept = '') => SPECIAL_DAY_TEAM_DEPTS.has(normalizeDept(dept));

export const formatScheduleDisplay = ({ dept = '', start = '', end = '' } = {}) => {
  const normalizedStart = normalizeTime(start, '');
  const normalizedEnd = inferNightScheduleEndTime({ dept, start, end });
  if (!normalizedStart && !normalizedEnd) return '';

  if (isNightTeamDept(dept)) {
    if (normalizedStart && normalizedEnd) {
      return `${normalizedStart} 출근 / ${normalizedEnd} 퇴근`;
    }
    return normalizedStart || normalizedEnd;
  }

  if (normalizedStart && normalizedEnd) {
    return `${normalizedStart} ~ ${normalizedEnd}`;
  }
  return normalizedStart || normalizedEnd;
};
