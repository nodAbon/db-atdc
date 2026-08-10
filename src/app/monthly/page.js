'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import AppSidebar from '../../components/AppSidebar';
import MonthlyTab from '../../components/tabs/MonthlyTab';
import { usePersistentTheme } from '../../lib/usePersistentTheme';
import { getCurrentMonthKey } from '../../lib/dashboardUtils';

function MonthlyPageContent() {
  const [theme, setTheme] = usePersistentTheme('dark');
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthKey());
  const [monthlyData, setMonthlyData] = useState({
    employees: [],
    gridData: {},
    leaves: [],
    overrides: [],
  });
  const [monthlyLoading, setMonthlyLoading] = useState(false);

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
    fetchMonthlyData(selectedMonth);
  }, [selectedMonth, fetchMonthlyData]);

  return (
    <div className="ga-theme" data-theme={theme}>
      <AppSidebar activeTab="MONTHLY" theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
      <main className="main-content" style={{ flexGrow: 1, padding: '24px 32px', overflowY: 'auto' }}>
        <MonthlyTab
          monthlyLoading={monthlyLoading}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          visibleMonthlyEmployees={monthlyData.employees}
          monthlyData={monthlyData}
          refreshData={() => fetchMonthlyData(selectedMonth)}
        />
      </main>
    </div>
  );
}

export default function MonthlyPage() {
  return (
    <Suspense fallback={<div className="loading-spinner">화면을 불러오는 중...</div>}>
      <MonthlyPageContent />
    </Suspense>
  );
}
