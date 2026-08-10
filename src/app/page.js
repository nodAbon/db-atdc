'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
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

  // 1. 대시보드 오늘 데이터
  const [todayData, setTodayData] = useState({
    employees: [],
    attendance: [],
    leaves: [],
    lastSynced: '',
  });
  const [todayLoading, setTodayLoading] = useState(false);

  // 2. 월간 근태보고 데이터
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthKey());
  const [monthlyData, setMonthlyData] = useState({
    employees: [],
    attendance: [],
    leaves: [],
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

  // 오늘 데이터 로드
  const fetchTodayData = useCallback(async () => {
    setTodayLoading(true);
    try {
      const res = await fetch('/api/attendance/today');
      const data = await res.json();
      if (data.employees) {
        setTodayData({
          employees: data.employees,
          attendance: data.attendance || [],
          leaves: data.leaves || [],
          lastSynced: data.lastSynced || '',
        });
      }
    } catch (e) {
      console.error('fetchTodayData error:', e);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  // 월간 데이터 로드
  const fetchMonthlyData = useCallback(async (m) => {
    setMonthlyLoading(true);
    try {
      const res = await fetch(`/api/attendance/month?month=${m}`);
      const data = await res.json();
      if (data.employees) {
        setMonthlyData({
          employees: data.employees,
          attendance: data.attendance || [],
          leaves: data.leaves || [],
        });
      }
    } catch (e) {
      console.error('fetchMonthlyData error:', e);
    } finally {
      setMonthlyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayData();
  }, [fetchTodayData]);

  useEffect(() => {
    if (activeTab === 'MONTHLY') {
      fetchMonthlyData(selectedMonth);
    }
  }, [activeTab, selectedMonth, fetchMonthlyData]);

  return (
    <div className="app-layout">
      <AppSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      <div className="main-content">
        <header className="top-header">
          <div className="header-left">
            <h1 className="page-title">
              {activeTab === 'DASHBOARD' ? '대시보드' : '월간 근태보고'}
            </h1>
          </div>
          <div className="header-right">
            <span className="clock-badge">{time}</span>
          </div>
        </header>

        {activeTab === 'DASHBOARD' ? (
          <DashboardTab
            employees={todayData.employees}
            todayAttendance={todayData.attendance}
            todayLeaves={todayData.leaves}
            loading={todayLoading}
            onRefresh={fetchTodayData}
            lastSynced={todayData.lastSynced}
          />
        ) : (
          <MonthlyTab
            employees={monthlyData.employees.length > 0 ? monthlyData.employees : todayData.employees}
            monthlyAttendance={monthlyData.attendance}
            monthlyLeaves={monthlyData.leaves}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            loading={monthlyLoading}
          />
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: 30, color: 'var(--text-3)' }}>로딩 중...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
