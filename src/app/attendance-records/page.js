'use client';

import React, { useEffect, useMemo, useState, useCallback, Suspense } from 'react';
import { RefreshCw, RotateCcw, Save, Search, Clock, CheckCircle } from 'lucide-react';
import AppSidebar from '../../components/AppSidebar';
import { formatClockTime } from '../../lib/clock';
import { usePersistentTheme } from '../../lib/usePersistentTheme';
import { getKstDateKey, shiftKstDateKey } from '../../lib/kstDate';
import { formatTimeString } from '../../lib/dashboardUtils';

const buildDraft = (log) => ({
  workDate: log.workDate || log.rawWorkDate || '',
  adjustedRole: log.adjustedRole || '',
  note: log.adjustmentNote || '',
});

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
  const [drafts, setDrafts] = useState({});
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [savingKey, setSavingKey] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
    setError('');
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
      setError(err.message || '직원 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingEmployees(false);
    }
  }, [fromDate, toDate, selectedEmpNo]);

  // 선택된 직원의 로그 로드
  const loadLogs = useCallback(async () => {
    if (!selectedEmpNo) {
      setLogs([]);
      setDrafts({});
      return;
    }
    setLoadingLogs(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/attendance-records?from=${fromDate}&to=${toDate}&empNo=${selectedEmpNo}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.logs || []);
        const nextDrafts = {};
        (json.logs || []).forEach((log) => {
          nextDrafts[String(log.a_time)] = buildDraft(log);
        });
        setDrafts(nextDrafts);
      }
    } catch (err) {
      setError(err.message || '출입기록을 불러오지 못했습니다.');
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

  const summary = useMemo(() => {
    return {
      total: logs.length,
      adjusted: logs.filter((log) => log.isAdjusted).length,
      checkin: logs.filter((log) => log.adjustedRole === '출근').length,
      checkout: logs.filter((log) => log.adjustedRole === '퇴근').length,
      ignored: logs.filter((log) => log.adjustedRole === '무시하기').length,
    };
  }, [logs]);

  const updateDraft = (aTime, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [aTime]: {
        ...prev[aTime],
        [field]: value,
      },
    }));
  };

  const handleSave = async (log) => {
    const draft = drafts[String(log.a_time)] || buildDraft(log);
    setSavingKey(String(log.a_time));
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/attendance-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empNo: selectedEmpNo,
          a_time: log.a_time,
          workDate: draft.workDate || log.rawWorkDate,
          adjustedRole: draft.adjustedRole,
          note: draft.note,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '저장 실패');
      setMessage('출입기록이 성공적으로 저장되었습니다.');
      loadLogs();
    } catch (err) {
      setError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleReset = async (log) => {
    setSavingKey(String(log.a_time));
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/attendance-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empNo: selectedEmpNo,
          a_time: log.a_time,
          adjustedRole: '',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '초기화 실패');
      setMessage('기록이 기본 상태로 복원되었습니다.');
      loadLogs();
    } catch (err) {
      setError(err.message || '복원 중 오류가 발생했습니다.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="ga-theme" data-theme={theme}>
      <AppSidebar activeTab="RECORDS" theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
      <main className="main-content" style={{ flexGrow: 1, padding: '24px 32px', overflowY: 'auto' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              출입기록 조회 및 조정
            </h1>
            <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-2)' }}>
              임직원의 캡스 출입로그 원천 데이터를 조회하고 출근/퇴근 역할을 수동으로 조정합니다.
            </p>
          </div>
          <div className="db-indicator">
            <Clock size={16} style={{ color: 'var(--blue)' }} />
            <span>{time || '--:--:--'}</span>
          </div>
        </div>

        {/* Date Filter & Summary Chips */}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-blue">전체 {summary.total}건</span>
              <span className="badge badge-green">수정됨 {summary.adjusted}건</span>
              <span className="badge badge-amber">출근 {summary.checkin}건</span>
              <span className="badge badge-purple">퇴근 {summary.checkout}건</span>
            </div>
          </div>
        </div>

        {/* Main Grid: Left Employee List, Right Logs Table */}
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
            <div style={{ maxHeight: 620, overflowY: 'auto' }}>
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
                        background: isSelected ? '#EFF6FF' : 'transparent',
                        borderColor: isSelected ? '#BFDBFE' : 'var(--border)',
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
                      {isSelected && <CheckCircle size={16} style={{ color: 'var(--blue)' }} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Logs Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title" style={{ fontSize: 16 }}>
                  {selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.dept}) 출입기록` : '출입기록'}
                </h3>
                <p className="card-subtitle">
                  {selectedEmployee ? `사번: ${selectedEmployee.emp_no} · 조회기간: ${fromDate} ~ ${toDate}` : '직원을 선택해 주세요.'}
                </p>
              </div>
            </div>

            {loadingLogs ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, flexDirection: 'column', gap: 10 }}>
                <RefreshCw size={24} style={{ color: 'var(--blue)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>출입기록을 불러오는 중...</span>
              </div>
            ) : logs.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
                해당 기간에 기록된 캡스 태그 내역이 없습니다.
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, maxHeight: 600 }}>
                <table className="table" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '120px' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>태그 일시</th>
                      <th>게이트</th>
                      <th>적용 일자</th>
                      <th>역할 지정</th>
                      <th>사유 / 메모</th>
                      <th style={{ textAlign: 'center' }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const aTime = String(log.a_time);
                      const draft = drafts[aTime] || buildDraft(log);
                      const isSaving = savingKey === aTime;

                      return (
                        <tr key={log.a_time || log.id}>
                          <td>
                            <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13 }}>
                              {log.logTime}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                              {log.gateName || 'CAPS'}
                            </span>
                          </td>
                          <td>
                            <input
                              type="date"
                              value={draft.workDate || log.rawWorkDate}
                              onChange={(e) => updateDraft(aTime, 'workDate', e.target.value)}
                              className="form-input"
                              style={{ width: '100%', padding: '4px 6px', fontSize: 12 }}
                            />
                          </td>
                          <td>
                            <select
                              value={draft.adjustedRole}
                              onChange={(e) => updateDraft(aTime, 'adjustedRole', e.target.value)}
                              className="ui-select"
                              style={{ width: '100%', minWidth: 'auto', minHeight: 32, padding: '4px 8px', fontSize: 12 }}
                            >
                              <option value="">자동 판정</option>
                              <option value="출근">출근 지정</option>
                              <option value="퇴근">퇴근 지정</option>
                              <option value="무시하기">무시하기</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="조정 사유"
                              value={draft.note}
                              onChange={(e) => updateDraft(aTime, 'note', e.target.value)}
                              className="form-input"
                              style={{ width: '100%', padding: '4px 8px', fontSize: 12 }}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '4px 10px', fontSize: 11.5 }}
                                onClick={() => handleSave(log)}
                                disabled={isSaving}
                              >
                                <Save size={12} />
                                <span>{isSaving ? '저장중' : '저장'}</span>
                              </button>
                              {log.isAdjusted && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: 11.5 }}
                                  onClick={() => handleReset(log)}
                                  disabled={isSaving}
                                  title="원래 상태로 복원"
                                >
                                  <RotateCcw size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
