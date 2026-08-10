import { isNightTeamDept } from './nightScheduleRules';
import { normalizeDeptName } from './dashboardUtils';
import { getLeaveDisplayLabel } from './leaveRules';

export const TWO_HOUR_LEAVE_CODES = new Set(['19', '20', '21', '22', '23', '24', '25', '26', '27', '28']);

export const toMinutes = (timeValue) => {
  const [hours = 0, minutes = 0] = String(timeValue || '00:00').substring(0, 5).split(':').map((v) => Number(v) || 0);
  return hours * 60 + minutes;
};

export const normalizeTime = (timeValue, fallback = '00:00') => {
  const value = String(timeValue || fallback).trim();
  if (!value) return fallback;
  return value.length >= 5 ? value.substring(0, 5) : fallback;
};

export const getShiftedLimit = (baseSchedule, hoursToAdd) => {
  const [schedH, schedM] = String(baseSchedule || '09:00').split(':').map(Number);
  const totalMinutes = schedH * 60 + schedM + hoursToAdd * 60;
  const endHour = Math.floor(totalMinutes / 60);
  const endMinute = totalMinutes % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:59`;
};

export const getMorningHalfDayLimit = (baseSchedule) => {
  const [schedH] = String(baseSchedule || '09:00').split(':').map(Number);
  if (schedH >= 10) return getShiftedLimit(baseSchedule, 4);
  return '14:00:59';
};

export const getTwoHourLeaveLimit = (baseSchedule) => {
  const schedule = String(baseSchedule || '09:00');
  return getShiftedLimit(schedule, 2);
};

export const getTwoHourLeaveEndTime = (leave) => {
  const rawName = getLeaveDisplayLabel(leave);
  const match = rawName.match(/\[(\d{2})(?::?(\d{2}))?[~-](\d{2})(?::?(\d{2}))?\]/);
  if (!match) return null;
  const endHour = match[3];
  const endMinute = match[4] || '00';
  return `${endHour}:${endMinute}:59`;
};

export const getTwoHourLeaveDisplayLabel = (leave) => {
  const rawName = getLeaveDisplayLabel(leave);
  const match = rawName.match(/\[(\d{2})(?::?(\d{2}))?[~-](\d{2})(?::?(\d{2}))?\]/);
  if (!match) return rawName || '휴가';
  const startHour = parseInt(match[1], 10);
  return startHour < 12 ? '오전반반차' : '오후반반차';
};

export const isAfternoonHalfLeave = (leave) => {
  const leaveCode = String(leave?.leaveCode || leave?.leave_code || '');
  const leaveName = getLeaveDisplayLabel(leave);
  return leaveCode === '17' || leaveCode === '62' || /오후/.test(leaveName);
};

export const getLateCheckinLimit = (leave, scheduleTime) => {
  const rawName = getLeaveDisplayLabel(leave);
  const leaveCode = String(leave?.leaveCode || leave?.leave_code || '');
  const rangeMatch = rawName.match(/\[(\d{2})(?::?(\d{2}))?[~-](\d{2})(?::?(\d{2}))?\]/);
  const rangeStartHour = rangeMatch ? parseInt(rangeMatch[1], 10) : null;
  const isMorningLike =
    /오전/.test(rawName) ||
    leaveCode === '16' ||
    leaveCode === '61' ||
    (rangeStartHour !== null && rangeStartHour < 12);

  if (!isMorningLike) return `${scheduleTime}:59`;
  if (/2시간/.test(rawName) || TWO_HOUR_LEAVE_CODES.has(leaveCode)) return getTwoHourLeaveLimit(scheduleTime);
  return getMorningHalfDayLimit(scheduleTime);
};

export const isOvernightSchedule = (schedule) =>
  !!schedule?.start && !!schedule?.end && toMinutes(schedule.end) <= toMinutes(schedule.start);
