'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppSidebar from '../../components/AppSidebar';
import { usePersistentTheme } from '../../lib/usePersistentTheme';
import { formatClockTime } from '../../lib/clock';
import {
  Clock,
  Calendar,
  Building2,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Edit3,
} from 'lucide-react';
import { formatTimeString } from '../../lib/dashboardUtils';

export default function AttendanceRecordsPage() {
  const [theme, setTheme] = usePersistentTheme('light');
  const [time, setTime] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [dept, setDept] = useState('ALL');
  const [selectedEmpNo, setSelectedEmpNo] = useState('');

  const [employees, setEmployees] = useState([]);
  const [logs, setLogs] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(false);

  // 시간 보정 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTargetEmp, setModalTargetEmp] = useState(null);
  const [correctTimeVal, setCorrectTimeVal] = useState('18:00');
  const [correctReason, setCorrectReason] = useState('');

  // 시계 타이머
  useEffect(() => {
    const tick = () => setTime(formatClockTime(new Date()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance-records?date=${date}&dept=${dept}&emp_no=${selectedEmpNo}`);
      const data = await res.json();
      if (data.employees) setEmployees(data.employees);
      if (data.logs) setLogs(data.logs);
      if (data.adjustments) setAdjustments(data.adjustments);
      if (data.corrections) setCorrections(data.corrections);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [date, dept, selectedEmpNo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 역할 조정 처리
  const handleRoleAdjust = async (log, role) => {
    try {
      const res = await fetch('/api/attendance-records/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust_role',
          attendanceId: log.id,
          empNo: log.emp_no,
          workDate: date,
          role,
        }),
      });
      if (res.ok) {
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 수동 시간 보정 저장
  const handleSaveCorrection = async () => {
    if (!modalTargetEmp || !correctTimeVal) return;
    try {
      const [h, m] = correctTimeVal.split(':');
      const isoTime = `${date}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00+09:00`;

      const res = await fetch('/api/attendance-records/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'correct_time',
          empNo: modalTargetEmp.emp_no,
          workDate: date,
          correctedOutTime: isoTime,
          reason: correctReason || '관리자 수동 보정',
        }),
      });
      if (res.ok) {
        setModalOpen(false);
        setModalTargetEmp(null);
        setCorrectReason('');
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 맵핑 빌드
  const adjustmentMap = new Map(adjustments.map((a) => [a.attendance_id, a.adjusted_role]));
  const correctionMap = new Map(corrections.map((c) => [c.emp_no, c]));

  return (
    <div className="app-layout">
      <AppSidebar
        theme={theme}
        toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      <div className="main-content">
        <header className="top-header">
          <div className="header-left">
            <h1 className="page-title">출입기록 조회 및 조정</h1>
          </div>
          <div className="header-right">
            <span className="clock-badge">{time}</span>
          </div>
        </header>

        <div className="page-container">
          {/* 컨트롤 바 */}
          <div className="filter-bar">
            <div className="filter-group">
              <Calendar size={16} style={{ color: 'var(--text-3)' }} />
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />

              <Building2 size={16} style={{ color: 'var(--text-3)', marginLeft: 8 }} />
              <select
                className="select"
                value={dept}
                onChange={(e) => {
                  setDept(e.target.value);
                  setSelectedEmpNo('');
                }}
              >
                <option value="ALL">전체 부서</option>
                {Array.from(new Set(employees.map((e) => e.dept).filter(Boolean))).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <User size={16} style={{ color: 'var(--text-3)', marginLeft: 8 }} />
              <select
                className="select"
                value={selectedEmpNo}
                onChange={(e) => setSelectedEmpNo(e.target.value)}
              >
                <option value="">전체 직원</option>
                {employees.map((e) => (
                  <option key={e.emp_no} value={e.emp_no}>
                    {e.name} ({e.emp_no})
                  </option>
                ))}
              </select>
            </div>

            <button type="button" className="btn btn-secondary" onClick={loadData}>
              <RotateCcw size={14} className={loading ? 'spin' : ''} />
              <span>새로고침</span>
            </button>
          </div>

          {/* 직원별 출입기록 및 조정 패널 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {employees.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-3)' }}>
                해당 조건의 직원 또는 출입기록 데이터가 없습니다.
              </div>
            ) : (
              employees.map((emp) => {
                const empLogs = logs.filter((l) => l.emp_no === emp.emp_no);
                const correction = correctionMap.get(emp.emp_no);

                return (
                  <div key={emp.emp_no} className="card">
                    <div className="card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
                          {emp.name}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                          {emp.emp_no}
                        </span>
                        <span className="badge badge-blue">{emp.dept || '부서미지정'}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {correction && (
                          <span className="badge badge-amber">
                            수동 보정됨 ({formatTimeString(correction.corrected_out_time)})
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => {
                            setModalTargetEmp(emp);
                            setModalOpen(true);
                          }}
                        >
                          <Edit3 size={13} />
                          <span>시간 수동 보정</span>
                        </button>
                      </div>
                    </div>

                    {/* 태그 내역 목록 */}
                    <div className="table-wrapper">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>태그 시각</th>
                            <th>게이트 / 위치</th>
                            <th>원본 이벤트</th>
                            <th>지정된 역할</th>
                            <th style={{ textAlign: 'center' }}>역할 조정</th>
                          </tr>
                        </thead>
                        <tbody>
                          {empLogs.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 18 }}>
                                이날 기록된 CAPS 태그 기록이 없습니다.
                              </td>
                            </tr>
                          ) : (
                            empLogs.map((log) => {
                              const adjustedRole = adjustmentMap.get(log.id);

                              return (
                                <tr key={log.id}>
                                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                                    {formatTimeString(log.a_time)}
                                  </td>
                                  <td style={{ color: 'var(--text-2)' }}>
                                    {log.gate_name || 'CAPS'}
                                  </td>
                                  <td>
                                    <span className="badge badge-blue">{log.event_type || '출입'}</span>
                                  </td>
                                  <td>
                                    {adjustedRole ? (
                                      <span className={`badge ${
                                        adjustedRole === '출근' ? 'badge-green' :
                                        adjustedRole === '퇴근' ? 'badge-blue' : 'badge-red'
                                      }`}>
                                        {adjustedRole} (수정됨)
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-3)', fontSize: 12 }}>자동 판정</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', gap: 6 }}>
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ padding: '3px 8px', fontSize: 11 }}
                                        onClick={() => handleRoleAdjust(log, '출근')}
                                      >
                                        출근 지정
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ padding: '3px 8px', fontSize: 11 }}
                                        onClick={() => handleRoleAdjust(log, '퇴근')}
                                      >
                                        퇴근 지정
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-danger"
                                        style={{ padding: '3px 8px', fontSize: 11 }}
                                        onClick={() => handleRoleAdjust(log, '무시하기')}
                                      >
                                        무시
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 수동 시간 보정 모달 */}
      {modalOpen && modalTargetEmp && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <div className="card-title">
                <Edit3 size={18} style={{ color: 'var(--blue)' }} />
                <span>출퇴근 시간 수동 보정</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '16px 0' }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>
                  대상 직원
                </label>
                <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                  {modalTargetEmp.name} ({modalTargetEmp.emp_no}) / {modalTargetEmp.dept}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>
                  보정 기준 날짜
                </label>
                <div style={{ fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>
                  {date}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>
                  보정 퇴근 시간 (HH:mm)
                </label>
                <input
                  type="time"
                  className="input"
                  style={{ width: '100%' }}
                  value={correctTimeVal}
                  onChange={(e) => setCorrectTimeVal(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>
                  보정 사유
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%' }}
                  placeholder="예: 외근 후 현지 퇴근, CAPS 카드 미태그 소명"
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveCorrection}
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
