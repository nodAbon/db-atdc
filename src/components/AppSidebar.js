'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SIDEBAR_ITEMS } from '../lib/sidebarConfig';
import { LogOut, Sun, Moon, User } from 'lucide-react';

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
        let displayName = name || '임직원';
        // 이메일 형태인 경우 아이디만 깔끔하게 추출
        if (displayName.includes('@')) {
          displayName = displayName.split('@')[0];
        }

        setLocalProfile({
          name: displayName,
          emp_no: empNo || '',
          dept: dept && dept !== '부서미지정' ? dept : '드림베이',
          rank: rank || '',
        });
      }
    }
  }, []);

  const profile = propProfile || localProfile;

  // 이름 정리
  const cleanDisplayName = (() => {
    let n = profile.name || '임직원';
    if (n.includes('@')) n = n.split('@')[0];
    return n;
  })();

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
      localStorage.removeItem('user-dept');
      localStorage.removeItem('user-rank');
      localStorage.removeItem('user-is-admin');
    }
    window.location.assign('/login');
  };

  return (
    <aside className="sidebar">
      {/* Brand Header with CI Logo (300% Size & Centered) */}
      <Link href="/" className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-dark.png"
          alt="DREAMBAY"
          className="brand-logo-img brand-logo-dark"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-light.png"
          alt="DREAMBAY"
          className="brand-logo-img brand-logo-light"
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
            {cleanDisplayName ? cleanDisplayName.slice(0, 1) : 'D'}
          </div>
          <div className="user-info">
            <div className="user-name-line">
              <span className="user-name">{cleanDisplayName}</span>
              {profile.rank && <span className="user-rank-badge">{profile.rank}</span>}
            </div>
            <div className="user-role-line">
              <span className="user-role">{profile.dept || '드림베이'}</span>
              {profile.emp_no && <span className="user-empno">({profile.emp_no})</span>}
            </div>
          </div>
        </div>

        <div className="sidebar-utils">
          <button
            type="button"
            className="sidebar-util-btn theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? <Sun size={14} className="util-icon text-amber" /> : <Moon size={14} className="util-icon text-blue" />}
            <span>{theme === 'dark' ? '라이트' : '다크'}</span>
          </button>

          <button
            type="button"
            className="sidebar-util-btn logout-btn"
            onClick={handleLogout}
            title="로그아웃"
          >
            <LogOut size={14} className="util-icon" />
            <span>로그아웃</span>
          </button>

          <span className="sidebar-version">{version}</span>
        </div>
      </div>
    </aside>
  );
}
