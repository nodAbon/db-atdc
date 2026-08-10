'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppSidebar from '../components/AppSidebar';
import DashboardTab from '../components/tabs/DashboardTab';
import MonthlyTab from '../components/tabs/MonthlyTab';
import { usePersistentTheme } from '../lib/usePersistentTheme';
import { formatClockTime } from '../lib/clock';
import { getCurrentMonthKey } from '../lib/dashboardUtils';

function DashboardContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [theme, setTheme] = usePersistentTheme('dark');
  const [time, setTime] = useState('');

  // 1. 대시보드 상태 데이터
  const [dashboardData, setDashboardData] = useState({
    employeeStatuses: [],
    deptData: [],
    leaves: [],
  });
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => getCurrentMonthKey());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [viewDeptFilter, setViewDeptFilter] = useState('ALL');

  // 2. 월간 근태보고 데이터
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthKey());
  const [monthlyData, setMonthlyData] = useState({
    employees: [],
    gridData: {},
    leaves: [],
    overrides: [],
  });
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // URL 탭 파라미터 동기화
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'MONTHLY') {
      setActiveTab('MONTHLY');
    } else {
      setActiveTab('DASHBOARD');
    }
  }, [searchParams]);

  // 실시간 시계
  useEffect(() => {
    const tick = () => setTime(formatClockTime(new Date()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // 오늘 대시보드 데이터 로드
  const fetchDashboardData = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const res = await fetch('/api/attendance?dashboardOnly=true', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setDashboardData({
          employeeStatuses: json.employeeStatuses || [],
          deptData: json.deptData || [],
          leaves: json.leaves || [],
        });
      }
    } catch (e) {
      console.error('fetchDashboardData error:', e);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // 월간 근태보고 데이터 로드
  const fetchMonthlyData = useCallback(async (m) => {
    setMonthlyLoading(true);
    try {
      const res = await fetch(`/api/attendance?month=${m}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setMonthlyData({
          employees: json.employees || [],
          gridData: json.gridData || {},
          leaves: json.leaves || [],
          overrides: json.overrides || [],
        });
      }
    } catch (e) {
      console.error('fetchMonthlyData error:', e);
    } finally {
      setMonthlyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (activeTab === 'MONTHLY') {
      fetchMonthlyData(selectedMonth);
    }
  }, [activeTab, selectedMonth, fetchMonthlyData]);

  // 부서 옵션 목록
  const deptOptions = useMemo(() => {
    const set = new Set();
    set.add('ALL');
    (dashboardData.employeeStatuses || []).forEach((e) => {
      if (e.dept) set.add(e.dept);
    });
    return Array.from(set);
  }, [dashboardData.employeeStatuses]);

  const calendarEmployeeNameLookup = useMemo(() => {
    const map = new Map();
    (dashboardData.employeeStatuses || []).forEach((e) => {
      if (e.empNo) map.set(e.empNo, e.name);
    });
    return map;
  }, [dashboardData.employeeStatuses]);

  return (
    <div className="ga-theme" data-theme={theme}>
      <AppSidebar activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
      <main className="main-content" style={{ flexGrow: 1, padding: '24px 32px', overflowY: 'auto' }}>
        {activeTab === 'DASHBOARD' && (
          <DashboardTab
            data={dashboardData}
            viewDeptFilter={viewDeptFilter}
            setViewDeptFilter={setViewDeptFilter}
            deptOptions={deptOptions}
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            selectedCalendarDate={selectedCalendarDate}
            setSelectedCalendarDate={setSelectedCalendarDate}
            visibleDashboardLeaves={dashboardData.leaves}
            calendarEmployeeNameLookup={calendarEmployeeNameLookup}
            time={time}
            theme={theme}
            toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
        )}

        {activeTab === 'MONTHLY' && (
          <MonthlyTab
            monthlyLoading={monthlyLoading}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            visibleMonthlyEmployees={monthlyData.employees}
            monthlyData={monthlyData}
            refreshData={() => fetchMonthlyData(selectedMonth)}
          />
        )}
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="loading-spinner">화면을 불러오는 중...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
