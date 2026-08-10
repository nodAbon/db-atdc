'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback, Suspense } from 'react';
import { ChevronDown, Copy, Link2, RefreshCw, Shield, Trash2, RotateCcw, Plus, Clock, Check } from 'lucide-react';
import AppSidebar from '../../components/AppSidebar';
import { formatClockTime } from '../../lib/clock';
import { usePersistentTheme } from '../../lib/usePersistentTheme';

const DEFAULT_DEPTS = ['경영지원실', '경영지원팀'];

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function DeptChip({ dept, checked, onChange }) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 36,
        padding: '7px 12px',
        borderRadius: 12,
        border: `1px solid ${checked ? 'var(--blue)' : 'var(--border)'}`,
        background: checked ? 'rgba(91, 136, 214, 0.12)' : 'var(--bg-overlay-sm)',
        color: 'var(--text-1)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        transition: 'all 0.12s',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 14, height: 14, margin: 0, accentColor: 'var(--blue)' }}
      />
      <span style={{ fontSize: 13, fontWeight: 700 }}>{dept}</span>
    </label>
  );
}

function SubscriptionCard({ item, onCopyUrl, onCopyWebcal, onToggleActive, onDelete }) {
  const [open, setOpen] = useState(false);
  const active = item.isActive;

  return (
    <div
      className="card"
      style={{
        padding: 16,
        borderRadius: 14,
        borderColor: active ? 'var(--border)' : 'rgba(148, 163, 184, 0.32)',
        background: active ? 'var(--bg-card)' : 'rgba(148, 163, 184, 0.05)',
        opacity: active ? 1 : 0.85,
        display: 'grid',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0, display: 'grid', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{item.label}</div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 999,
                background: active ? 'rgba(91, 136, 214, 0.12)' : 'rgba(148, 163, 184, 0.14)',
                color: active ? 'var(--blue)' : 'var(--text-2)',
              }}
            >
              {active ? '활성' : '비활성'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            생성 {formatDateTime(item.createdAt)}
            {item.revokedAt ? ` · 변경 ${formatDateTime(item.revokedAt)}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onCopyUrl} style={{ padding: '6px 12px', fontSize: 12 }}>
            <Copy size={13} /> <span>URL 복사</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCopyWebcal} style={{ padding: '6px 12px', fontSize: 12 }}>
            <Link2 size={13} /> <span>webcal</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onToggleActive(active)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              color: active ? 'var(--red)' : 'var(--green)',
            }}
          >
            <RotateCcw size={13} />
            <span>{active ? '비활성화' : '활성화'}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onDelete}
            style={{ padding: '6px 10px', fontSize: 12, color: 'var(--red)' }}
            title="구독 삭제"
          >
            <Trash2 size={13} />
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setOpen((v) => !v)} style={{ padding: '6px 10px', fontSize: 12 }}>
            <ChevronDown
              size={14}
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s ease' }}
            />
            <span>{open ? '접기' : '상세'}</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(item.depts || []).map((dept) => (
          <span
            key={`${item.id}-${dept}`}
            style={{
              fontSize: 11.5,
              padding: '4px 9px',
              borderRadius: 999,
              background: 'var(--bg-overlay-sm)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
              fontWeight: 600,
            }}
          >
            {dept}
          </span>
        ))}
      </div>

      {open && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 10,
            padding: 12,
            borderRadius: 12,
            background: 'var(--bg-overlay-sm)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-2)' }}>HTTPS URL</div>
            <code style={{ wordBreak: 'break-all', color: 'var(--text-1)', fontSize: 12, fontFamily: 'var(--mono)', background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
              {item.url}
            </code>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-2)' }}>Webcal URL (캘린더 앱 직접 등록용)</div>
            <code style={{ wordBreak: 'break-all', color: 'var(--text-1)', fontSize: 12, fontFamily: 'var(--mono)', background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
              {item.webcalUrl}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarLinksContent() {
  const [theme, setTheme] = usePersistentTheme('light');
  const [time, setTime] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedDepts, setSelectedDepts] = useState(DEFAULT_DEPTS);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true);
  const [creating, setCreating] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const copyNoticeTimer = useRef(null);

  useEffect(() => {
    const tick = () => setTime(formatClockTime(new Date()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const employeeDepartments = useMemo(() => {
    return Array.from(
      new Set(
        (employees || [])
          .map((employee) => String(employee.dept || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [employees]);

  const selectedCount = selectedDepts.length;
  const activeCount = subscriptions.filter((item) => item.isActive).length;

  const autoLabel = useMemo(() => {
    if (selectedDepts.length === 0) return '전사 캘린더 링크';
    if (selectedDepts.length === 1) return `${selectedDepts[0]} 캘린더 링크`;
    return `${selectedDepts[0]} 외 ${selectedDepts.length - 1}개 부서 캘린더 링크`;
  }, [selectedDepts]);

  // 직원/부서 목록 로드
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingEmployees(true);
        const res = await fetch('/api/attendance-records');
        const json = await res.json();
        if (!alive) return;
        setEmployees(json.employees || []);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoadingEmployees(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 구독 목록 로드
  const refreshSubscriptions = useCallback(async () => {
    try {
      setLoadingSubscriptions(true);
      const res = await fetch('/api/ical/subscriptions');
      const json = await res.json();
      if (json.success) {
        setSubscriptions(json.subscriptions || []);
      }
    } catch (err) {
      setError(err.message || '구독 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingSubscriptions(false);
    }
  }, []);

  useEffect(() => {
    refreshSubscriptions();
  }, [refreshSubscriptions]);

  useEffect(() => {
    if (employeeDepartments.length === 0) return;
    setSelectedDepts((current) => {
      if (current.length > 0) {
        const next = current.filter((dept) => employeeDepartments.includes(dept));
        return next.length > 0 ? next : employeeDepartments;
      }
      return employeeDepartments;
    });
  }, [employeeDepartments]);

  const toggleDept = (dept, checked) => {
    setSelectedDepts((current) => {
      if (checked) return current.includes(dept) ? current : [...current, dept];
      return current.filter((item) => item !== dept);
    });
  };

  const selectAllDepts = () => {
    if (selectedDepts.length === employeeDepartments.length) {
      setSelectedDepts([]);
    } else {
      setSelectedDepts([...employeeDepartments]);
    }
  };

  const copyWithNotice = (text, label) => {
    navigator.clipboard?.writeText?.(text);
    setCopyNotice(`${label} 주소를 클립보드에 복사했습니다.`);
    if (copyNoticeTimer.current) window.clearTimeout(copyNoticeTimer.current);
    copyNoticeTimer.current = window.setTimeout(() => setCopyNotice(''), 2200);
  };

  const createSubscription = async () => {
    setCreating(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/ical/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depts: selectedDepts,
          label: autoLabel,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '구독 URL 생성에 실패했습니다.');

      setMessage('구독 링크를 생성하고 URL을 클립보드에 복사했습니다.');
      await refreshSubscriptions();
      if (json.url) {
        copyWithNotice(json.url, '생성된 iCal URL');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const setActive = async (token, active) => {
    try {
      const res = await fetch(`/api/ical/subscriptions/${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '상태 변경에 실패했습니다.');
      await refreshSubscriptions();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteSubscription = async (token, labelText) => {
    if (!window.confirm(`"${labelText}" 구독을 완전히 삭제할까요?`)) return;

    try {
      const res = await fetch(`/api/ical/subscriptions/${encodeURIComponent(token)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '삭제에 실패했습니다.');
      await refreshSubscriptions();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="ga-theme" data-theme={theme}>
      <AppSidebar activeTab="CALENDAR" theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
      <main className="main-content" style={{ flexGrow: 1, padding: '24px 32px', overflowY: 'auto' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              캘린더 링크생성
            </h1>
            <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-2)' }}>
              부서별 연차 일정을 구글/아웃룩/애플 캘린더에서 실시간으로 구독할 수 있는 표준 iCal (.ics) 링크를 생성합니다.
            </p>
          </div>
          <div className="db-indicator">
            <Clock size={16} style={{ color: 'var(--purple)' }} />
            <span>{time || '--:--:--'}</span>
          </div>
        </div>

        {/* Notices */}
        {copyNotice && (
          <div style={{ padding: '10px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, color: '#065F46', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} /> <span>{copyNotice}</span>
          </div>
        )}

        {/* Creation Box */}
        <div className="card">
          <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} style={{ color: 'var(--purple)' }} />
              <h3 className="card-title">부서별 캘린더 링크 생성</h3>
            </div>
            <button
              type="button"
              onClick={selectAllDepts}
              style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
            >
              {selectedDepts.length === employeeDepartments.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              구독 캘린더에 포함할 부서를 선택하세요 ({selectedCount}개 선택됨):
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {employeeDepartments.map((dept) => (
                <DeptChip
                  key={dept}
                  dept={dept}
                  checked={selectedDepts.includes(dept)}
                  onChange={(checked) => toggleDept(dept, checked)}
                />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                기본 생성 명칭: <span style={{ color: 'var(--purple)' }}>{autoLabel}</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={createSubscription}
                disabled={creating || selectedDepts.length === 0}
                style={{ padding: '10px 20px', fontSize: 13.5 }}
              >
                <Plus size={16} />
                <span>{creating ? '링크 생성 중...' : '새 구독 링크 발급'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Subscriptions List */}
        <div className="card">
          <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link2 size={18} style={{ color: 'var(--blue)' }} />
              <h3 className="card-title">발급된 캘린더 구독 목록 ({subscriptions.length}개)</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-green">활성 {activeCount}개</span>
              <button type="button" className="icon-btn" onClick={refreshSubscriptions} title="새로고침">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {loadingSubscriptions ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
                구독 목록을 불러오는 중...
              </div>
            ) : subscriptions.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                생성된 캘린더 구독 링크가 없습니다.
              </div>
            ) : (
              subscriptions.map((item) => (
                <SubscriptionCard
                  key={item.id || item.token}
                  item={item}
                  onCopyUrl={() => copyWithNotice(item.url, `${item.label} (HTTPS URL)`)}
                  onCopyWebcal={() => copyWithNotice(item.webcalUrl, `${item.label} (webcal)`)}
                  onToggleActive={(currentActive) => setActive(item.token, !currentActive)}
                  onDelete={() => deleteSubscription(item.token, item.label)}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CalendarLinksPage() {
  return (
    <Suspense fallback={<div className="loading-spinner">화면을 불러오는 중...</div>}>
      <CalendarLinksContent />
    </Suspense>
  );
}
