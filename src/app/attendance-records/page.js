'use client';

import React, { useEffect, useMemo, useState, useCallback, Suspense } from 'react';
import { RefreshCw, Search, Clock, Calendar, User, Users, CheckCircle2 } from 'lucide-react';
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
  // 기본 조회 범위: 최근 60일 (충분히 많은 데이터가 바로 보이도록)
  const [fromDate, setFromDate] = useState(() => shiftKstDateKey(todayStr, -60));
  const [toDate, setToDate] = useState(todayStr);

  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmpNo, setSelectedEmpNo] = useState('ALL'); // 기본 'ALL' 전체 직원 보기
  const [logs, setLogs] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // 시계 타이머
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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEmployees(false);
    }
  }, [fromDate, toDate]);

  // 출입 로그 로드
  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const empParam = selectedEmpNo && selectedEmpNo !== 'ALL' ? `&empNo=${selectedEmpNo}` : '';
      const res = await fetch(`/api/attendance-records?from=${fromDate}&to=${toDate}${empParam}`);
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

  // 날짜 프리셋 퀵 필터
  const setQuickRange = (preset) => {
    if (preset === 'TODAY') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'MONTH') {
      setFromDate(`${todayStr.slice(0, 7)}-01`);
      setToDate(todayStr);
    } else if (preset === '3MONTHS') {
      setFromDate(shiftKstDateKey(todayStr, -90));
      setToDate(todayStr);
    } else if (preset === 'YEAR') {
      setFromDate(`${todayStr.slice(0, 4)}-01-01`);
      setToDate(todayStr);
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (employees || []).filter((e) => {
      if (!q) return true;
      return `${e.name} ${e.emp_no} ${e.dept || ''}`.toLowerCase().includes(q);
    });
  }, [employees, searchQuery]);

  const selectedEmployee = useMemo(() => {
    if (selectedEmpNo === 'ALL') return null;
    return employees.find((e) => String(e.emp_no) === String(selectedEmpNo)) || null;
  }, [employees, selectedEmpNo]);

  // 날짜별 및 직원별 출근/퇴근 자동 태그 판정
  const groupedSections = useMemo(() => {
    // 1. 직원 + 날짜 단위로 묶어서 첫번째=출근, 마지막=퇴근 부여
    const userDayMap = new Map(); // key: `${empNo}_${dateKey}`

    const sortedAsc = [...logs].sort((a, b) => String(a.a_time).localeCompare(String(b.a_time)));

    sortedAsc.forEach((log) => {
      const dateKey = log.rawWorkDate || '기타';
      const key = `${log.empNo}_${dateKey}`;
      if (!userDayMap.has(key)) {
        userDayMap.set(key, []);
      }
      userDayMap.get(key).push(log);
    });

    // 각 로그에 출근/퇴근/출입 메모 부여
    const annotatedList = [];
    userDayMap.forEach((dayLogs) => {
      const totalCount = dayLogs.length;
      dayLogs.forEach((log, idx) => {
        let tagType = '출입';
        let memo = '출입';
        let badgeClass = 'badge badge-gray';

        if (totalCount === 1) {
          tagType = '출근';
          memo = '출근 (당일 1회 태그)';
          badgeClass = 'badge badge-green';
        } else if (idx === 0) {
          tagType = '출근';
          memo = '출근 (첫 기록)';
          badgeClass = 'badge badge-green';
        } else if (idx === totalCount - 1) {
          tagType = '퇴근';
          memo = '퇴근 (마지막 기록)';
          badgeClass = 'badge badge-blue';
        } else {
          tagType = '출입';
          memo = `중간 출입 (${idx + 1}회차)`;
          badgeClass = 'badge badge-gray';
        }

        annotatedList.push({
          ...log,
          timeOnly: formatTimeStringOnly(log.a_time || log.logTime),
          tagType,
          memo,
          badgeClass,
        });
      });
    });

    // 2. 날짜별로 그룹화 (최신 일자 순)
    const dateGroupMap = new Map();
    annotatedList.sort((a, b) => String(b.a_time).localeCompare(String(a.a_time))); // 내림차순 정렬

    annotatedList.forEach((log) => {
      const dateKey = log.rawWorkDate || '기타';
      if (!dateGroupMap.has(dateKey)) {
        dateGroupMap.set(dateKey, []);
      }
      dateGroupMap.get(dateKey).push(log);
    });

    const sortedDates = Array.from(dateGroupMap.keys()).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((dateKey) => ({
      dateKey,
      displayDate: formatDisplayDate(dateKey),
      logs: dateGroupMap.get(dateKey),
    }));
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
              임직원의 캡스 출입 시간을 일자별로 조회합니다. 당일 첫 기록은 출근, 마지막 기록은 퇴근으로 자동 표시됩니다.
            </p>
          </div>
          <div className="db-indicator">
            <Clock size={16} style={{ color: 'var(--amber)' }} />
            <span>{time || '--:--:--'}</span>
          </div>
        </div>

        {/* Date Filter & Preset Controls */}
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>조회 기간:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="form-input"
                style={{ width: 135, padding: '6px 10px', fontSize: 13 }}
              />
              <span style={{ color: 'var(--text-3)' }}>~</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="form-input"
                style={{ width: 135, padding: '6px 10px', fontSize: 13 }}
              />
              <button type="button" className="btn btn-secondary" onClick={() => { loadEmployees(); loadLogs(); }}>
                <RefreshCw size={14} />
                <span>조회</span>
              </button>

              {/* 퀵 필터 버튼 */}
              <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
                <button type="button" className="btn btn-secondary" style={{ padding: '5px 9px', fontSize: 11.5 }} onClick={() => setQuickRange('TODAY')}>
                  오늘
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: '5px 9px', fontSize: 11.5 }} onClick={() => setQuickRange('MONTH')}>
                  이번달
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: '5px 9px', fontSize: 11.5 }} onClick={() => setQuickRange('3MONTHS')}>
                  최근 3개월
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: '5px 9px', fontSize: 11.5 }} onClick={() => setQuickRange('YEAR')}>
                  올해 전체
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-amber" style={{ fontSize: 12, padding: '5px 12px' }}>
                총 {logs.length.toLocaleString()}건 출입 기록
              </span>
            </div>
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

            <div style={{ maxHeight: 680, overflowY: 'auto' }}>
              {/* '전체 직원' 옵션 */}
              <button
                type="button"
                onClick={() => setSelectedEmpNo('ALL')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border)',
                  background: selectedEmpNo === 'ALL' ? 'var(--bg-overlay-md)' : 'transparent',
                  borderColor: selectedEmpNo === 'ALL' ? 'var(--border-hover)' : 'var(--border)',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                  borderRadius: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} style={{ color: selectedEmpNo === 'ALL' ? 'var(--blue)' : 'var(--text-3)' }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: selectedEmpNo === 'ALL' ? 'var(--blue)' : 'var(--text-1)' }}>
                      전체 직원 보기
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      총 {employees.length}명
                    </div>
                  </div>
                </div>
                {selectedEmpNo === 'ALL' && <CheckCircle2 size={16} style={{ color: 'var(--blue)' }} />}
              </button>

              {filteredEmployees.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                  검색된 직원이 없습니다.
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
                  {selectedEmployee
                    ? `${selectedEmployee.name} (${selectedEmployee.dept} · 사번 ${selectedEmployee.emp_no}) 출입 기록`
                    : `전체 직원 출입 기록 내역`}
                </h3>
                <p className="card-subtitle">
                  조회 기간: {fromDate} ~ {toDate} · 총 {logs.length}건의 태그 기록
                </p>
              </div>
            </div>

            {loadingLogs ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, flexDirection: 'column', gap: 12 }}>
                <RefreshCw size={28} style={{ color: 'var(--blue)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>출입기록을 불러오는 중...</span>
              </div>
            ) : groupedSections.length === 0 ? (
              <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
                해당 기간에 기록된 캡스 출입 기록이 없습니다. 상단에서 조회 기간을 변경해보세요.
              </div>
            ) : (
              <div style={{ maxHeight: 680, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {groupedSections.map((group) => (
                  <div
                    key={group.dateKey}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: 'var(--bg-card)',
                    }}
                  >
                    {/* 일자 헤더 바 */}
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
                      <span className="badge badge-gray">{group.logs.length}건 기록</span>
                    </div>

                    {/* 출입 내역 테이블 */}
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '60px', textAlign: 'center' }}>No</th>
                          <th style={{ width: '130px' }}>출입 시각</th>
                          {selectedEmpNo === 'ALL' && (
                            <>
                              <th style={{ width: '120px' }}>이름</th>
                              <th style={{ width: '130px' }}>부서</th>
                            </>
                          )}
                          <th style={{ width: '110px' }}>구분</th>
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
                            {selectedEmpNo === 'ALL' && (
                              <>
                                <td>
                                  <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>
                                    {log.name}
                                  </span>
                                  <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4, fontFamily: 'var(--mono)' }}>
                                    ({log.empNo})
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                                    {log.dept}
                                  </span>
                                </td>
                              </>
                            )}
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
