'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppSidebar from '../../components/AppSidebar';
import { usePersistentTheme } from '../../lib/usePersistentTheme';
import { formatClockTime } from '../../lib/clock';
import {
  Link as LinkIcon,
  Plus,
  Copy,
  Check,
  Building2,
  Calendar,
  Sparkles,
  Info,
  Power,
} from 'lucide-react';

export default function CalendarLinksPage() {
  const [theme, setTheme] = usePersistentTheme('dark');
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
      if (data.depts) setDepts(data.depts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 부서 체크 토글
  const handleToggleDept = (dept) => {
    if (selectedDepts.includes(dept)) {
      setSelectedDepts(selectedDepts.filter((d) => d !== dept));
    } else {
      setSelectedDepts([...selectedDepts, dept]);
    }
  };

  // 생성 제출
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
        setSelectedDepts([]);
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 활성/비활성 토글
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

  // URL 복사
  const handleCopyLink = (token) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/api/ical/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  return (
    <div className="app-layout">
      <AppSidebar
        theme={theme}
        toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      <div className="main-content">
        <header className="top-header">
          <div className="header-left">
            <h1 className="page-title">캘린더 링크생성 (iCal 연동)</h1>
          </div>
          <div className="header-right">
            <span className="clock-badge">{time}</span>
          </div>
        </header>

        <div className="page-container">
          {/* 상단 신규 링크 생성 카드 */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Plus size={18} style={{ color: 'var(--blue)' }} />
                <span>새 근태 캘린더 구독 링크 발급</span>
              </div>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
                  캘린더 명칭
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', maxWidth: 450 }}
                  placeholder="예: 경영지원본부 연차 캘린더, 전사 휴가 현황"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 8 }}>
                  구독 대상 부서 (미선택 시 전사 전체 포함)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {depts.map((d) => {
                    const isChecked = selectedDepts.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`btn ${isChecked ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 12, padding: '4px 12px' }}
                        onClick={() => handleToggleDept(d)}
                      >
                        {isChecked && <Check size={12} />}
                        <span>{d}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <button type="submit" className="btn btn-primary">
                  <Sparkles size={14} />
                  <span>새 구독 URL 생성하기</span>
                </button>
              </div>
            </form>
          </div>

          {/* 발급된 캘린더 목록 */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <LinkIcon size={18} style={{ color: 'var(--blue)' }} />
                <span>발급된 캘린더 구독 목록</span>
                <span className="badge badge-blue">{subscriptions.length}개</span>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>캘린더 명칭</th>
                    <th>대상 부서</th>
                    <th>상태</th>
                    <th>생성일</th>
                    <th style={{ textAlign: 'center' }}>구독 URL 복사</th>
                    <th style={{ textAlign: 'center' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-3)' }}>
                        발급된 캘린더 구독 링크가 없습니다. 위에서 새로 생성해보세요.
                      </td>
                    </tr>
                  ) : (
                    subscriptions.map((sub) => {
                      const deptText = Array.isArray(sub.depts) && sub.depts.length > 0
                        ? sub.depts.join(', ')
                        : '전체 부서';
                      const isCopied = copiedToken === sub.token;

                      return (
                        <tr key={sub.id} style={{ opacity: sub.is_active ? 1 : 0.5 }}>
                          <td style={{ fontWeight: 600 }}>{sub.label}</td>
                          <td style={{ color: 'var(--text-2)' }}>
                            <span className="badge badge-blue">{deptText}</span>
                          </td>
                          <td>
                            <span className={`badge ${sub.is_active ? 'badge-green' : 'badge-red'}`}>
                              {sub.is_active ? '활성' : '비활성'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>
                            {new Date(sub.created_at).toLocaleDateString('ko-KR')}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={`btn ${isCopied ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ padding: '4px 12px', fontSize: 12 }}
                              onClick={() => handleCopyLink(sub.token)}
                              disabled={!sub.is_active}
                            >
                              {isCopied ? <Check size={13} /> : <Copy size={13} />}
                              <span>{isCopied ? '복사 완료!' : 'iCal URL 복사'}</span>
                            </button>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={`btn ${sub.is_active ? 'btn-danger' : 'btn-secondary'}`}
                              style={{ padding: '4px 10px', fontSize: 11 }}
                              onClick={() => handleToggleActive(sub)}
                            >
                              <Power size={12} />
                              <span>{sub.is_active ? '비활성화' : '활성화'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 연동 안내 가이드 카드 */}
          <div className="card" style={{ background: 'var(--bg-card-2)' }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div className="card-title" style={{ fontSize: 14 }}>
                <Info size={16} style={{ color: 'var(--blue)' }} />
                <span>캘린더 구독 URL 사용 방법 (Google / Outlook / Naver Works / Apple)</span>
              </div>
            </div>

            <ul style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8, paddingLeft: 20 }}>
              <li><strong>Google Calendar:</strong> 다른 캘린더 [+] 버튼 → <code>URL로 추가</code> 클릭 → 복사한 URL 붙여넣기</li>
              <li><strong>Outlook / 네이버웍스:</strong> 캘린더 추가 → <code>웹에서 구독 (iCal)</code> 클릭 → 복사한 URL 입력</li>
              <li><strong>Apple Calendar (iOS/Mac):</strong> 파일 → <code>새로운 캘린더 구독</code> → URL 붙여넣기</li>
              <li>직원들의 최신 연차/휴가 내역이 캘린더 앱에 자동으로 실시간 동기화됩니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
