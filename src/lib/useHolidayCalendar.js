'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  applyHolidayYearCache,
  getHolidayCalendarVersion,
  hasHolidayYearCache,
  subscribeHolidayCalendar,
} from './holidayCalendar.js';

const pendingYearRequests = new Map();

const normalizeYear = (monthKey) => {
  const year = Number(String(monthKey || '').slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
};

async function fetchHolidayYear(year) {
  if (!year || hasHolidayYearCache(year)) return;
  if (pendingYearRequests.has(year)) return pendingYearRequests.get(year);

  const request = fetch(`/api/holidays/${year}`, { cache: 'no-store' })
    .then(async (response) => {
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || '공휴일 정보를 불러오지 못했습니다.');
      }
      applyHolidayYearCache(year, json.holidays || {});
    })
    .catch((error) => {
      console.warn('[useHolidayCalendar] holiday preload failed', error);
    })
    .finally(() => {
      pendingYearRequests.delete(year);
    });

  pendingYearRequests.set(year, request);
  return request;
}

export default function useHolidayCalendar(monthKey) {
  const year = useMemo(() => normalizeYear(monthKey), [monthKey]);

  useSyncExternalStore(
    subscribeHolidayCalendar,
    getHolidayCalendarVersion,
    getHolidayCalendarVersion
  );

  useEffect(() => {
    if (!year) return;
    fetchHolidayYear(year);
  }, [year]);
}
