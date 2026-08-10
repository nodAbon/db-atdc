'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import AppSidebar from '@/components/AppSidebar';
import { usePersistentTheme } from '@/lib/usePersistentTheme';
import {
  Clock,
  Search,
  RefreshCw,
  User,
  Users,
  CheckCircle2,
} from 'lucide-react';

function AttendanceRecordsContent() {
  const [theme, setTheme] = usePersistentTheme('light');
  const [time, setTime] = useState('');

  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmpNo, setSelectedEmpNo] = useState('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 기본 조회 기간: 최근 2개월 전부터 오늘까지
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [activeRange, setActiveRange] = useState('CUSTOM');

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // 실시간 시계
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const str = now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setTime(str);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 직원 목록 로드
  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const res = await fetch('/api/attendance-records?empListOnly=true');
      const data = await res.json();
      if (data.employees) {
        setEmployees(data.employees);
      }
    } catch (e) {
      console.error('직원 목록 로드 실패:', e);
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // 출입 기록 로드
  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      let url = `/api/attendance-records?from=${fromDate}&to=${toDate}`;
      if (selectedEmpNo && selectedEmpNo !== 'ALL') {
        url += `&empNo=${selectedEmpNo}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error('출입기록 로드 실패:', e);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [fromDate, toDate, selectedEmpNo]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // 기간 빠른 설정
  const setQuickRange = (type) => {
    setActiveRange(type);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (type === 'TODAY') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (type === 'MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(todayStr);
    } else if (type === '3MONTHS') {
      const d = new Date();
      d.setMonth(d.getMonth() - 2);
      setFromDate(d.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (type === 'YEAR') {
      const yearFirst = `${now.getFullYear()}-01-01`;
      setFromDate(yearFirst);
      setToDate(todayStr);
    }
  };

  // 검색 필터링된 직원 목록
  const filteredEmployees = useMemo(() => {
    if (!searchKeyword.trim()) return employees;
    const q = searchKeyword.trim().toLowerCase();
    return employees.filter(
      (e) =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.emp_no || '').toLowerCase().includes(q) ||
        (e.dept || '').toLowerCase().includes(q)
    );
  }, [employees, searchKeyword]);

  // 선택된 직원 정보
  const selectedEmployee = useMemo(() => {
    if (!selectedEmpNo || selectedEmpNo === 'ALL') return null;
    return employees.find((e) => e.emp_no === selectedEmpNo) || null;
  }, [employees, selectedEmpNo]);

  // 시간 및 날짜 포맷 헬퍼
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '-';
    const digits = String(dateStr).replace(/\D/g, '');
    if (digits.length >= 8) {
      const y = digits.slice(0, 4);
      const m = digits.slice(4, 6);
      const d = digits.slice(6, 8);
      const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${y}-${m}-${d}`).getDay()] || '';
      return `${y}.${m}.${d} (${dayOfWeek})`;
    }
    return dateStr;
  };

  const formatTimeStringOnly = (aTime) => {
    if (!aTime) return '-';
    const digits = String(aTime).replace(/\D/g, '');
    if (digits.length >= 14) {
      return `${digits.slice(8, 10)}:${digits.slice(10, 12)}:${digits.slice(12, 14)}`;
    }
    if (String(aTime).includes(' ')) {
      return String(aTime).split(' ')[1] || aTime;
    }
    return aTime;
  };

  // 당일 첫 기록 = 출근, 마지막 기록 = 퇴근, 중간 기록 = 출입 판정 로직
  const processedLogs = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    // 1. (직원사번 + 날짜) 별로 그룹핑
    const groups = new Map();

    logs.forEach((log) => {
      const empNo = log.emp_no || log.empNo || '';
      const aTime = String(log.a_time || log.logTime || '');
      const digits = aTime.replace(/\D/g, '');
      const dateKey = digits.length >= 8 ? digits.slice(0, 8) : 'unknown';

      const key = `${empNo}_${dateKey}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push({
        ...log,
        rawWorkDate: dateKey,
      });
    });

    const result = [];

    // 2. 각 그룹 내에서 시간순(오름차순) 정렬하여 첫 번째는 출근, 마지막은 퇴근 태깅
    groups.forEach((groupLogs) => {
      groupLogs.sort((a, b) => String(a.a_time).localeCompare(String(b.a_time)));

      const totalCount = groupLogs.length;

      groupLogs.forEach((log, idx) => {
        let tagType = '출입';
        let memo = '';
        let badgeClass = 'badge-access';

        if (totalCount === 1) {
          tagType = '출근';
          memo = '출근 (당일 1회 기록)';
          badgeClass = 'badge-checkin';
        } else if (idx === 0) {
          tagType = '출근';
          memo = '출근 (첫 기록)';
          badgeClass = 'badge-checkin';
        } else if (idx === totalCount - 1) {
          tagType = '퇴근';
          memo = '퇴근 (마지막 기록)';
          badgeClass = 'badge-checkout';
        } else {
          tagType = '출입';
          memo = `중간 출입 (${idx + 1}회차)`;
          badgeClass = 'badge-access';
        }

        result.push({
          ...log,
          timeOnly: formatTimeStringOnly(log.a_time || log.logTime),
          dateDisplay: formatDisplayDate(log.rawWorkDate),
          tagType,
          memo,
          badgeClass,
        });
      });
    });

    // 최신 시간순(내림차순) 정렬
    return result.sort((a, b) => String(b.a_time).localeCompare(String(a.a_time)));
  }, [logs]);

  return (
    <div className="ga-theme" data-theme={theme}>
      <AppSidebar
        activeTab="RECORDS"
        theme={theme}
        toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />
      <main className="main-content" style={{ flexGrow: 1, padding: '24px 32px', overflowY: 'auto' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>
              출입기록 조회
            </h1>
            <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-2)' }}>
              임직원의 캡스 출입 일시를 조회합니다. 당일 첫 기록은 출근, 마지막 기록은 퇴근으로 표시됩니다.
            </p>
          </div>
          <div className="db-indicator">
            <Clock size={16} style={{ color: 'var(--amber)' }} />
            <span>{time || '--:--:--'}</span>
          </div>
        </div>

        {/* Date Filter Controls */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>조회 기간:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setActiveRange('CUSTOM');
                }}
                className="form-input"
                style={{ width: 140, padding: '7px 10px', fontSize: 13 }}
              />
              <span style={{ color: 'var(--text-3)' }}>~</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setActiveRange('CUSTOM');
                }}
                className="form-input"
                style={{ width: 140, padding: '7px 10px', fontSize: 13 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { loadEmployees(); loadLogs(); }}
                style={{ padding: '7px 14px', fontSize: 13 }}
              >
                <RefreshCw size={14} />
                <span>조회</span>
              </button>

              {/* 퀵 필터 버튼 */}
              <div style={{ display: 'flex', gap: 6, marginLeft: 6 }}>
                <button
                  type="button"
                  className={`btn-filter${activeRange === 'TODAY' ? ' active' : ''}`}
                  onClick={() => setQuickRange('TODAY')}
                >
                  오늘
                </button>
                <button
                  type="button"
                  className={`btn-filter${activeRange === 'MONTH' ? ' active' : ''}`}
                  onClick={() => setQuickRange('MONTH')}
                >
                  이번달
                </button>
                <button
                  type="button"
                  className={`btn-filter${activeRange === '3MONTHS' ? ' active' : ''}`}
                  onClick={() => setQuickRange('3MONTHS')}
                >
                  최근 3개월
                </button>
                <button
                  type="button"
                  className={`btn-filter${activeRange === 'YEAR' ? ' active' : ''}`}
                  onClick={() => setQuickRange('YEAR')}
                >
                  올해 전체
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge-status badge-amber" style={{ fontSize: 12, padding: '5px 12px' }}>
                총 {processedLogs.length.toLocaleString()}건 출입 내역
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Master-Detail Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'flex-start' }}>
          {/* Left Employee Sidebar */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div className="search-wrap" style={{ maxWidth: '100%' }}>
                <Search className="search-icon" size={14} />
                <input
                  type="text"
                  placeholder="이름/사번/부서 검색"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="search-input"
                  style={{ fontSize: 12.5, padding: '7px 10px 7px 30px' }}
                />
              </div>
            </div>

            <div style={{ maxHeight: 680, overflowY: 'auto' }}>
              {/* 전체 직원 옵션 */}
              <button
                type="button"
                onClick={() => setSelectedEmpNo('ALL')}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: selectedEmpNo === 'ALL' ? 'var(--bg-overlay-md)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'var(--ease)',
                  borderLeft: selectedEmpNo === 'ALL' ? '3px solid var(--blue)' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Users size={16} style={{ color: selectedEmpNo === 'ALL' ? 'var(--blue)' : 'var(--text-3)' }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: selectedEmpNo === 'ALL' ? 'var(--blue)' : 'var(--text-1)' }}>
                      전체 직원 보기
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                      총 {employees.length}명
                    </div>
                  </div>
                </div>
                {selectedEmpNo === 'ALL' && <CheckCircle2 size={16} style={{ color: 'var(--blue)' }} />}
              </button>

              {loadingEmployees ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                  직원 목록 로딩 중...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                  검색 결과가 없습니다.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = selectedEmpNo === emp.emp_no;
                  return (
                    <button
                      key={emp.emp_no}
                      type="button"
                      onClick={() => setSelectedEmpNo(emp.emp_no)}
                      style={{
                        width: '100%',
                        padding: '11px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: isSelected ? 'var(--bg-overlay-md)' : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'var(--ease)',
                        borderLeft: isSelected ? '3px solid var(--blue)' : '3px solid transparent',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: isSelected ? 'var(--blue)' : 'var(--text-1)' }}>
                          {emp.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                          {emp.dept} · {emp.emp_no}
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 size={16} style={{ color: 'var(--blue)' }} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Clean Flat Table View */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title" style={{ fontSize: 16 }}>
                  {selectedEmployee
                    ? `${selectedEmployee.name} (${selectedEmployee.dept} · 사번 ${selectedEmployee.emp_no}) 출입 기록`
                    : `전체 직원 출입 기록 내역`}
                </h3>
                <p className="card-subtitle">
                  조회 기간: {fromDate} ~ {toDate} · 총 {processedLogs.length}건
                </p>
              </div>
            </div>

            {loadingLogs ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, flexDirection: 'column', gap: 12 }}>
                <RefreshCw size={28} style={{ color: 'var(--blue)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>출입기록을 불러오는 중...</span>
              </div>
            ) : processedLogs.length === 0 ? (
              <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
                해당 기간에 기록된 캡스 출입 기록이 없습니다. 상단에서 조회 기간을 변경해보세요.
              </div>
            ) : (
              <div style={{ maxHeight: 680, overflowY: 'auto', width: '100%' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px', textAlign: 'center' }}>No</th>
                      <th style={{ width: '160px' }}>출입 일자</th>
                      <th style={{ width: '120px' }}>출입 시각</th>
                      {selectedEmpNo === 'ALL' && (
                        <>
                          <th style={{ width: '150px' }}>이름 (사번)</th>
                          <th style={{ width: '140px' }}>부서</th>
                        </>
                      )}
                      <th style={{ width: '110px' }}>구분</th>
                      <th>메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedLogs.map((log, idx) => (
                      <tr key={log.id || log.a_time || idx}>
                        <td style={{ textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                          {idx + 1}
                        </td>
                        <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                          {log.dateDisplay}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13.5, color: 'var(--text-1)' }}>
                          {log.timeOnly}
                        </td>
                        {selectedEmpNo === 'ALL' && (
                          <>
                            <td>
                              <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{log.name}</span>
                              <span style={{ fontSize: 11.5, color: 'var(--text-3)', marginLeft: 4, fontFamily: 'var(--mono)' }}>
                                ({log.empNo})
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-2)', fontSize: 13 }}>
                              {log.dept}
                            </td>
                          </>
                        )}
                        <td>
                          <span className={`badge-status ${log.badgeClass}`}>
                            {log.tagType}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-2)', fontSize: 13 }}>
                          {log.memo}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AttendanceRecordsPage() {
  return (
    <Suspense fallback={<div className="loading-spinner">화면을 불러오는 중...</div>}>
      <AttendanceRecordsContent />
    </Suspense>
  );
}
