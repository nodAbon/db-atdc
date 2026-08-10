import crypto from 'crypto';

export function createIcalSubscriptionToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function normalizeIcalDeptList(depts = []) {
  if (!Array.isArray(depts)) return [];
  return Array.from(
    new Set(
      depts
        .map((d) => String(d || '').trim())
        .filter(Boolean)
    )
  );
}
