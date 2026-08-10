'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import AppSidebar from '../../components/AppSidebar';
import { usePersistentTheme } from '../../lib/usePersistentTheme';
import { formatClockTime } from '../../lib/clock';
import {
  Link2,
  Copy,
  Check,
  Plus,
  Trash2,
  Clock,
  Shield,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';

function DeptChip({ dept, checked, onChange }) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 36,
        padding: '7px 12px',
        borderRadius: 10,
        border: `1px solid ${checked ? 'var(--blue)' : 'var(--border)'}`,
        background: checked ? '#EFF6FF' : '#FFFFFF',
        color: checked ? 'var(--blue)' : 'var(--text-1)',
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

function CalendarLinksContent() {
  const [theme, setTheme] = usePersistentTheme('light');
  const [time, setTime] = useState('');
  const [subscriptions, setSubscriptions] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(false);

  // 신규 생성 폼 상태
  const [label, setLabel] = useState('');
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [copiedToken, setCopiedToken] = useState(null);

  useEffect(() => {
    const tick = () => setTime(formatClockTime(new Date()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/calendar-links');
      const data = await res.json();
      if (data.subscriptions) setSubscriptions(data.subscriptions);
      if (data.depts) {
        setDepts(data.depts);
        if (selectedDepts.length === 0 && data.depts.length > 0) {
          setSelectedDepts(data.depts); // 기본 전체 선택
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedDepts.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleDept = (dept) => {
    if (selectedDepts.includes(dept)) {
      setSelectedDepts(selectedDepts.filter((d) => d !== dept));
    } else {
      setSelectedDepts([...selectedDepts, dept]);
    }
  };

  const handleSelectAllDepts = () => {
    if (selectedDepts.length === depts.length) {
      setSelectedDepts([]);
    } else {
      setSelectedDepts([...depts]);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;

    try {
      const res = await fetch('/api/calendar-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          depts: selectedDepts,
        }),
      });
      if (res.ok) {
        setLabel('');
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleActive = async (sub) => {
    try {
      const res = await fetch('/api/calendar-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sub.id,
          is_active: !sub.is_active,
        }),
      });
      if (res.ok) {
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 캘린더 링크를 삭제하시겠습니까? (구독 중인 캘린더 피드가 중단됩니다)')) return;
    try {
      const res = await fetch(`/api/calendar-links?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getFeedUrl = (token) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/api/ical/${token}`;
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(key);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="ga-theme" data-theme={theme}>
      <AppSidebar activeTab="CALENDAR" theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
      <main className="main-content" style={{ flexGrow: 1, padding: '24px 32px', overflowY: 'auto' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              캘린더 링크 생성 및 관리
            </h1>
            <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-2)' }}>
              구글 캘린더, 아웃룩, 애플 캘린더 등에 실시간으로 동기화되는 iCal (.ics) 구독 링크를 발급합니다.
            </p>
          </div>
          <div className="db-indicator">
            <Clock size={16} style={{ color: 'var(--blue)' }} />
            <span>{time || '--:--:--'}</span>
          </div>
        </div>

        {/* Creation Form Card */}
        <div className="card">
          <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <h3 className="card-title">새 구독 캘린더 링크 만들기</h3>
          </div>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', marginBottom: 6 }}>
                캘린더 명칭
              </label>
              <input
                type="text"
                placeholder="예: 2026 전사 근태/연차 캘린더, 경영지원팀 전용 피드"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="form-input"
                style={{ width: '100%', maxWidth: 460 }}
                required
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, maxWidth: 600 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', margin: 0 }}>
                  포함할 부서 선택
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllDepts}
                  style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {selectedDepts.length === depts.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: 800 }}>
                {depts.map((d) => (
                  <DeptChip
                    key={d}
                    dept={d}
                    checked={selectedDepts.includes(d)}
                    onChange={() => handleToggleDept(d)}
                  />
                ))}
              </div>
            </div>

            <div style={{ paddingTop: 4 }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '10px 20px', fontSize: 13.5 }}
                disabled={!label.trim() || selectedDepts.length === 0}
              >
                <Plus size={16} />
                <span>구독 링크 발급</span>
              </button>
            </div>
          </form>
        </div>

        {/* Subscription List Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 className="card-title">생성된 캘린더 구독 링크 목록 ({subscriptions.length}개)</h3>
          </div>

          <div style={{ padding: 20, display: 'grid', gap: 14 }}>
            {subscriptions.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                생성된 캘린더 구독 링크가 없습니다. 위 양식에서 새로 발급해보세요.
              </div>
            ) : (
              subscriptions.map((sub) => {
                const feedUrl = getFeedUrl(sub.token);
                const webcalUrl = feedUrl.replace(/^https?:/, 'webcal:');
                const isUrlCopied = copiedToken === `${sub.id}-url`;
                const isWebcalCopied = copiedToken === `${sub.id}-webcal`;

                return (
                  <div
                    key={sub.id}
                    style={{
                      padding: '16px 18px',
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      background: sub.is_active ? '#FFFFFF' : '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 16,
                    }}
                  >
                    <div style={{ minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{sub.label}</span>
                        <span className={`badge ${sub.is_active ? 'badge-green' : 'badge-gray'}`}>
                          {sub.is_active ? '활성' : '비활성'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        대상 부서: {(sub.depts || []).join(', ') || '전체 부서'} · 생성일: {sub.created_at?.slice(0, 10)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => copyToClipboard(feedUrl, `${sub.id}-url`)}
                      >
                        {isUrlCopied ? <Check size={14} style={{ color: 'var(--green)' }} /> : <Copy size={14} />}
                        <span>{isUrlCopied ? '복사 완료' : 'iCal URL 복사'}</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => copyToClipboard(webcalUrl, `${sub.id}-webcal`)}
                      >
                        {isWebcalCopied ? <Check size={14} style={{ color: 'var(--green)' }} /> : <Link2 size={14} />}
                        <span>{isWebcalCopied ? '복사 완료' : 'Webcal 링크 복사'}</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => handleToggleActive(sub)}
                      >
                        <span>{sub.is_active ? '비활성화' : '활성화'}</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => handleDelete(sub.id)}
                        title="구독 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
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
