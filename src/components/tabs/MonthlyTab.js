'use client';

import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Download,
  Search,
  Building2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { getCurrentMonthKey, matchesDeptFilter } from '../../lib/dashboardUtils';
import { exportMonthlyReportToExcel } from '../../lib/excelUtils';

export default function MonthlyTab({
  employees = [],
  monthlyAttendance = [],
  monthlyLeaves = [],
  selectedMonth = getCurrentMonthKey(),
  setSelectedMonth = () => {},
  loading = false,
}) {
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. 월 이전/다음 변경
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    setSelectedMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const next = new Date(y, m, 1);
    setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  // 2. 부서 목록
  const deptList = useMemo(() => {
    const set = new Set(employees.map((e) => e.dept).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [employees]);

  // 3. 월간 데이터 집계
  const monthlyStats = useMemo(() => {
    // 직원별 날짜별 출입 기록 그룹화
    const empDailyLogs = new Map(); // key: `${empNo}_${dateStr}`
    monthlyAttendance.forEach((att) => {
      if (!att.emp_no || !att.a_time) return;
      const dateStr = att.a_time.slice(0, 8);
      const key = `${att.emp_no}_${dateStr}`;
      if (!empDailyLogs.has(key)) {
        empDailyLogs.set(key, []);
      }
      empDailyLogs.get(key).push(att.a_time);
    });

    // 직원별 연차 사용 집계
    const leaveDaysMap = new Map();
    monthlyLeaves.forEach((leave) => {
      if (!leave.emp_no) return;
      const days = parseFloat(leave.leave_days || 1);
      leaveDaysMap.set(leave.emp_no, (leaveDaysMap.get(leave.emp_no) || 0) + days);
    });

    const result = {};

    employees.forEach((emp) => {
      let workDays = 0;
      let totalWorkMinutes = 0;
      let lateCount = 0;
      let earlyLeaveCount = 0;

      // 해당 직원의 모든 날짜 계산
      empDailyLogs.forEach((times, key) => {
        if (!key.startsWith(`${emp.emp_no}_`)) return;
        workDays++;
        const sorted = [...times].sort();
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        // 지각 체크 (09:05 이후)
        const inTime = first.slice(8, 12);
        if (parseInt(inTime, 10) > 905) {
          lateCount++;
        }

        // 근무시간 계산 (최초 ~ 최종)
        if (sorted.length > 1) {
          const inH = parseInt(first.slice(8, 10), 10);
          const inM = parseInt(first.slice(10, 12), 10);
          const outH = parseInt(last.slice(8, 10), 10);
          const outM = parseInt(last.slice(10, 12), 10);

          let diffM = (outH * 60 + outM) - (inH * 60 + inM);
          if (diffM > 60) diffM -= 60; // 점심시간 1시간 제외
          if (diffM > 0) totalWorkMinutes += diffM;

          // 조퇴 체크 (18:00 이전 퇴근)
          if (parseInt(last.slice(8, 12), 10) < 1800) {
            earlyLeaveCount++;
          }
        } else {
          totalWorkMinutes += 8 * 60; // 단일 태그는 기본 8시간 기준 적용
        }
      });

      result[emp.emp_no] = {
        workDays,
        totalWorkHours: (totalWorkMinutes / 60).toFixed(1),
        lateCount,
        earlyLeaveCount,
        leaveDays: leaveDaysMap.get(emp.emp_no) || 0,
      };
    });

    return result;
  }, [employees, monthlyAttendance, monthlyLeaves]);

  // 4. 필터링된 임직원 목록
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesDept = matchesDeptFilter(emp.dept, deptFilter);
      const matchesSearch = !searchQuery ||
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.emp_no.includes(searchQuery);
      return matchesDept && matchesSearch;
    });
  }, [employees, deptFilter, searchQuery]);

  const handleExportExcel = () => {
    exportMonthlyReportToExcel(selectedMonth, filteredEmployees, monthlyStats);
  };

  return (
    <div className="page-container">
      {/* 상단 컨트롤 바 */}
      <div className="filter-bar">
        <div className="filter-group">
          <button type="button" className="btn btn-secondary" onClick={handlePrevMonth}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--blue)' }}>
            {selectedMonth}
          </span>
          <button type="button" className="btn btn-secondary" onClick={handleNextMonth}>
            <ChevronRight size={16} />
          </button>

          <Building2 size={16} style={{ color: 'var(--text-3)', marginLeft: 12 }} />
          <select
            className="select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            {deptList.map((d) => (
              <option key={d} value={d}>{d === 'ALL' ? '전체 부서' : d}</option>
            ))}
          </select>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--text-3)' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: 32, width: 200 }}
              placeholder="이름/사번 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <button type="button" className="btn btn-primary" onClick={handleExportExcel}>
          <Download size={15} />
          <span>엑셀 다운로드</span>
        </button>
      </div>

      {/* 월간 근태 보고서 테이블 */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <CalendarDays size={18} style={{ color: 'var(--blue)' }} />
            <span>{selectedMonth} 월간 근태 집계 현황</span>
            <span className="badge badge-blue">{filteredEmployees.length}명</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>사번</th>
                <th>이름</th>
                <th>부서</th>
                <th style={{ textAlign: 'right' }}>총 근무일수</th>
                <th style={{ textAlign: 'right' }}>총 근무시간</th>
                <th style={{ textAlign: 'center' }}>지각</th>
                <th style={{ textAlign: 'center' }}>조퇴</th>
                <th style={{ textAlign: 'center' }}>연차 사용</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-3)' }}>
                    조회된 월간 근태 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const stat = monthlyStats[emp.emp_no] || {};
                  return (
                    <tr key={emp.emp_no}>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{emp.emp_no}</td>
                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td style={{ color: 'var(--text-2)' }}>{emp.dept || '-'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                        {stat.workDays || 0}일
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--blue)' }}>
                        {stat.totalWorkHours || '0.0'}시간
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {stat.lateCount > 0 ? (
                          <span className="badge badge-amber">{stat.lateCount}회</span>
                        ) : (
                          <span style={{ color: 'var(--text-3)' }}>-</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {stat.earlyLeaveCount > 0 ? (
                          <span className="badge badge-red">{stat.earlyLeaveCount}회</span>
                        ) : (
                          <span style={{ color: 'var(--text-3)' }}>-</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {stat.leaveDays > 0 ? (
                          <span className="badge badge-purple">{stat.leaveDays}일</span>
                        ) : (
                          <span style={{ color: 'var(--text-3)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
