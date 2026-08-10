'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { shiftMonthKey } from '../lib/kstDate';

export default function MonthSearchPicker({
  value,
  onChange,
  monthOptions = [],
  onPrev,
  onNext,
  label = '월 선택',
  placeholder = 'YYYY-MM 검색',
  className = '',
}) {
  const listId = useMemo(() => `month-options-${Math.random().toString(36).slice(2, 10)}`, []);
  const [query, setQuery] = useState(value || '');

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const commitValue = (nextValue) => {
    const normalized = String(nextValue || '').trim();
    if (!normalized) return;

    if (!monthOptions.length || monthOptions.includes(normalized)) {
      onChange?.(normalized);
      return;
    }

    const matched = monthOptions.find((month) => month.startsWith(normalized) || month.includes(normalized));
    if (matched) onChange?.(matched);
  };

  const moveMonth = (delta) => {
    const current = String(query || value || '').trim();
    const index = monthOptions.indexOf(current);

    if (index >= 0) {
      const nextIndex = Math.max(0, Math.min(monthOptions.length - 1, index + delta));
      const next = monthOptions[nextIndex];
      if (next && next !== current) {
        setQuery(next);
        onChange?.(next);
        return;
      }
    }

    const shifted = shiftMonthKey(current, delta);
    if (shifted) {
      setQuery(shifted);
      onChange?.(shifted);
      return;
    }

    if (delta < 0) onPrev?.();
    else onNext?.();
  };

  return (
    <div className={`month-search-picker ${className}`.trim()}>
      {label ? <span className="month-search-picker__label">{label}</span> : null}
      <button
        type="button"
        className="icon-btn month-search-picker__nav"
        onClick={() => moveMonth(-1)}
        title="이전 달"
        aria-label="이전 달"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="month-search-picker__field">
        <Search size={14} className="month-search-picker__icon" />
        <input
          type="search"
          value={query}
          list={listId}
          placeholder={placeholder}
          className="month-search-picker__input"
          onChange={(e) => {
            const nextValue = e.target.value;
            setQuery(nextValue);
            if (monthOptions.includes(nextValue)) {
              onChange?.(nextValue);
            }
          }}
          onBlur={() => commitValue(query)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitValue(query);
            }
          }}
        />
        <datalist id={listId}>
          {monthOptions.map((month) => (
            <option key={month} value={month} />
          ))}
        </datalist>
      </div>
      <button
        type="button"
        className="icon-btn month-search-picker__nav"
        onClick={() => moveMonth(1)}
        title="다음 달"
        aria-label="다음 달"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
