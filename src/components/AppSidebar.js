'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SIDEBAR_ITEMS } from '../lib/sidebarConfig';
import { LogOut, Sun, Moon } from 'lucide-react';

export default function AppSidebar({
  activeTab = 'DASHBOARD',
  setActiveTab = () => {},
  profile: propProfile,
  theme = 'light',
  toggleTheme = () => {},
  onLogout,
  version = 'v1.0.0',
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [localProfile, setLocalProfile] = useState({
    name: '관리자',
    emp_no: '',
    dept: '경영지원팀',
    rank: '',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const name = localStorage.getItem('user-name');
      const empNo = localStorage.getItem('user-emp-no');
      const dept = localStorage.getItem('user-team') || localStorage.getItem('user-dept');
      const rank = localStorage.getItem('user-rank');

      if (name || empNo) {
        setLocalProfile({
          name: name || '임직원',
          emp_no: empNo || '',
          dept: dept || '부서미지정',
          rank: rank || '',
        });
      }
    }
  }, []);

  const profile = propProfile || localProfile;

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user-name');
      localStorage.removeItem('user-emp-no');
      localStorage.removeItem('user-team');
      localStorage.removeItem('user-rank');
      localStorage.removeItem('user-is-admin');
    }
    window.location.assign('/login');
  };

  return (
    <aside className="sidebar">
      {/* Brand Header with CI Logo */}
      <Link href="/" className="brand" style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-dark.png"
          alt="DREAMBAY"
          className="brand-logo-img brand-logo-dark"
          style={{ height: '34px', width: 'auto', objectFit: 'contain' }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-light.png"
          alt="DREAMBAY"
          className="brand-logo-img brand-logo-light"
          style={{ height: '34px', width: 'auto', objectFit: 'contain' }}
        />
      </Link>

      {/* Navigation */}
      <nav className="tab-menu">
        <div className="sidebar-section">
          <div className="sidebar-section-title">근태 관리</div>
          <div className="sidebar-section-items">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isTab = Boolean(item.tab);
              const isActive = isTab
                ? pathname === '/' && activeTab === item.tab
                : pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`tab-btn${isActive ? ' active' : ''}`}
                  onClick={() => {
                    if (isTab && setActiveTab) {
                      setActiveTab(item.tab);
                    }
                  }}
                >
                  <Icon size={18} style={item.iconStyle || { color: isActive ? 'var(--blue)' : 'var(--text-3)' }} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer / Profile */}
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">
            {profile.name ? profile.name.slice(0, 1) : 'H'}
          </div>
          <div className="user-info">
            <span className="user-name">{profile.name} {profile.rank || ''}</span>
            <span className="user-role">{profile.dept || '부서미지정'} {profile.emp_no ? `(${profile.emp_no})` : ''}</span>
          </div>
        </div>

        <div className="sidebar-utils">
          <button
            type="button"
            className="sidebar-util-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? '라이트' : '다크'}</span>
          </button>

          <button
            type="button"
            className="sidebar-util-btn"
            onClick={handleLogout}
            title="로그아웃"
          >
            <LogOut size={15} />
            <span>로그아웃</span>
          </button>

          <span className="sidebar-ver">{version}</span>
        </div>
      </div>
    </aside>
  );
}
