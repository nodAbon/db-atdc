'use client';

import React, { useEffect, useMemo, useState, useCallback, Suspense } from 'react';
import { RefreshCw, Search, Clock, Calendar, ArrowRight, User, CheckCircle2 } from 'lucide-react';
import AppSidebar from '../../components/AppSidebar';
import { formatClockTime } from '../../lib/clock';
import { usePersistentTheme } from '../../lib/usePersistentTheme';
import { getKstDateKey, shiftKstDateKey } from '../../lib/kstDate';

function formatDisplayDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[d.getDay()] || '';
  return `${parts[0]}년 ${parts[1]}월 ${parts[2]}일 (${dayName})`;
}

function formatTimeStringOnly(raw) {
  if (!raw) return '-';
  const s = String(raw).trim();
  if (s.length >= 14) {
    return `${s.substring(8, 10)}:${s.substring(10, 12)}:${s.substring(12, 14)}`;
  }
  if (s.includes(' ')) {
    return s.split(' ')[1] || s;
  }
  return s;
}

function AttendanceRecordsContent() {
  const [theme, setTheme] = usePersistentTheme('light');
  const [time, setTime] = useState('');

  const todayStr = getKstDateKey(new Date());
  const [fromDate, setFromDate] = useState(() => `${todayStr.slice(0, 7)}-01`);
  const [toDate, setToDate] = useState(todayStr);

  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmpNo, setSelectedEmpNo] = useState('');
  const [logs, setLogs] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // 시계
  useEffect(() => {
    const tick = () => setTime(formatClockTime(new Date()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // 직원 목록 로드
  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const res = await fetch(`/api/attendance-records?from=${fromDate}&to=${toDate}`);
      const json = await res.json();
      if (json.success) {
        setEmployees(json.employees || []);
        if (!selectedEmpNo && json.employees?.length > 0) {
          setSelectedEmpNo(json.employees[0].emp_no);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEmployees(false);
    }
  }, [fromDate, toDate, selectedEmpNo]);

  // 선택된 직원의 로그 로드
  const loadLogs = useCallback(async () => {
    if (!selectedEmpNo) {
      setLogs([]);
      return;
    }
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/attendance-records?from=${fromDate}&to=${toDate}&empNo=${selectedEmpNo}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  }, [fromDate, toDate, selectedEmpNo]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (employees || []).filter((e) => {
      if (!q) return true;
      return `${e.name} ${e.emp_no} ${e.dept || ''}`.toLowerCase().includes(q);
    });
  }, [employees, searchQuery]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => String(e.emp_no) === String(selectedEmpNo)) || null,
    [employees, selectedEmpNo]
  );

  // 일자별(workDate)로 로그 그룹화 및 '출근' / '퇴근' / '출입' 메모 판정
  const groupedLogs = useMemo(() => {
    const dateMap = new Map();

    // logs를 a_time 오름차순(시간순)으로 정렬
    const sorted = [...logs].sort((a, b) => String(a.a_time).localeCompare(String(b.a_time)));

    sorted.forEach((log) => {
      const dateKey = log.rawWorkDate || log.workDate || '기타';
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey).push(log);
    });

    // 날짜는 최신순(내림차순)으로 표시
    const sortedDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((dateKey) => {
      const dayLogs = dateMap.get(dateKey);
      const totalCount = dayLogs.length;

      const annotatedLogs = dayLogs.map((log, idx) => {
        let tagType = '출입';
        let memo = '출입 기록';
        let badgeClass = 'badge badge-gray';

        if (totalCount === 1) {
          tagType = '출근';
          memo = '출근 (당일 1회 태그)';
          badgeClass = 'badge badge-green';
        } else if (idx === 0) {
          tagType = '출근';
          memo = '출근 (첫 출입 기록)';
          badgeClass = 'badge badge-green';
        } else if (idx === totalCount - 1) {
          tagType = '퇴근';
          memo = '퇴근 (마지막 출입 기록)';
          badgeClass = 'badge badge-blue';
        } else {
          tagType = '출입';
          memo = `중간 출입 (${idx + 1}번째)`;
          badgeClass = 'badge badge-gray';
        }

        return {
          ...log,
          timeOnly: formatTimeStringOnly(log.a_time || log.logTime),
          tagType,
          memo,
          badgeClass,
        };
      });

      return {
        dateKey,
        displayDate: formatDisplayDate(dateKey),
        logs: annotatedLogs,
        firstTime: annotatedLogs[0]?.timeOnly || '-',
        lastTime: annotatedLogs.length > 1 ? annotatedLogs[annotatedLogs.length - 1]?.timeOnly : '-',
      };
    });
  }, [logs]);

  return (
    <div className="ga-theme" data-theme={theme}>
      <AppSidebar activeTab="RECORDS" theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
      <main className="main-content" style={{ flexGrow: 1, padding: '24px 32px', overflowY: 'auto' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              출입기록 조회
            </h1>
            <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-2)' }}>
              임직원의 캡스 출입 시간을 일자별로 조회합니다. 당일 첫 출입은 출근, 마지막 출입은 퇴근으로 표시됩니다.
            </p>
          </div>
          <div className="db-indicator">
            <Clock size={16} style={{ color: 'var(--amber)' }} />
            <span>{time || '--:--:--'}</span>
          </div>
        </div>

        {/* Date Filter & Search Bar */}
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>조회 기간:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="form-input"
                style={{ width: 140, padding: '6px 10px', fontSize: 13 }}
              />
              <span style={{ color: 'var(--text-3)' }}>~</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="form-input"
                style={{ width: 140, padding: '6px 10px', fontSize: 13 }}
              />
              <button type="button" className="btn btn-secondary" onClick={() => { loadEmployees(); loadLogs(); }}>
                <RefreshCw size={14} />
                <span>조회</span>
              </button>
            </div>

            {selectedEmployee && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                  {selectedEmployee.name} ({selectedEmployee.dept})
                </span>
                <span className="badge badge-amber">총 {logs.length}건 기록</span>
              </div>
            )}
          </div>
        </div>

        {/* Main 2-Column Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Left Employee List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
                <input
                  type="text"
                  placeholder="이름/사번/부서 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  style={{ width: '100%', paddingLeft: 30 }}
                />
              </div>
            </div>
            <div style={{ maxHeight: 650, overflowY: 'auto' }}>
              {filteredEmployees.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                  직원이 없습니다.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = String(emp.emp_no) === String(selectedEmpNo);
                  return (
                    <button
                      key={emp.emp_no}
                      type="button"
                      onClick={() => setSelectedEmpNo(emp.emp_no)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border)',
                        background: isSelected ? 'var(--bg-overlay-md)' : 'transparent',
                        borderColor: isSelected ? 'var(--border-hover)' : 'var(--border)',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                        borderRadius: 0,
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

          {/* Right Logs Timeline / Table View */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title" style={{ fontSize: 16 }}>
                  {selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.dept}) 출입 기록 내역` : '출입 기록 내역'}
                </h3>
                <p className="card-subtitle">
                  {selectedEmployee ? `사번: ${selectedEmployee.emp_no} · ${fromDate} ~ ${toDate}` : '직원을 선택해 주세요.'}
                </p>
              </div>
            </div>

            {loadingLogs ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, flexDirection: 'column', gap: 10 }}>
                <RefreshCw size={24} style={{ color: 'var(--blue)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>출입기록을 불러오는 중...</span>
              </div>
            ) : groupedLogs.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
                해당 기간에 기록된 캡스 출입 기록이 없습니다.
              </div>
            ) : (
              <div style={{ maxHeight: 650, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {groupedLogs.map((group) => (
                  <div
                    key={group.dateKey}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: 'var(--bg-card)',
                    }}
                  >
                    {/* 날짜 헤더 요약 바 */}
                    <div
                      style={{
                        padding: '10px 16px',
                        background: 'var(--bg-overlay-sm)',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Calendar size={15} style={{ color: 'var(--blue)' }} />
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>
                          {group.displayDate}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                        <span>
                          <strong style={{ color: 'var(--text-3)' }}>출근: </strong>
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--green)' }}>
                            {group.firstTime}
                          </span>
                        </span>
                        {group.lastTime !== '-' && (
                          <span>
                            <strong style={{ color: 'var(--text-3)' }}>퇴근: </strong>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--blue)' }}>
                              {group.lastTime}
                            </span>
                          </span>
                        )}
                        <span className="badge badge-gray">{group.logs.length}회 출입</span>
                      </div>
                    </div>

                    {/* 출입 내역 테이블 */}
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '80px', textAlign: 'center' }}>순번</th>
                          <th style={{ width: '180px' }}>출입 일시</th>
                          <th style={{ width: '140px' }}>구분</th>
                          <th>메모</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.logs.map((log, idx) => (
                          <tr key={log.id || log.a_time || idx}>
                            <td style={{ textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                              {idx + 1}
                            </td>
                            <td>
                              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13.5, color: 'var(--text-1)' }}>
                                {log.timeOnly}
                              </div>
                            </td>
                            <td>
                              <span className={log.badgeClass}>
                                {log.tagType}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                                {log.memo}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
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
