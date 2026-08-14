import { inferScheduleEndTime, normalizeEmpNoKey } from './dashboardUtils';
import { isNightTeamDept } from './nightScheduleRules';
import { getHolidayName } from './leaveRules';

export const normalizeScheduleTime = (value = '', fallback = '') => {
  const text = String(value || fallback || '').trim();
  if (!text) return fallback;
  return text.length >= 5 ? text.substring(0, 5) : fallback;
};

export const MONTHLY_SCHEDULE_NOTE = '__MONTHLY_SCHEDULE__';
export const MONTHLY_DEFAULT_NOTE = '__MONTHLY_DEFAULT__';
export const MONTHLY_SCHEDULE_RESTORE_NOTE = '__MONTHLY_SCHEDULE_RESTORE__';

export const isMonthlyScheduleNote = (note = '') => {
  const text = String(note || '').trim();
  return (
    text.includes(MONTHLY_SCHEDULE_NOTE)
    || text.includes(MONTHLY_DEFAULT_NOTE)
    || text.includes(MONTHLY_SCHEDULE_RESTORE_NOTE)
  );
};

const normalizeDeptKey = (value = '') => String(value || '').trim().replace(/\s+/g, '');

export const getKstDayIndex = (dateStr = '') => {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay();
};

export const isWeekendDate = (dateStr = '') => {
  const dayIndex = getKstDayIndex(dateStr);
  return dayIndex === 0 || dayIndex === 6;
};

export const buildEmployeeScheduleMap = (rows = []) => new Map(
  (rows || [])
    .map((row) => {
      const empNo = normalizeEmpNoKey(row?.emp_no || row?.empNo || '');
      if (!empNo) return null;
      const start = normalizeScheduleTime(row?.schedule_time || row?.scheduleTime || '09:00', '09:00');
      const end = normalizeScheduleTime(
        row?.schedule_end_time || row?.scheduleEndTime || '',
        ''
      );
      return [empNo, {
        start,
        end,
        reason: String(row?.schedule_reason || row?.scheduleReason || '').trim(),
        updatedAt: row?.updated_at || row?.updatedAt || null,
      }];
    })
    .filter(Boolean)
);

export const buildScheduleOverrideMap = (rows = []) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const empNo = normalizeEmpNoKey(row?.emp_no || row?.empNo || '');
    const workDate = String(row?.work_date || row?.workDate || '').trim();
    if (!empNo || !workDate) return;
    const note = String(row?.note || '').trim();
    const allowOvertime = row?.allow_overtime !== false && row?.allowOvertime !== false;
    map.set(`${empNo}_${workDate}`, {
      scheduleStart: normalizeScheduleTime(row?.schedule_start || row?.scheduleStart || '', ''),
      scheduleEnd: normalizeScheduleTime(row?.schedule_end || row?.scheduleEnd || '', ''),
      allowOvertime,
      note,
      removed: note === '__SCHEDULE_REMOVED__',
    });
  });
  return map;
};

export const buildTeamSchedulePatternMap = (rows = []) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const deptName = normalizeDeptKey(row?.dept_name || row?.deptName || '');
    const workDate = String(row?.work_date || row?.workDate || '').trim();
    if (!deptName || !workDate) return;
    map.set(`${deptName}_${workDate}`, {
      scheduleStart: normalizeScheduleTime(row?.schedule_start || row?.scheduleStart || '', ''),
      scheduleEnd: normalizeScheduleTime(row?.schedule_end || row?.scheduleEnd || '', ''),
      note: String(row?.note || '').trim(),
    });
  });
  return map;
};

export const resolveSchedulePairForDate = ({
  empNo = '',
  dept = '',
  dateStr = '',
  baseStart = '09:00',
  baseEnd = '',
  overrideLookup = new Map(),
  teamPatternLookup = new Map(),
} = {}) => {
  const empNoKey = normalizeEmpNoKey(empNo);
  const overrideKey = `${empNoKey}_${dateStr}`;
  const override = overrideLookup?.get?.(overrideKey);

  if (override) {
    if (override.removed) {
      return { start: '', end: '', isOverride: true, allowOvertime: false };
    }
    const start = override.scheduleStart || baseStart || '09:00';
    const end = override.scheduleEnd || inferScheduleEndTime(start, dept);
    return {
      start,
      end,
      isOverride: true,
      allowOvertime: override.allowOvertime !== false,
      note: override.note || '',
    };
  }

  const start = baseStart || '09:00';
  const end = baseEnd || inferScheduleEndTime(start, dept);
  return {
    start,
    end,
    isOverride: false,
    allowOvertime: true,
  };
};
