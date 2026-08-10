export const toMinutes = (value = '') => {
  const match = String(value || '').trim().match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
};

export const normalizeTime = (value, fallback = '') => {
  const text = String(value ?? fallback).trim();
  if (!text) return fallback;
  return text.length >= 5 ? text.slice(0, 5) : fallback || text;
};

export const getAdjustmentMinutes = ({ scheduleEnd = '', actualOut = '' } = {}) => {
  const endMinutes = toMinutes(scheduleEnd);
  let outMinutes = toMinutes(actualOut);
  if (!Number.isFinite(endMinutes) || !Number.isFinite(outMinutes)) return 0;

  if (endMinutes >= 12 * 60 && outMinutes < 6 * 60) {
    outMinutes += 24 * 60;
  }

  if (outMinutes <= endMinutes) return 0;
  return outMinutes - endMinutes;
};

export const getScheduleDurationMinutes = (start = '', end = '') => {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return 0;
  let duration = endMinutes - startMinutes;
  if (duration < 0) duration += 24 * 60;
  return Math.max(0, duration);
};

const ADJUSTMENT_DEDUCTION_PATTERN = /\s*\[adjustment_deduction:([0-9]+(?:\.[0-9]+)?)\]\s*/i;

export const getAdjustmentDeductionHours = (note = '') => {
  const match = String(note || '').match(ADJUSTMENT_DEDUCTION_PATTERN);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 2) / 2;
};

export const getAdjustmentDeductionMinutes = (note = '') => getAdjustmentDeductionHours(note) * 60;

export const stripAdjustmentDeductionNote = (note = '') => (
  String(note || '').replace(ADJUSTMENT_DEDUCTION_PATTERN, '').trim()
);

export const composeAdjustmentDeductionNote = (note = '', deductionHours = 0) => {
  const cleanNote = stripAdjustmentDeductionNote(note);
  const value = Math.round((Number(deductionHours) || 0) * 2) / 2;
  if (value <= 0) return cleanNote;
  return `${cleanNote} [adjustment_deduction:${value.toFixed(1)}]`.trim();
};

export const formatWeekTotalLabel = (minutes = 0) => {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  if (!safeMinutes) return '0시간';
  const hours = safeMinutes / 60;
  return Number.isInteger(hours) ? `${hours}시간` : `${hours.toFixed(1)}시간`;
};

export const formatMonthDayLabel = (dateStr = '') => {
  const parts = String(dateStr || '').split('-').map(Number);
  if (parts.length !== 3 || !parts[1] || !parts[2]) return String(dateStr || '');
  return `${parts[1]}/${parts[2]}`;
};

export const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, '0');
  const minute = index % 2 === 0 ? '00' : '30';
  return `${hour}:${minute}`;
});
