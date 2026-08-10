export const COMPANY_CODE = '1700';

export function getCurrentMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function normalizeDeptName(dept) {
  return String(dept || '').trim() || '소속 미지정';
}

export function normalizeEmpNoKey(empNo) {
  const digits = String(empNo ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith(COMPANY_CODE) && digits.length >= 12) {
    return digits.slice(COMPANY_CODE.length).slice(-8).replace(/^0+/, '') || digits.slice(-8);
  }
  return digits.slice(-8).replace(/^0+/, '') || digits.slice(-8);
}

export function matchesDeptFilter(itemDept, filterDept) {
  if (!filterDept || filterDept === 'ALL') return true;
  return normalizeDeptName(itemDept) === normalizeDeptName(filterDept);
}

export function formatTimeString(val) {
  if (!val) return '-';
  if (typeof val === 'string' && val.includes('T')) {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }
  }
  if (typeof val === 'string' && val.length === 6) {
    return `${val.slice(0, 2)}:${val.slice(2, 4)}:${val.slice(4, 6)}`;
  }
  return String(val);
}
