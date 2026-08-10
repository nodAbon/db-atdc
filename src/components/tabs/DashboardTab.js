'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  RefreshCw,
  Clock,
  Building2,
} from 'lucide-react';
import { formatTimeString, matchesDeptFilter } from '../../lib/dashboardUtils';

export default function DashboardTab({
  employees = [],
  todayAttendance = [],
  todayLeaves = [],
  loading = false,
  onRefresh = () => {},
  lastSynced = '',
}) {
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. 부서 목록 추출
  const deptList = useMemo(() => {
    const set = new Set(employees.map((e) => e.dept).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [employees]);

  // 2. 직원별 오늘 출퇴근 & 휴가 데이터 매핑
  const employeeStatusList = useMemo(() => {
    const attMap = new Map();
    todayAttendance.forEach((att) => {
      if (!att.emp_no) return;
      if (!attMap.has(att.emp_no)) {
        attMap.set(att.emp_no, []);
      }
      attMap.get(att.emp_no).push(att);
    });

    const leaveMap = new Map();
    todayLeaves.forEach((leave) => {
      if (leave.emp_no) leaveMap.set(leave.emp_no, leave);
    });

    return employees.map((emp) => {
      const logs = attMap.get(emp.emp_no) || [];
      const leave = leaveMap.get(emp.emp_no);

      // 출근/퇴근 계산 (가장 이른 시간: 출근, 가장 늦은 시간: 퇴근)
      let clockIn = null;
      let clockOut = null;
      let gate = '-';

      if (logs.length > 0) {
        // 시간순 정렬
        const sorted = [...logs].sort((a, b) => String(a.a_time).localeCompare(String(b.a_time)));
        clockIn = sorted[0].a_time;
        if (sorted.length > 1) {
          clockOut = sorted[sorted.length - 1].a_time;
        }
        gate = sorted[0].gate_name || 'CAPS';
      }

      // 상태 계산
      let status = '미출근';
      let badgeType = 'badge-red';

      if (leave) {
        status = leave.leave_name || '연차/휴가';
        badgeType = 'badge-purple';
      } else if (clockIn) {
        const timePart = clockIn.slice(8, 12); // HHmm
        if (parseInt(timePart, 10) > 905) {
          status = clockOut ? '지각/퇴근' : '지각';
          badgeType = 'badge-amber';
        } else {
          status = clockOut ? '근무완료' : '근무중';
          badgeType = 'badge-green';
        }
      }

      return {
        ...emp,
        clockIn,
        clockOut,
        gate,
        status,
        badgeType,
        leave,
      };
    });
  }, [employees, todayAttendance, todayLeaves]);

  // 3. 필터링
  const filteredList = useMemo(() => {
    return employeeStatusList.filter((item) => {
      const matchesDept = matchesDeptFilter(item.dept, deptFilter);
      const matchesSearch = !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.emp_no.includes(searchQuery);
      return matchesDept && matchesSearch;
    });
  }, [employeeStatusList, deptFilter, searchQuery]);

  // 4. 통계 요약
  const stats = useMemo(() => {
    const total = employees.length;
    let present = 0;
    let late = 0;
    let onLeave = 0;
    let absent = 0;

    employeeStatusList.forEach((item) => {
      if (item.leave) {
        onLeave++;
      } else if (item.clockIn) {
        present++;
        if (item.status.includes('지각')) late++;
      } else {
        absent++;
      }
    });

    return { total, present, late, onLeave, absent };
  }, [employees.length, employeeStatusList]);

  return (
    <div className="page-container">
      {/* 통계 요약 그리드 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--blue-subtle)', color: 'var(--blue)' }}>
            <Users size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">전체 임직원</span>
            <span className="stat-value">{stats.total}명</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--green-subtle)', color: 'var(--green)' }}>
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">출근 완료</span>
            <span className="stat-value" style={{ color: 'var(--green)' }}>{stats.present}명</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--amber-subtle)', color: 'var(--amber)' }}>
            <AlertCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">지각 / 미출근</span>
            <span className="stat-value" style={{ color: 'var(--amber)' }}>{stats.late + stats.absent}명</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--purple-subtle)', color: 'var(--purple)' }}>
            <Calendar size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">연차 / 휴가</span>
            <span className="stat-value" style={{ color: 'var(--purple)' }}>{stats.onLeave}명</span>
          </div>
        </div>
      </div>

      {/* 필터 및 검색 바 */}
      <div className="filter-bar">
        <div className="filter-group">
          <Building2 size={16} style={{ color: 'var(--text-3)' }} />
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
              placeholder="이름 또는 사번 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-group">
          {lastSynced && (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              동기화: {lastSynced}
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>{loading ? '새로고침 중...' : '새로고침'}</span>
          </button>
        </div>
      </div>

      {/* 오늘 근태 현황 테이블 */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Clock size={18} style={{ color: 'var(--blue)' }} />
            <span>오늘의 실시간 출퇴근 현황</span>
            <span className="badge badge-blue">{filteredList.length}명</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>사번</th>
                <th>이름</th>
                <th>부서</th>
                <th>출근 시간</th>
                <th>퇴근 시간</th>
                <th>근태 상태</th>
                <th>인식 게이트</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-3)' }}>
                    조회된 임직원 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.emp_no}>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{item.emp_no}</td>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td style={{ color: 'var(--text-2)' }}>{item.dept || '-'}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>
                      {formatTimeString(item.clockIn)}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)' }}>
                      {formatTimeString(item.clockOut)}
                    </td>
                    <td>
                      <span className={`badge ${item.badgeType}`}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                      {item.gate}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
